import {ThreejsWorker, setMatrixFromArray} from "/objectDefaultFiles/ThreejsWorker.js";
import * as THREE from '/objectDefaultFiles/three/three.module.js'; 

class SimpleModelWorker {
    constructor() {
        console.log("worker is in a secure context: " + isSecureContext + " and isolated: " + crossOriginIsolated);
        this.threejsWorker = new ThreejsWorker();
        this.threejsWorker.onSceneCreated(this.onSceneCreated.bind(this));
        this.mainContainerObj = null;
        this.groundPlaneContainerObj = null;
        this.isGroundPlaneFound = false;
    }

    /**
     * 
     * @param {MessageEvent<any>} event 
     */
    onMesageFromInterface(event) {
        this.threejsWorker.onMessageFromInterface(event);
        const message = event.data;
        if (!message) {
            return;
        }
        if (typeof message !== 'object') {
            return;
        }
        if (message.hasOwnProperty("name")) {
            if ((message.name === "groundPlaneCallback") && (this.groundPlaneContainerObj !== null)) {
                setMatrixFromArray(this.groundPlaneContainerObj.matrix, message.modelViewMatrix);
                if (!this.isGroundPlaneFound) {
                    this.isGroundPlaneFound = true;
                }
            } else if ((message.name === "modelViewCallback") ) {
                if (this.threejsWorker.isProjectionMatrixSet && this.isGroundPlaneFound) {
                    setMatrixFromArray(this.mainContainerObj.matrix, message.modelViewMatrix);  // update model view matrix
                }
            }
        }
    }

    /**
     * 
     * @param {THREE.Scene} scene 
     */
    onSceneCreated(scene) {
        // create a parent 3D object to contain all the three js objects
        // we can apply the marker transform to this object and all of its
        // children objects will be affected
        this.mainContainerObj = new THREE.Object3D();
        this.mainContainerObj.matrixAutoUpdate = false;
        this.mainContainerObj.name = 'mainContainerObj';
        scene.add(this.mainContainerObj);

        this.groundPlaneContainerObj = new THREE.Object3D();
        this.groundPlaneContainerObj.matrixAutoUpdate = false;
        this.groundPlaneContainerObj.name = 'groundPlaneContainerObj';
        scene.add(this.groundPlaneContainerObj);

        this.groundPlaneContainerObj.add(new THREE.Mesh(new THREE.BoxGeometry(200, 200, 200),
        new THREE.MeshBasicMaterial({color: 0xaaaaaa})));
    }
}

const simpleModelWorker = new SimpleModelWorker();

self.onmessage = (event) => simpleModelWorker.onMesageFromInterface(event);
