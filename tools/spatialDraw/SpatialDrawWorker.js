import {ThreejsWorker, setMatrixFromArray} from '/objectDefaultFiles/ThreejsWorker.js';
import {MessageInterface} from '/objectDefaultFiles/WorkerFactory.js';
import {WebGLStrategy} from '/objectDefaultFiles/glCommandBuffer.js';
import * as THREE from '/objectDefaultFiles/three/three.module.js'; 
import {DrawingManager} from './DrawingManager.js';

class SpatialDrawRenderer {
    /**
     * 
     * @param {THREE.Scene} scene 
     */
    constructor(scene) {
        /**
         * @type {THREE.Scene}
         */
        this.scene = scene;

        // create a parent 3D object to contain all the three js objects
        // we can apply the marker transform to this object and all of its
        // children objects will be affected
        this.mainContainerObj = new THREE.Object3D();
        this.mainContainerObj.matrixAutoUpdate = false;
        this.mainContainerObj.name = 'mainContainerObj';
        this.scene.add(this.mainContainerObj);

        this.groundPlaneContainerObj = new THREE.Object3D();
        this.groundPlaneContainerObj.matrixAutoUpdate = false;
        this.groundPlaneContainerObj.name = 'groundPlaneContainerObj';
        this.scene.add(this.groundPlaneContainerObj);

        // light the scene with ambient light
        const ambLight = new THREE.AmbientLight(0x404040);
        this.scene.add(ambLight);
        const directionalLight = new THREE.DirectionalLight(0xFFFFFF);
        directionalLight.position.set(0, 100000, 0);
        this.groundPlaneContainerObj.add(directionalLight);
        const directionalLight2 = new THREE.DirectionalLight(0xFFFFFF);
        directionalLight2.position.set(100000, 0, 100000);
        this.groundPlaneContainerObj.add(directionalLight2);
    }

    /**
     * changes the visibility of the rendered scene
     * @param {boolean} visible 
     */
    setVisible(visible) {
        this.scene.visible = visible;
    }

    groundPlaneCallback(modelViewMatrix) {
        setMatrixFromArray(this.groundPlaneContainerObj.matrix, modelViewMatrix);
        this.mainContainerObj.groundPlaneContainerObj = this.groundPlaneContainerObj;
    }
    
    updateMatrices(modelViewMatrix, projectionMatrix) {
        this.lastProjectionMatrix = projectionMatrix;
        this.lastModelViewMatrix = modelViewMatrix;
    }

    // Draw the scene repeatedly
    render(_now) {
       // only set the projection matrix for the camera 1 time, since it stays the same
        if (!this.isProjectionMatrixSet && this.lastProjectionMatrix && this.lastProjectionMatrix.length === 16) {
            // projection matrix is managed by the three.js worker
            this.isProjectionMatrixSet = true;
        }

        if (this.isProjectionMatrixSet && this.lastModelViewMatrix && this.lastModelViewMatrix.length === 16) {
            // update model view matrix
            setMatrixFromArray(this.mainContainerObj.matrix, this.lastModelViewMatrix);
        }

        // render the scene
        this.mainContainerObj.visible = true;
    }
}

class SpatialDrawWorker {
    constructor() {
        /**
         * @type {MessageInterface}
         */
        this.messageInterface = WebGLStrategy.getScriptSideInterface();
        this.messageInterface.setOnMessage(this.onMessageFromInterface.bind(this));
        this.threejsWorker = new ThreejsWorker(this.messageInterface);
        this.threejsWorker.onSceneCreated(this.onSceneCreated.bind(this));

        /**
         * @type {SpatialDrawRenderer|null}
         */
        this.renderer = null;

        /**
         * @type {DrawingManager|null}
         */
        this.drawingManager = null;
    }

    /**
     * called when the webworker receives a message
     * @param {MessageEvent<any>} event 
     */
    onMessageFromInterface(event) {
        this.threejsWorker.onMessageFromInterface(event);
        const message = event.data;
        if (!message) {
            return;
        }
        if (typeof message !== 'object') {
            return;
        }

        if (message.hasOwnProperty('name')) {
            if (message.name === "groundPlaneCallback") {
                if (this.renderer !== null) {
                    this.renderer.groundPlaneCallback(message.modelViewMatrix);
                }
            } else if (message.name === "updateMatrices") {
                if (this.renderer !== null) {
                    this.renderer.updateMatrices(message.modelViewMatrix, message.projectionMatrix);
                }
            }
        } else if (message.hasOwnProperty("drawingManager")) {
            const drawingMessage = message.drawingManager;
            if (drawingMessage.hasOwnProperty("name")) {
                if (drawingMessage.name === "setVisible") {
                    if (this.renderer !== null) {
                        this.renderer.setVisible(drawingMessage.visible);
                    }
                } else if (this.drawingManager) {
                    if (drawingMessage.name === "deserializeDrawing") {
                        this.drawingManager.deserializeDrawing(drawingMessage.drawing);
                    } else if (drawingMessage.name === "setSize") {
                        this.drawingManager.setSize(drawingMessage.size);
                    } else if (drawingMessage.name === "setColor") {
                        this.drawingManager.setColor(drawingMessage.color);
                    } else if (drawingMessage.name === "setEraseMode") {
                        this.drawingManager.setEraseMode(drawingMessage.value);
                    } else if (drawingMessage.name === "popUndoEvent") {
                        this.drawingManager.popUndoEvent();
                    } else if (drawingMessage.name === "setCursor") {
                        this.drawingManager.setCursor(this.drawingManager.cursorMap[drawingMessage.cursorName]);
                    } else if (drawingMessage.name === "setTool") {
                        this.drawingManager.setTool(this.drawingManager.toolMap[drawingMessage.toolName]);
                    } else if (drawingMessage.name === "setIcon") {
                        this.drawingManager.setIcon(drawingMessage.iconName);
                    } else if (drawingMessage.name === "enableInteractions") {
                        this.drawingManager.enableInteractions();
                    } else if (drawingMessage.name === "disableInteractions") {
                        this.drawingManager.disableInteractions();
                    } else if (drawingMessage.name === "onPointerDown") {
                        this.drawingManager.onPointerDown(drawingMessage.e);
                    } else if (drawingMessage.name === "onPointerMove") {
                        this.drawingManager.onPointerMove(drawingMessage.e);
                    } else if (drawingMessage.name === "onPointerUp") {
                        this.drawingManager.onPointerUp(drawingMessage.e);
                    }
                }
            }
        }   
    }

    postMessage (message) {
        this.messageInterface.postMessage({drawingManager: message});
    }

     /**
     * called when a scene is created and the tool can start populating the three.js scene
     * @param {THREE.Scene} scene 
     */
     onSceneCreated(scene) {
        this.renderer = new SpatialDrawRenderer(scene);
        
        this.drawingManager = new DrawingManager(this.renderer.mainContainerObj, this.threejsWorker.camera);
        this.drawingManager.addCallback('update', drawingData => {
            drawingData.time = Date.now();
            this.postMessage({name: "update", drawingData: drawingData});
        }); 
       
        this.drawingManager.enableInteractions();

        this.drawingManager.addCallback('size', (size) => {
           this.postMessage({name: "size", size: size});
        });
        this.drawingManager.addCallback('color', (color) => {
            this.postMessage({name: "color", color: color});
        });
        this.drawingManager.addCallback('eraseMode', (eraseMode) => {
            this.postMessage({name: "eraseMode", eraseMode: eraseMode});
        });
        this.drawingManager.addCallback('cursor', cursor => {
            const cursorName = Object.keys(this.drawingManager.cursorMap).find(name => this.drawingManager.cursorMap[name] === cursor);
            this.postMessage({name: "cursor", cursorName: cursorName});
        });
        this.drawingManager.addCallback('icon', iconName => {
            this.postMessage({name: "icon", iconName: iconName});
        });
        this.drawingManager.addCallback('tool', tool => {
            const toolName = Object.keys(this.drawingManager.toolMap).find(name => this.drawingManager.toolMap[name] === tool);
            this.postMessage({name: "tool", toolName: toolName});
        });

        this.threejsWorker.onRender(this.render.bind(this))
     }

     render(now) {
        if (this.renderer) {
            this.renderer.render(now);
        }
        if (this.drawingManager) {
            this.drawingManager.triggerCallbacks('render', now);
        }
     }

}

const spatialDrawWorker = new SpatialDrawWorker();
