import {ThreejsWorker, setMatrixFromArray} from '/objectDefaultFiles/ThreejsWorker.js';
import {MessageInterface} from '/objectDefaultFiles/WorkerFactory.js';
import {WebGLStrategy} from '/objectDefaultFiles/glCommandBuffer.js';
import * as THREE from '/objectDefaultFiles/three/three.module.js'; 

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

        if (message.hasOwnProperty("drawingManager")) {
            const drawingMessage = message.drawingManager;
            if (drawingMessage.hasOwnProperty("name")) {
                if (drawingMessage.name === "setVisible") {
                    if (this.renderer !== null) {
                        this.renderer.setVisible(drawingMessage.visible);
                    }
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
     }

}

const spatialDrawWorker = new SpatialDrawWorker();
