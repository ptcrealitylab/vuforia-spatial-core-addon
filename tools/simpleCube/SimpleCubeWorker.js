import {GLCommandBufferContext, CommandBufferFactory, CommandBuffer, WebGLStrategy} from '/objectDefaultFiles/glCommandBuffer.js';

// basic linear algebra

/**
 * dot product
 * @param {Float32Array} a float4
 * @param {Float32Array} b float4
 * @return {number} 
 */
function dotVector(a, b) {
    return (a[0] * b[0]) + (a[1] * b[1]) + (a[2] * b[2]) + (a[3] * b[3]);
}

/**
 * normalize vectors
 * @param {Float32Array} a float3 
 * @returns {Float32Array} float3
 */
function normalizeVector(a) {
    const length = Math.sqrt((a[0] * a[0]) + (a[1] * a[1]) + (a[2] * a[2]));
    return new Float32Array([a[0] / length, a[1] / length, a[2] / length]);
}

/**
 * setup projection matrix
 * @param {number} fovDeg 
 * @param {number} near 
 * @param {number} far 
 * @param {number} aspect 
 * @returns {Float32Array} float4x4
 */
function getProjectionMatrix(fovDeg, near, far, aspect) {
    const fov = 1 / Math.tan((fovDeg * Math.PI) / (180 * 2));
    const rangeInv = 1 / (near - far);
    return new Float32Array([fov / aspect, 0, 0, 0, 0, fov, 0, 0, 0, 0, (near + far) * rangeInv, -1, 0, 0, near * far * rangeInv * 2, 0]);
}

/**
 * translation matrix
 * @param {Float32Array} a float4
 * @returns {Float32Array} float4x4
 */
function getTranslationMatrix(a) {
    return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, a[0], a[1], a[2], a[3]])
}

/**
 * scale matrix
 * @param {Float32Array} a float4
 * @returns {Float32Array} float4x4
 */
function getScaleMatrix(a) {
    return new Float32Array([a[0], 0, 0, 0, 0, a[1], 0, 0, 0, 0, a[2], 0, 0, 0, 0, a[3]])
}

/**
 * rotation matrix
 * @param {Float32Array} axis float3
 * @param {number} angleDeg 
 * @returns {Float32Array} float4x4
 */
function getRotationMatrix(axis, angleDeg) {
    const angle = (angleDeg * Math.PI) / 180;
    const angleCos = Math.cos(angle);
    const angleSin = Math.sin(angle);  
    return new Float32Array([angleCos + (axis[0] * axis[0] * (1 - angleCos)), (axis[0] * axis[1] * (1 - angleCos)) - (axis[2] * angleSin), (axis[0] * axis[2] * (1 - angleCos)) + (axis[1] * angleSin), 0, (axis[1] * axis[0] * (1 - angleCos) + (axis[2] * angleSin)), angleCos + (axis[1] * axis[1] * (1 - angleCos)), (axis[1] * axis[2] * (1 - angleCos)) - (axis[0] * angleSin), 0, (axis[2] * axis[0] * (1 - angleCos)) - (axis[1] * angleSin), (axis[2] * axis[1] * (1 - angleCos)) + (axis[0] * angleSin), angleCos + (axis[2] * axis[2] * (1 - angleSin)), 0, 0, 0, 0, 1]);
}

/**
 * multiply two matrices
 * @param {Float32Array} a float4x4
 * @param {Float32Array} b float4x4
 * @return {Float32Array} float4x4
 */
function mulMatrix(a, b) {
    const row = [new Float32Array([a[0], a[1], a[2], a[3]]), new Float32Array([a[4], a[5], a[6], a[7]]), new Float32Array([a[8], a[9], a[10], a[11]]), new Float32Array([a[12], a[13], a[14], a[15]])];
    const col = [new Float32Array([b[0], b[4], b[8], b[12]]), new Float32Array([b[1], b[5], b[9], b[13]]), new Float32Array([b[2], b[6], b[10], b[14]]), new Float32Array([b[3], b[7], b[11], b[15]])];
    return new Float32Array([dotVector(row[0], col[0]), dotVector(row[0], col[1]), dotVector(row[0], col[2]), dotVector(row[0], col[3]), dotVector(row[1], col[0]), dotVector(row[1], col[1]), dotVector(row[1], col[2]), dotVector(row[1], col[3]), dotVector(row[2], col[0]), dotVector(row[2], col[1]), dotVector(row[2], col[2]), dotVector(row[2], col[3]), dotVector(row[3], col[0]), dotVector(row[3], col[1]), dotVector(row[3], col[2]), dotVector(row[3], col[3])]);
}

/**
 * transpose a matrix
 * @param {Float32Array} a 
 */
function transpose(a) {
    return new Float32Array([a[0], a[4], a[8], a[12], a[1], a[5], a[9], a[13], a[2], a[6], a[10], a[14], a[3], a[7], a[10], a[15]]);
}

/**
 * renders a cube using raw webgl
 */
class SimpleCubeWorker {
    constructor() {
        console.log('worker is in a secure context: ' + isSecureContext + ' and isolated: ' + crossOriginIsolated);
        this.gl = null;
        const fovDeg = 60;
        const near = 0.03;
        const far = 1000;
        const aspect = 1;
        // all resources we need for intialisation and rendering
        this.objRotation = 40;
        this.modelMatrix = mulMatrix(getScaleMatrix(new Float32Array([200, 200, 200, 1])), getRotationMatrix(new Float32Array([0, 1, 0]), this.objRotation));
        this.projectionMatrix = getProjectionMatrix(fovDeg, near, far, aspect);
        this.viewMatrix = getTranslationMatrix(new Float32Array([0, 0, -600, 1]));
        this.worldMatrix = getTranslationMatrix(new Float32Array([0, 0, 0, 1]));
        this.normalMatrix = this.modelMatrix;
        this.mvpMatrix = null;
        this.updateMVP();
        this.shaderProgram = null;
        this.lightDir = null;
        this.ldirLoc = null;
        this.mvpLoc = null;
        this.normalMatrixLoc = null;
        this.positionBuffer = null;
        this.posLoc = null;
        this.normalBuffer = null;
        this.normLoc = null;
        this.indexBuffer = null;
    }

    /**
     * create all required resources for rendering the cube
     * @param {number} width 
     * @param {number} height 
     * @param {CommandBufferFactory} commandBufferFactory 
     */
    main(width, height, commandBufferFactory) {
        this.gl = commandBufferFactory.getGL();
        const positionData = new Float32Array([
            // Front face
            -1, -1, 1, 1, -1, 1, 1, 1, 1, -1, 1, 1,
        
            // Back face
            -1, -1, -1, -1, 1, -1, 1, 1, -1, 1, -1, -1,
        
            // Top face
            -1, 1, -1, -1, 1, 1, 1, 1, 1, 1, 1, -1,
        
            // Bottom face
            -1, -1, -1, 1, -1, -1, 1, -1, 1, -1, -1, 1,
        
            // Right face
            1, -1, -1, 1, 1, -1, 1, 1, 1, 1, -1, 1,
        
            // Left face
            -1, -1, -1, -1, -1, 1, -1, 1, 1, -1, 1, -1
        ]);
    
        const normalData = new Float32Array([
            // Front face
            0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1,
        
            // Back face
            0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1,
        
            // Top face
            0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0,
        
            // Bottom face
            0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0,
        
            // Right face
            1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0,
        
            // Left face
            -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0,
        ]);
    
        const indexData = new Uint16Array([
            // Front face
            0, 1, 2, 0, 2, 3, 
    
            // Back face
            4, 5, 6, 4, 6, 7, 
            
            // Top face
            8, 9, 10, 8, 10, 11,
            
            // Bottom face
            12, 13, 14, 12, 14, 15,
            
            // Right face
            16, 17, 18, 16, 18, 19, 
            
            // Left face
            20, 21, 22, 20, 22, 23
        ]);
    
        this.lightDir = normalizeVector(new Float32Array([10, -1, 5]));
    
        const vertSrc = 'attribute vec3 pos; attribute vec3 norm; varying highp vec3 N; uniform mat4 mvp; uniform mat3 normalMatrix; void main() { gl_Position = mvp * vec4(pos, 1); N = norm;} //normalMatrix * norm;}';
        const fragSrc = 'varying highp vec3 N; uniform highp vec3 ldir; void main() {gl_FragColor = vec4(N/*max(dot(N, -ldir), 0.0) * vec3(0, 1, 0)*/, 1);}';

        const commandBuffer = commandBufferFactory.createAndActivate(false);

        this.positionBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, positionData, this.gl.STATIC_DRAW);
    
        this.normalBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.normalBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, normalData, this.gl.STATIC_DRAW);
        
        this.indexBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
        this.gl.bufferData(this.gl.ELEMENT_ARRAY_BUFFER, indexData, this.gl.STATIC_DRAW);
    
        const vertShader = this.gl.createShader(this.gl.VERTEX_SHADER);
        if (!vertShader) {
            return [];
        }
        this.gl.shaderSource(vertShader, vertSrc);
        this.gl.compileShader(vertShader);
    
        const fragShader = this.gl.createShader(this.gl.FRAGMENT_SHADER);
        if (!fragShader) {
            return [];
        }
        this.gl.shaderSource(fragShader, fragSrc);
        this.gl.compileShader(fragShader);
    
        this.shaderProgram = this.gl.createProgram();
        if (!this.shaderProgram) {
            return [];
        }
        this.gl.attachShader(this.shaderProgram, vertShader);
        this.gl.attachShader(this.shaderProgram, fragShader);
        this.gl.linkProgram(this.shaderProgram);

        // testing wait
        //const count = this.gl.getProgramParameter(this.shaderProgram, this.gl.ACTIVE_UNIFORMS);
        //console.log('testing shader paramcount: ' + count);
        
        this.posLoc = this.gl.getAttribLocation(this.shaderProgram, 'pos');
        this.normLoc = this.gl.getAttribLocation(this.shaderProgram, 'norm');
        this.mvpLoc = this.gl.getUniformLocation(this.shaderProgram, 'mvp');
        this.normalMatrixLoc = this.gl.getUniformLocation(this.shaderProgram, 'normalMatrix');
        this.ldirLoc = this.gl.getUniformLocation(this.shaderProgram, 'ldir');

        this.gl.enable(this.gl.DEPTH_TEST);
        this.gl.depthFunc(this.gl.LEQUAL);
        this.gl.enable(this.gl.CULL_FACE);
        this.gl.cullFace(this.gl.BACK);

        return [commandBuffer];
    }

    /**
     * updates the model view projection matrix and the normal matrix
     */
    updateMVP() {
        const modelWorldMatrix = mulMatrix(this.modelMatrix, this.worldMatrix);
        this.mvpMatrix = mulMatrix(modelWorldMatrix, mulMatrix(this.viewMatrix, this.projectionMatrix));
        this.normalMatrix = new Float32Array(modelWorldMatrix);
        this.normalMatrix[12] = 0; 
        this.normalMatrix[13] = 0; 
        this.normalMatrix[14] = 0; 
        this.normalMatrix[15] = 1; 
    }

    /**
     * render the cube using the preallocated resources
     * @param {number} time 
     * @param {CommandBuffer} commandBuffer 
     * @returns {CommandBuffer}
     */
    render(time, commandBuffer) {
        // don;t render if resources aren't loaded
        if (this.shaderProgram === null ||
            this.lightDir === null ||
            this.ldirLoc === null ||
            this.mvpMatrix === null ||
            this.mvpLoc === null ||
            this.normalMatrix === null ||
            this.normalMatrixLoc === null ||
            this.positionBuffer === null ||
            this.posLoc === null ||
            this.normalBuffer === null ||
            this.normLoc === null ||
            this.indexBuffer === null) 
        {
            return commandBuffer; // is empty
        }
        
        // update object rotation
        this.objRotation += 0.1;
        this.setModelMatrix(mulMatrix(getScaleMatrix(new Float32Array([200, 200, 200, 1])), getRotationMatrix(new Float32Array([0, 1, 0]), this.objRotation)));
        
        // render cube
        this.gl.useProgram(this.shaderProgram);
    
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer);
        this.gl.vertexAttribPointer(this.posLoc, 3, this.gl.FLOAT, false, 0, 0);
        this.gl.enableVertexAttribArray(this.posLoc);
    
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.normalBuffer);
        this.gl.vertexAttribPointer(this.normLoc, 3, this.gl.FLOAT, false, 0, 0);
        this.gl.enableVertexAttribArray(this.normLoc);
    
        this.gl.uniformMatrix4fv(this.mvpLoc, false, this.mvpMatrix);
        this.gl.uniformMatrix3fv(this.normalMatrixLoc, false, new Float32Array([this.normalMatrix[0], this.normalMatrix[1], this.normalMatrix[2], this.normalMatrix[4], this.normalMatrix[5], this.normalMatrix[6], this.normalMatrix[8], this.normalMatrix[9], this.normalMatrix[10]]));
    
        this.gl.uniform3fv(this.ldirLoc, this.lightDir);
    
        this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
        this.gl.drawElements(this.gl.TRIANGLES, 36, this.gl.UNSIGNED_SHORT, 0);

        return commandBuffer;
    }

    /**
     * changes the projection matrix and updates the matrices
     * @param {Float32Array} matrix 
     */
    setProjectionMatrix(matrix) {
        this.projectionMatrix = matrix;
        this.updateMVP();
    }

    /**
     * changes the view matrix and updates the matrices
     * @param {Float32Array} matrix 
     */
    setViewMatrix(matrix) {
        this.viewMatrix = transpose(matrix);
        this.updateMVP();
    }

    /**
     * changes the model matrix and updates the matrices
     * @param {Float32Array} matrix 
     */
    setModelMatrix(matrix) {
        this.modelMatrix = matrix;
        this.updateMVP();
    }

    /**
     * changes the world matrix and updates the matrices
     * @param {Float32Array} matrix 
     */
    setWorldMatrix(matrix) {
        this.worldMatrix = matrix;
        this.updateMVP();
    }
}

const messageInterface = WebGLStrategy.getScriptSideInterface();
messageInterface.setOnMessage(onMessage);

const worker = new SimpleCubeWorker();

const STATE_CONSTRUCTED = 0;
const STATE_BOOTSTRAP = 1;
const STATE_BOOTSTRAP_DONE = 2;
const STATE_FRAME = 3;
const STATE_FRAME_DONE = 4;
const STATE_CONTEXT_LOST = 5;
const STATE_CONTEXT_RESTORED = 6;
const STATE_CONTEXT_RESTORED_DONE = 7;

let clientState = STATE_CONSTRUCTED;

// the rest of the code is communication which should not bother the tool developer (ThreejsInterface)

// Unique worker id
/**
 * @type {number}
 */
let workerId;

/**
 * @type {GLCommandBufferContext | null}
 */
let glCommandBufferContext = null;
/**
 * @type {CommandBufferFactory | null}
 */
let commandBufferFactory = null;
/**
 * @type {CommandBuffer | null}
 */
let frameCommandBuffer = null;

let bootstrapProcessed = false;

/**
 * @type {Int32Array | null}
 */
let synclock = null;

/**
 * @param {MessageEvent} event 
 */
function onMessage(event) {
    const message = event.data;
    if (!message) {
        console.warn('Event missing data', message);
        return;
    }
    if (typeof message !== 'object') {
        return;
    }
    if (message.hasOwnProperty('name')) {
        if (message.name === 'setProjectionMatrix') {
            switch (clientState) {
                case STATE_CONSTRUCTED:
                case STATE_BOOTSTRAP_DONE:
                case STATE_FRAME_DONE:
                case STATE_CONTEXT_RESTORED_DONE:
                    worker.setProjectionMatrix(message.matrix);
                    break;
                default:
                    console.error('wrong state to set projectionmatrix ' + clientState);
                    break;
            }
        } else if (message.name === 'setWorldMatrix') {
            switch (clientState) {
                case STATE_CONSTRUCTED:
                case STATE_BOOTSTRAP_DONE:
                case STATE_FRAME_DONE:
                case STATE_CONTEXT_RESTORED_DONE:
                    worker.setWorldMatrix(message.matrix);
                    break;
                default:
                    console.error('wrong state to set world matrix ' + clientState);
                    break;
            }
        } else if (message.name === 'setViewMatrix') {
            switch (clientState) {
                case STATE_CONSTRUCTED:
                case STATE_BOOTSTRAP_DONE:
                case STATE_FRAME_DONE:
                case STATE_CONTEXT_RESTORED_DONE:
                    worker.setViewMatrix(message.matrix);
                    break;
                default:
                    console.error('wrong state to set view matrix ' + clientState);
                    break;
            }
        } else if (message.name === 'bootstrap') {
            if (clientState === STATE_CONSTRUCTED) {
                clientState = STATE_BOOTSTRAP;
                workerId = message.workerId;
                let {width, height} = message;
                synclock = message.synclock;

                glCommandBufferContext = new GLCommandBufferContext(message, WebGLStrategy.getInstance().syncStrategy);
                commandBufferFactory = new CommandBufferFactory(workerId, glCommandBufferContext, message.synclock, messageInterface);
                
                // let the tool code finish initialisation
                let bootstrapCommandBuffers = worker.main(width, height, commandBufferFactory);

                for (const bootstrapCommandBuffer of bootstrapCommandBuffers) {
                    bootstrapCommandBuffer.execute();
                }
        
                bootstrapProcessed = true;

                messageInterface.postMessage({
                    workerId,
                    isFrameEnd: true,
                });

                clientState = STATE_BOOTSTRAP_DONE;
            } else {
                console.error('wrong state for bootstrap ' + clientState);
            }
            return;
        } else if (message.name === 'frame') {
            switch (clientState) {
                case STATE_BOOTSTRAP_DONE:
                case STATE_FRAME_DONE:
                case STATE_CONTEXT_RESTORED_DONE:
                    workerId = message.workerId;
                    // safety checks
                    if (!bootstrapProcessed) {
                        console.log(`Can't render worker with id: ${workerId}, it has not yet finished initializing`);
                        messageInterface.postMessage({
                            workerId,
                            isFrameEnd: true,
                        });
                        return;
                    }
                    if (Date.now() - message.time > 300) {
                        console.log('time drift detected');
                        messageInterface.postMessage({
                            workerId,
                            isFrameEnd: true,
                        });
                        return;
                    }

                    clientState = STATE_FRAME;

                    // activate the correct commandbuffer
                    if (frameCommandBuffer === null) {
                        frameCommandBuffer = commandBufferFactory.createAndActivate(true);
                    } else {
                        frameCommandBuffer.clear();
                        glCommandBufferContext.setActiveCommandBuffer(frameCommandBuffer);
                    }
                    try {
                        // let the tool render the scene
                        frameCommandBuffer = worker.render(message.time, frameCommandBuffer);
                    } catch (err) {
                        console.error('Error in gl-worker render fn', err);
                    }

                    frameCommandBuffer.execute();

                    // always post an endmessage frame, even when there is nothing to do for this frame (empty commandlist)
                    messageInterface.postMessage({
                        workerId,
                        isFrameEnd: true,
                    });
                    clientState = STATE_FRAME_DONE;
                    break;
                default:
                    console.error('wrong state to ask for frame data ' + clientState);
                    break;
            }   
        } else if (message.name === 'context_lost') {
            switch (clientState) {
                case STATE_CONSTRUCTED:
                case STATE_BOOTSTRAP_DONE:
                case STATE_FRAME_DONE:
                case STATE_CONTEXT_RESTORED_DONE:
                    clientState = STATE_CONTEXT_LOST;
                    glCommandBufferContext.onContextLost();
                    break;
                default:
                    console.error('wrong state for context lost ' + clientState);
                    break;
            }
        } else if (message.name == 'context_restored') {
            if (clientState === STATE_CONTEXT_LOST) {
                clientState = STATE_CONTEXT_RESTORED;
                glCommandBufferContext.onContextRestored();
                let bootstrapCommandBuffers = worker.main(message.width, message.height, commandBufferFactory);

                for (const bootstrapCommandBuffer of bootstrapCommandBuffers) {
                    bootstrapCommandBuffer.execute();
                }

                messageInterface.postMessage({
                    workerId,
                    isFrameEnd: true,
                });
                clientState = STATE_CONTEXT_RESTORED_DONE;
            } else {
                console.error('wrong state for restoring context ' + clientState);
            }
        }
    }
}
