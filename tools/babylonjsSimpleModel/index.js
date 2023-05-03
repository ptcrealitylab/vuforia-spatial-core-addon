import {BabylonjsInterface} from '/objectDefaultFiles/BabylonjsInterface.js'
import '/objectDefaultFiles/object.js'

/**
 * @typedef {import('../../../../libraries/objectDefaultFiles/object.js').SpatialInterface} SpatialInterface
 */

/**
 * code that mediates between the BabylonjsInterface, SpatialInterface and the webworker
 */
class BabylonjsSimpleModelInterface {
    constructor() {
        console.log('tool is in a secure context: ' + isSecureContext + ' and isolated: ' + crossOriginIsolated);
        this.synclock = null;
        this.spatialInterface = new SpatialInterface();
        this.babylonjsInterface = new BabylonjsInterface(this.spatialInterface, 'BabylonjsSimpleModelWorker.js');
        this.workerMessageInterface = this.babylonjsInterface.getWorkerMessageInterface();
        this.workerMessageInterface.setOnMessage(this.onMessageFromWorker.bind(this));

        this.spatialInterface.onSpatialInterfaceLoaded(this.onSpatialInterfaceLoaded.bind(this));
    }

    /**
     * called when the spatial interface has been loaded, to finish it's configuration
     */
    onSpatialInterfaceLoaded() {
        this.spatialInterface.setVisibilityDistance(100);

        this.spatialInterface.addGroundPlaneMatrixListener(this.groundPlaneCallback.bind(this));
        // whenever we receive new matrices from the editor, update the 3d scene
        this.spatialInterface.addMatrixListener(this.modelViewCallback.bind(this));

        this.spatialInterface.setMoveDelay(300);
    }

    /**
     * called when the ground plane is initialized
     * @param {Float32Array} modelViewMatrix 
     * @param {Float32Array} _projectionMatrix 
     */
    groundPlaneCallback(modelViewMatrix, _projectionMatrix) {
        this.workerMessageInterface.postMessage({ name: 'groundPlaneCallback', modelViewMatrix: modelViewMatrix});
    }

    /**
     * called when the position of the tool changes
     * @param {Float32Array} modelViewMatrix 
     * @param {Float32Array} _projectionMatrix 
     */
    modelViewCallback(modelViewMatrix, _projectionMatrix) {
        this.workerMessageInterface.postMessage({ name: 'modelViewCallback', modelViewMatrix: modelViewMatrix})
    }

    /**
     * send all messages from the worker to the server
     * tool writers can use this to intercept messages
     * @param {MessageEvent} event 
     */
	onMessageFromWorker(event) {
		this.babylonjsInterface.onMessageFromWorker(event);
	}

    /**
     * send all messages from the server to the ThreejsInterface
     * tool writers can use this to intercept messages
     * @param {MessageEvent} event 
     */
    onMessageFromServer(event) {
        this.babylonjsInterface.onMessageFromServer(event);

    }
}

const babylonjsSimpleModelInterface = new BabylonjsSimpleModelInterface();

// send mesages from the server to the tool class
self.onmessage = (event) => babylonjsSimpleModelInterface.onMessageFromServer(event);
