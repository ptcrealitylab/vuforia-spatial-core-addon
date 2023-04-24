import {BabylonjsWorker, setMatrixFromArray} from '/objectDefaultFiles/BabylonjsWorker.js';
import  '/objectDefaultFiles/babylon/babylon.max.js'; 

/**
 * tool specific rendering code for Babylon.js
 */
class BabylonjsSimpleModelWorker {
    constructor() {
        console.log('worker is in a secure context: ' + isSecureContext + ' and isolated: ' + crossOriginIsolated);
        this.babylonjsWorker = new BabylonjsWorker();
        this.babylonjsWorker.onSceneCreated(this.onSceneCreated.bind(this));
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
        this.babylonjsWorker.onMessageFromInterface(event);
        const message = event.data;
        if (!message) {
            return;
        }
        if (typeof message !== 'object') {
            return;
        }
        if (message.hasOwnProperty('name')) {
            if ((message.name === 'groundPlaneCallback') && (this.groundPlaneContainerObj !== null)) {
                let matrix = new BABYLON.Matrix();
                setMatrixFromArray(matrix, message.modelViewMatrix);
                this.groundPlaneContainerObj = matrix;
                if (!this.isGroundPlaneFound) {
                    this.isGroundPlaneFound = true;
                }
            } else if ((message.name === 'modelViewCallback') ) {
                if (this.babylonjsWorker.isProjectionMatrixSet && this.isGroundPlaneFound) {
                    setMatrixFromArray(this.mainContainerObj._localMatrix, message.modelViewMatrix);  // update model view matrix
                }
            }
        }
    }

    /**
     * called when a scene is created and the tool can start populating the A-Frame scene
     * @param {BABYLON.Scene} scene 
     */
    onSceneCreated(scene) {
        // create a parent 3D object to contain all the A-Frame objects
        // we can apply the marker transform to this object and all of its
        // children objects will be affected
        this.mainContainerObj = new BABYLON.Mesh('mainContainerObj', scene);
        this.mainContainerObj.isVisibale = false;

        this.groundPlaneContainerObj = new BABYLON.Mesh('groundPlaneContainerObj', scene);
        this.groundPlaneContainerObj.isVisibale = false;

        this.groundPlaneContainerObj.addChild(BABYLON.MeshBuilder.CreateBox("box", {size: 200, faceColors: new BABYLON.Color4(0.66, 0.66, 0.66, 1)}, scene));
    }
}

const babylonjsSimpleModelWorker = new BabylonjsSimpleModelWorker();

// send all messages directly to the tool code
self.onmessage = (event) => babylonjsSimpleModelWorker.onMesageFromInterface(event);
