import {ThreejsWorker, setMatrixFromArray} from '/objectDefaultFiles/ThreejsWorker.js';
import {MessageInterface} from '/objectDefaultFiles/WorkerFactory.js';
import {WebGLStrategy} from '/objectDefaultFiles/glCommandBuffer.js';
import * as THREE from '/objectDefaultFiles/three/three.module.js'; 
import 'DrawingManager.js';

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
                } else if (drawingMessage.name === "deserializeDrawing") {
                    
                } else if (drawingMessage.name === "setSize") {

                } else if (drawingMessage.name === "setColor") {

                } else if (drawingMessage.name === "setEraseMode") {

                } else if (drawingMessage.name === "popUndoEvent") {

                } else if (drawingMessage.name === "setCursor") {

                } else if (drawingMessage.name === "setTool") {

                } else if (drawingMessage.name === "setIcon") {

                } else if (drawingMessage.name === "enableInteractions") {

                } else if (drawingMessage.name === "disableInteractions") {

                }
            }
        }
        
    }

     /**
     * called when a scene is created and the tool can start populating the three.js scene
     * @param {THREE.Scene} scene 
     */
     onSceneCreated(scene) {
        this.renderer = new SpatialDrawRenderer(scene);
        
        this.drawingManager = new DrawingManager(scene, this.threejsWorker.camera); 
     }

}

const spatialDrawWorker = new SpatialDrawWorker();
