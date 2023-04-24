import {AFrameWorker, setMatrixFromArray} from '/objectDefaultFiles/AFrameWorker.js';
import * as THREE from '/objectDefaultFiles/three/three.module.js'; 

/**
 * tool specific rendering code for A-Frame
 */
class AFrameSimpleModelWorker {
    constructor() {
        console.log('worker is in a secure context: ' + isSecureContext + ' and isolated: ' + crossOriginIsolated);
        this.threejsWorker = new AFrameWorker();
        this.threejsWorker.onSceneCreated(this.onSceneCreated.bind(this));
        // the tool doesn't us the onRender callback
        this.mainContainerObj = null;
        this.groundPlaneContainerObj = null;
        this.isGroundPlaneFound = false;
    }

    /**
     * called when the webworker receives a message
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
        if (message.hasOwnProperty('name')) {
            if ((message.name === 'groundPlaneCallback') && (this.groundPlaneContainerObj !== null)) {
                setMatrixFromArray(this.groundPlaneContainerObj.matrix, message.modelViewMatrix);
                if (!this.isGroundPlaneFound) {
                    this.isGroundPlaneFound = true;
                }
            } else if ((message.name === 'modelViewCallback') ) {
                if (this.threejsWorker.isProjectionMatrixSet && this.isGroundPlaneFound) {
                    setMatrixFromArray(this.mainContainerObj.matrix, message.modelViewMatrix);  // update model view matrix
                }
            }
        }
    }

    /**
     * called when a scene is created and the tool can start populating the A-Frame scene
     * @param {THREE.Scene} scene 
     */
    onSceneCreated(scene) {
        // create a parent 3D object to contain all the A-Frame objects
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

const aframeSimpleModelWorker = new AFrameSimpleModelWorker();

// send all messages directly to the tool code
self.onmessage = (event) => aframeSimpleModelWorker.onMesageFromInterface(event);
