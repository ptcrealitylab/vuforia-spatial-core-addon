/* global THREE, screen, SpatialInterface, window, realGl, gl, proxies, document, spatialObject, EnvelopeContents, AnimatedGeometry, animitter */

const debugPathPoint = false;

let realRenderer, renderer;
var camera, scene;
var mainContainerObj, groundplaneContainerObj;
var spatialInterface;

var pathPointMesh, pathPointShaderMat;
let baseFloating = null, baseGrounded = null;

let gp_shadow;
let gp_aligned = false;
let shadowTexture, hexTexture;
let heightLine, heightLineGeometry;
let canvasIndexOrder = null, planeIndexOrder, hexIndexPlane, currentIndex = 0, currentTotal = 0, needsCanvasOrderUpdate = false;

let gp_meshPos = new THREE.Vector3(0, 0, 0);

var isProjectionMatrixSet = false, isGroundPlaneFound = false;
let currentWorldId = null;

var rendererWidth = screen.height;
var rendererHeight = screen.width;
var aspectRatio = rendererWidth / rendererHeight;

var raycaster = new THREE.Raycaster();
var mouse = new THREE.Vector2();

let toolScale = 1.0;

if (!spatialInterface) {
    spatialInterface = new SpatialInterface();
    spatialInterface.useWebGlWorker();
    initEnvelopeContents();
}

// window.addEventListener('load', function() {
//     if (!spatialInterface) {
//         spatialInterface = new SpatialInterface();
//     }
//     spatialInterface.useWebGlWorker();
// });

// eslint-disable-next-line no-unused-vars
function main() {
    realRenderer = new THREE.WebGLRenderer( { alpha: true } );
    realRenderer.setPixelRatio(window.devicePixelRatio);
    realRenderer.setSize(rendererWidth, rendererHeight);
    // eslint-disable-next-line no-global-assign
    realGl = realRenderer.getContext();

    // create a fullscreen webgl renderer for the threejs content and add to the dom
    renderer = new THREE.WebGLRenderer( { context: gl, alpha: true } );
    //renderer.setPixelRatio( window.devicePixelRatio );
    renderer.setSize( rendererWidth, rendererHeight );
    //document.body.appendChild( renderer.domElement );

    // create a threejs camera and scene
    camera = new THREE.PerspectiveCamera( 70, aspectRatio, 1, 1000 );
    scene = new THREE.Scene();

    // create a parent 3D object to contain all the three js objects
    // we can apply the marker transform to this object and all of its
    // children objects will be affected
    mainContainerObj = new THREE.Object3D();
    mainContainerObj.matrixAutoUpdate = false;
    mainContainerObj.name = 'mainContainerObj';
    scene.add(mainContainerObj);

    // Create Ground Plane container
    groundplaneContainerObj = new THREE.Object3D();
    groundplaneContainerObj.matrixAutoUpdate = false;
    groundplaneContainerObj.name = 'groundPlaneContainer';
    scene.add(groundplaneContainerObj);

    // light the scene with a combination of ambient and directional white light
    var ambLight = new THREE.AmbientLight(0x404040);
    scene.add(ambLight);
    var dirLight1 = new THREE.DirectionalLight(0xffffff, 1);
    dirLight1.position.set(100, 100, 100);
    scene.add(dirLight1);
    var dirLight2 = new THREE.DirectionalLight(0xffffff, 0.5);
    dirLight2.position.set(-100, -100, -100);
    scene.add(dirLight2);

    hexTexture = new THREE.TextureLoader().load('resources/textures/hex.png', function() {
        pendingLoads.hex = false;
    });

    shadowTexture = new THREE.TextureLoader().load('resources/textures/checkpointFloor.png', function() {
        pendingLoads.shadow = false;
    });

    loadPathPointMesh();

    if (!spatialInterface) {
        spatialInterface = new SpatialInterface();
        spatialInterface.useWebGlWorker();
    }

    spatialInterface.onSpatialInterfaceLoaded(function() {

        initEnvelopeContents();

        spatialInterface.getScreenDimensions(function(width, height) {
            document.body.width = width + 'px';
            document.body.height = height + 'px';
            rendererWidth = width;
            rendererHeight = height;
            renderer.setSize( rendererWidth, rendererHeight );

            spatialInterface.changeFrameSize(width, height);
        });

        spatialInterface.subscribeToMatrix();
        spatialInterface.setFullScreenOn();
        spatialInterface.prefersAttachingToWorld();

        // whenever we receive new matrices from the editor, update the 3d scene
        spatialInterface.addMatrixListener(renderScene);

        spatialInterface.initNode('pathPoint', 'pathPoint', 0, 0);
        spatialInterface.initNode('value', 'node', 0, -200);

        spatialInterface.setMoveDelay(300);

        spatialInterface.registerTouchDecider(touchDecider);

        spatialInterface.addGroundPlaneMatrixListener(groundPlaneCallback);

        spatialInterface.subscribeToWorldId(function(worldId) {
            currentWorldId = worldId;
            console.log('pathPoint got worldId', worldId);
            if (!worldId) {
                spatialInterface.errorNotification('No world object. Delete path point (or restart app), localize' +
                    ' within world first, and try again.');
            }
        });

        spatialInterface.addIsMovingListener(function(e) {
            if (!e) {
                updatePositionServer();
            }
        });
    });

    setTimeout(function() {
        updatePositionServer();
        initPathPointAlignment();
    }, 1000);   // This is needed to avoid the initial setup frames where matrices are empty

}

function updatePositionServer() {
    spatialInterface.getPositionInWorld(function(worldMatrix, worldId) {

        if (!worldMatrix || !currentWorldId) {
            console.warn('tool is not localized against a world object, cannot write position to pathPoint');
        }

        // worldMatrix is the matrix of the tool in world coordinates
        // We want to send the matrix of the pathpointmesh relative to groundplane? as it is our visual reference to how we want that position
        if (debugPathPoint) {
            console.log('PATH POINT ID: ', spatialObject.frame);
            console.log('PATH POINT POSITION: ', gp_shadow.position);
            console.log('gp_shadow: ', gp_shadow);
        }

        // write position into pathPoint
        let point = {
            matrix: worldMatrix,
            //matrix: pathPointMesh.matrixWorld,  // NOT matrixworld! should be matrix relative to world origin
            speed: 1
        };
        let message = {
            address: {
                object: spatialObject.object,
                tool: spatialObject.frame,
                node: spatialObject.node
            },
            points: [point],
            worldObject: worldId
        };
        spatialInterface.write('pathPoint', message, 'c', 'pathPoint');
    });
}

function generateMeshObject() {
    baseFloating.material = new THREE.MeshBasicMaterial({
        color: 0x00d4d2,
        side: THREE.DoubleSide,
        wireframe: false
    });

    baseGrounded.material = new THREE.MeshBasicMaterial({
        color: 0x00d4d2,
        side: THREE.DoubleSide,
        wireframe: false
    });

    //let animatedGeom = new AnimatedGeometry(baseFloating.geometry, baseGrounded.geometry);
    let animatedGeom = new AnimatedGeometry(baseGrounded.geometry, baseFloating.geometry);

    // adds the varying vUv to pass the mixed UV coordinates to the fragment shader
    let myVertexShader = `
        varying vec2 vUv;
        uniform float u_morphFactor;
        uniform float u_time;
        attribute vec3 a_targetPosition;
        attribute vec2 a_targetUV;

        void main(){
         vUv = mix(uv, a_targetUV, u_morphFactor);
         vec3 new_position = mix(position, a_targetPosition, u_morphFactor);
         gl_Position =  projectionMatrix * modelViewMatrix * vec4( new_position, 1.0 );
        }
    `;

    let myFragmentShader = `
        uniform vec3 u_color;
        varying vec2 vUv;
        void main(){
            gl_FragColor = vec4(mix(vec3(0.0, vUv.g, vUv.r), u_color, 0.6), 0.7 );

        }
    `;

    let myUniforms = {
        u_time: { value: 0 },
        u_morphFactor: { value: 0 }, // show first model by default
        u_color: { value: new THREE.Color(0x01FFFD)}
    };

    pathPointShaderMat = new THREE.ShaderMaterial({
        uniforms: myUniforms,
        vertexShader: myVertexShader,
        fragmentShader: myFragmentShader,
        //wireframe: true
    });

    if (debugPathPoint) console.log('NEW PATH POINT MESH GENERATED');
    pathPointMesh = new THREE.Mesh(animatedGeom, pathPointShaderMat);

}

function loadPathPointMesh() {

    //var loader = new THREE.ObjectLoader();

    const fbxLoader = new THREE.FBXLoader();

    fbxLoader.load(
        // resource URL
        'resources/models/KineticAR_Locator_01.fbx',

        // onLoad callback
        // Here the loaded data is assumed to be an object
        obj => {

            /*
            obj.traverse( function ( child ) {

                if ( child instanceof THREE.Mesh ) {
                    child.materials = materials;

                    if (child.name === "LOCATOR___FLOATING"){

                        console.log('FOUND CHECKPOINT FBX');

                        pathPointMesh = child;
                    }
                }
            } );*/

            if (debugPathPoint) console.log(obj);

            baseFloating = obj.getObjectByName( 'LOCATOR___FLOATING' );
            baseGrounded = obj.getObjectByName( 'LOCATOR___GROUNDED' );

            //pathPointMesh = baseGrounded;

            generateMeshObject();

            // Add the loaded object to the scene
            mainContainerObj.add( pathPointMesh );
            pathPointMesh.name = 'pathPointMesh';
            pathPointMesh.scale.set(60, 60, 60);
            pathPointMesh.position.set(0, 0, 0);

            // add spotlight for the shadows
            var spotLight = new THREE.SpotLight(0xffffff);
            spotLight.position.set(-30, -30, 150);
            spotLight.castShadow = true;
            pathPointMesh.add(spotLight);

            let planeGeometry = new THREE.PlaneGeometry( 20, 20, 32 );
            let planeMaterial = new THREE.MeshBasicMaterial( {color: 0xffffff, opacity: 1.0, transparent: true, side: THREE.DoubleSide, map: shadowTexture} );
            //let planeMaterial = new THREE.MeshBasicMaterial( {color: 0xffffff, opacity: 1.0, transparent: false, side: THREE.DoubleSide} );

            gp_shadow = new THREE.Mesh( planeGeometry, planeMaterial );
            gp_shadow.rotateX(Math.PI / 2);
            gp_shadow.name = 'gp_shadow';
            pathPointMesh.add(gp_shadow);
            gp_shadow.position.set(0, -10, 0);

            gp_shadow.scale.set(0.01, 0.01, 0.01);

            generateHexLabel();

            // Height line

            let positionPathPoint = new THREE.Vector3(0, 0, 0);
            pathPointMesh.getWorldPosition(positionPathPoint);

            let materialLine = new THREE.LineBasicMaterial({
                color: 0xffffff,
                linewidth: 1
            });

            // CANNOT WORK WITH MESHLINE IF WE ARE NOT IN Version 2020 of Threejs
            // let material = new MeshLineMaterial({
            //     color: new THREE.Color('white'),
            //     transparent:true,
            //     opacity: 1,
            //     dashArray: 0.1,
            //     dashOffset: 0,
            //     dashRatio: 0.5,
            //     resolution: new THREE.Vector2(window.innerWidth, window.innerHeight),
            //     sizeAttenuation: true,
            //     lineWidth: 5,
            //     depthWrite: true,
            //     depthTest: true
            //     //near: camera.near,
            //     //far: camera.far
            // });

            let randomPos = new THREE.Vector3(0, 0, 0);

            heightLineGeometry = new THREE.BufferGeometry();

            let vertices = new Float32Array(6); // 2 vertices x (x,y,z)
            let posAttr = new THREE.BufferAttribute(vertices, 3);
            heightLineGeometry.addAttribute('position', posAttr);

            vertices[0] = gp_shadow.position.x;
            vertices[1] = gp_shadow.position.y;
            vertices[2] = gp_shadow.position.z;
            vertices[3] = randomPos.x;
            vertices[4] = randomPos.y;
            vertices[5] = randomPos.z;

            posAttr.needsUpdate = true;

            heightLine = new THREE.Line(heightLineGeometry, materialLine);
            heightLine.name = 'heightline';
            groundplaneContainerObj.add(heightLine);

            pendingLoads.loadPathPointMesh = false;
        },

        // onProgress callback
        function ( xhr ) {
            if (debugPathPoint) console.log( (xhr.loaded / xhr.total * 100) + '% loaded' );
        },

        // onError callback
        function ( err ) {
            console.error( 'An error happened loading the model', err );
        }
    );
}

function initEnvelopeContents() {
    // Allow this tool to be accepted by envelopes by instantiating an EnvelopeContents
    let envelopeContents = new EnvelopeContents(spatialInterface, document.body);


    // 4. Whenever a tool is added or removed from the envelope, this function will trigger for
    //    every tool contained by the envelope, and recalculate its position in the sequence
    envelopeContents.onOrderUpdated(function(event) {
        if (debugPathPoint) console.log('onOrderUpdated: ', event.index, event.total);
        currentIndex = event.index;
        currentTotal = event.total;

        needsCanvasOrderUpdate = true;
    });
}

function updateCanvasIndex() {
    const ctx = canvasIndexOrder.getContext('2d');
    ctx.clearRect(0, 0, canvasIndexOrder.width, canvasIndexOrder.height);
    ctx.fillStyle = 'white';
    ctx.font = '30px Helvetica';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    let text = (currentIndex + 1).toString() + ' / ' + currentTotal;
    ctx.fillText(text, canvasIndexOrder.width / 2, canvasIndexOrder.height / 2);
    planeIndexOrder.material.map.needsUpdate = true;
}

function touchDecider(eventData) {

    //console.log('eventData: ', eventData);

    //1. sets the mouse position with a coordinate system where the center
    //   of the screen is the origin
    mouse.x = ( eventData.x / window.innerWidth ) * 2 - 1;
    mouse.y = - ( eventData.y / window.innerHeight ) * 2 + 1;

    //2. set the picking ray from the camera position and mouse coordinates
    raycaster.setFromCamera( mouse, camera );

    //3. compute intersections
    var intersects = raycaster.intersectObjects( scene.children, true );

    return intersects.length > 0;
}

function setMatrixFromArray(matrix, array) {
    matrix.set( array[0], array[4], array[8], array[12],
        array[1], array[5], array[9], array[13],
        array[2], array[6], array[10], array[14],
        array[3], array[7], array[11], array[15]
    );
}

let lastProjectionMatrix = null;
let lastModelViewMatrix = null;

function renderScene(modelViewMatrix, projectionMatrix) {
    lastProjectionMatrix = projectionMatrix;
    lastModelViewMatrix = modelViewMatrix;
}

function groundPlaneCallback(groundPlaneMatrix, _projectionMatrix) {
    if (isProjectionMatrixSet) {

        // CHECK HERE WHEN THIS GETS CALLED
        //console.log('GroundPlane: ', groundPlaneMatrix);

        isGroundPlaneFound = true;
        setMatrixFromArray(groundplaneContainerObj.matrix, groundPlaneMatrix);  // update model view matrix
    }
}

function initPathPointAlignment() {
    groundplaneContainerObj.attach(gp_shadow);
    groundplaneContainerObj.attach(planeIndexOrder);
    groundplaneContainerObj.attach(hexIndexPlane);

    if (isGroundPlaneFound) alignPathPointToGroundPlane();

}

function alignPathPointToGroundPlane() {
    // Align the checkpoint to the groundplane up vector

    // THREE.SceneUtils.detach( pathPointMesh, mainContainerObj, scene );
    // THREE.SceneUtils.attach( pathPointMesh, scene, groundplaneContainerObj );

    // scene.attach(pathPointMesh);
    groundplaneContainerObj.attach(pathPointMesh);

    //let newRotation = new THREE.Euler(gp_shadow.rotation.x - Math.PI/2, gp_shadow.rotation.y, gp_shadow.rotation.z);
    let newRotation = new THREE.Euler(0, 0, 0);
    let newQuaternion = new THREE.Quaternion();
    newQuaternion.setFromEuler(newRotation);

    const loop = animitter((deltatime, elapsedtime, framecount) => {
        pathPointMesh.quaternion.slerp(newQuaternion, 0.15);

        if (framecount >= 50) {
            if (debugPathPoint) console.log('finished alignment');
            loop.stop();
            // THREE.SceneUtils.detach( pathPointMesh, groundplaneContainerObj, scene );
            // THREE.SceneUtils.attach( pathPointMesh, groundplaneContainerObj, mainContainerObj );

            scene.attach(pathPointMesh);
            mainContainerObj.attach(pathPointMesh);
            gp_aligned = true;

            //addAxisHelpers();

        }
    });

    loop.start();
}

function addAxisHelpers() {
    // Axis

    let geometrycube = new THREE.BoxGeometry( 1, 1, 1 );
    let material = new THREE.MeshBasicMaterial( {color: 0xff0000} );
    let material2 = new THREE.MeshBasicMaterial( {color: 0x00ff00} );
    let material3 = new THREE.MeshBasicMaterial( {color: 0x0000ff} );
    let cube_down = new THREE.Mesh( geometrycube, material );
    let cube_front = new THREE.Mesh( geometrycube, material2 );
    let cube_right = new THREE.Mesh( geometrycube, material3 );
    pathPointMesh.add( cube_down );
    pathPointMesh.add( cube_front );
    pathPointMesh.add( cube_right );
    cube_down.position.set(0, -3, 0);
    cube_right.position.set(2.5, 2, 0);
    cube_front.position.set(0, 2, 2.5);
    cube_down.scale.set(0.5, 0.5, 0.5);
    cube_front.scale.set(0.5, 0.5, 0.5);
    cube_right.scale.set(0.5, 0.5, 0.5);

    // scene.attach(cube_down);
    mainContainerObj.attach(cube_down);
    // scene.attach(cube_right);
    mainContainerObj.attach(cube_right);
    // scene.attach(cube_front);
    mainContainerObj.attach(cube_front);

    pendingLoads.addAxisHelpers = false;
}

function generateHexLabel() {

    // Create top

    // immediately use the texture for material creation
    var materialHex = new THREE.MeshBasicMaterial( { map: hexTexture, transparent: true, side: THREE.DoubleSide } );
    //var materialHex = new THREE.MeshBasicMaterial( { transparent: false, side: THREE.DoubleSide } );
    let geometry = new THREE.PlaneGeometry( 4, 4, 1 );
    hexIndexPlane = new THREE.Mesh( geometry, materialHex );

    groundplaneContainerObj.add( hexIndexPlane );
    hexIndexPlane.position = gp_meshPos;
    hexIndexPlane.scale.set(20, 20, 20);

    // create number labels
    canvasIndexOrder = document.createElement('canvas');
    const ctx = canvasIndexOrder.getContext('2d');
    canvasIndexOrder.width = canvasIndexOrder.height = 128;
    ctx.fillStyle = 'white';
    ctx.font = '40px Helvetica';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    let text = (currentIndex + 1).toString() + ' / ' + currentTotal;

    if (currentTotal === 0) text = '1';   // If currentTotal is 0, we are not in a path

    ctx.fillText(text, canvasIndexOrder.width / 2, canvasIndexOrder.height / 2);

    let materialText = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(canvasIndexOrder), transparent: true, side: THREE.DoubleSide });
    let geometryNumber = new THREE.PlaneGeometry( 4, 4, 1 );
    planeIndexOrder = new THREE.Mesh( geometryNumber, materialText );
    groundplaneContainerObj.add( planeIndexOrder );
    planeIndexOrder.position = gp_meshPos;
    planeIndexOrder.scale.set(20, 20, 20);

    pendingLoads.generateHexLabel = false;
}

// Update shadow
function updateShadow() {
    if (!gp_shadow) {
        return;
    }

    planeIndexOrder.position.set(gp_meshPos.x, gp_meshPos.y + 120, gp_meshPos.z);
    hexIndexPlane.position.set(gp_meshPos.x, gp_meshPos.y + 120, gp_meshPos.z);
    gp_shadow.position.set(gp_meshPos.x, 0, gp_meshPos.z);
    gp_shadow.rotation.set(Math.PI / 2, 0, 0);

    // Only adjust scale if the checkpoint has finished alignment with groundplane
    if (gp_aligned) {
        let shadowScale = toolScale * 3.5;
        gp_shadow.scale.set(5 * shadowScale, 5 * shadowScale, 5 * shadowScale);
    }
}

function updateHeighLineAndMeshBlend() {
    if (!heightLineGeometry) {
        return;
    }

    heightLineGeometry.attributes.position.array[0] = gp_shadow.position.x;
    heightLineGeometry.attributes.position.array[1] = gp_shadow.position.y;
    heightLineGeometry.attributes.position.array[2] = gp_shadow.position.z;
    heightLineGeometry.attributes.position.array[3] = gp_meshPos.x;
    heightLineGeometry.attributes.position.array[4] = gp_meshPos.y - 50;
    heightLineGeometry.attributes.position.array[5] = gp_meshPos.z;

    heightLineGeometry.attributes.position.needsUpdate = true;

    // MESH BLENDING


    /*
    if (gp_meshPos.y > 90) { // Pyramid to rhombe animation (from floor to floating)
        if (pathPointShaderMat.uniforms.u_morphFactor.value > 0) {

            //pathPointShaderMat.uniforms.u_morphFactor.value = 0;

            pathPointShaderMat.uniforms.u_morphFactor.value = Math.max(
                pathPointShaderMat.uniforms.u_morphFactor.value - 0.1,
                0
            );
        }

    } else { // Rhombe to pyramid animation (from floating to floor)
        if (pathPointShaderMat.uniforms.u_morphFactor.value < 1) {

            //pathPointShaderMat.uniforms.u_morphFactor.value = 1;

            pathPointShaderMat.uniforms.u_morphFactor.value = Math.min(
                pathPointShaderMat.uniforms.u_morphFactor.value + 0.1,
                1
            );
        }
    }
     */
}



let done = false;
let pendingLoads = {
    hex: true,
    shadow: true,
    loadPathPointMesh: true,
    addAxisHelpers: true,
    generateHexLabel: true,
};


// Draw the scene repeatedly
// eslint-disable-next-line no-undef
render = function(_now) {
    // now *= 0.001;  // convert to seconds
    // const deltaTime = now - then;
    // then = now;

    // cube.rotation.x -= 0.2 * deltaTime;
    // cube.rotation.y -= 0.2 * deltaTime;

    // only set the projection matrix for the camera 1 time, since it stays the same
    if (!isProjectionMatrixSet && lastProjectionMatrix && lastProjectionMatrix.length === 16) {
        setMatrixFromArray(camera.projectionMatrix, lastProjectionMatrix);
        camera.projectionMatrixInverse.getInverse(camera.projectionMatrix);
        isProjectionMatrixSet = true;
    }

    if (isProjectionMatrixSet && lastModelViewMatrix && lastModelViewMatrix.length === 16) {

        // update model view matrix
        setMatrixFromArray(mainContainerObj.matrix, lastModelViewMatrix);
        // render the scene
        mainContainerObj.visible = true;
        
        if (renderer && scene && camera) {
            renderer.render(scene, camera);
            // Can be done when nothing is pending
            let canBeDone = !Object.values(pendingLoads).some(a => a);
            if (canBeDone) {
                if (done && realGl) {

                    for (let proxy of proxies) {
                        proxy.__uncloneableObj = null;
                        delete proxy.__uncloneableObj;
                    }
                    // eslint-disable-next-line no-global-assign
                    proxies = [];
                    realRenderer.dispose();
                    realRenderer.forceContextLoss();
                    realRenderer.context = null;
                    realRenderer.domElement = null;
                    realRenderer = null;
                    // eslint-disable-next-line no-global-assign
                    realGl = null;
                }
                done = true;
            }
        }

        toolScale = Math.abs(lastModelViewMatrix[0]) || 1.0; // distance is relative to scale of frame

        if (pathPointMesh && isGroundPlaneFound) {

            // Keep local position of Mesh in Ground Plane
            pathPointMesh.getWorldPosition(gp_meshPos);
            groundplaneContainerObj.worldToLocal(gp_meshPos);

            updateShadow();
            updateHeighLineAndMeshBlend();

            if (needsCanvasOrderUpdate) {
                updateCanvasIndex();
                needsCanvasOrderUpdate = false;
            }
        }
    }

};
