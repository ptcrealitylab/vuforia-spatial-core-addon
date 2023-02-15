import {ThreejsInterface} from "/objectDefaultFiles/ThreejsInterface.js"

/**
 * @typedef {import("../../../../libraries/objectDefaultFiles/object.js").SpatialInterface} SpatialInterface
 */

class SimpleModelInterface {
    constructor() {
        console.log("tool is in a secure context: " + isSecureContext + " and isolated: " + crossOriginIsolated);
        this.worker = new Worker("SimpleModelWorker.js", {type: "module"});
        this.synclock = null;
		this.worker.onmessage = (event) => this.onMessageFromWorker(event);
        this.spatialInterface = new SpatialInterface();
        this.threejsInterface = new ThreejsInterface(this.spatialInterface, this.worker);

        this.spatialInterface.onSpatialInterfaceLoaded(this.onSpatialInterfaceLoaded.bind(this));
    }

    onSpatialInterfaceLoaded() {
        this.spatialInterface.setVisibilityDistance(100);

        this.spatialInterface.addGroundPlaneMatrixListener(this.groundPlaneCallback.bind(this));
        // whenever we receive new matrices from the editor, update the 3d scene
        this.spatialInterface.addMatrixListener(this.modelViewCallback.bind(this));

        this.spatialInterface.setMoveDelay(300);
    }

    /**
     * 
     * @param {Float32Array} modelViewMatrix 
     * @param {Float32Array} _projectionMatrix 
     */
    groundPlaneCallback(modelViewMatrix, _projectionMatrix) {
        this.worker.postMessage({ name: "groundPlaneCallback", modelViewMatrix: modelViewMatrix});
    }

    /**
     * 
     * @param {Float32Array} modelViewMatrix 
     * @param {Float32Array} _projectionMatrix 
     */
    modelViewCallback(modelViewMatrix, _projectionMatrix) {
        this.worker.postMessage({ name: "modelViewCallback", modelViewMatrix: modelViewMatrix})
    }

    /**
     * 
     * @param {MessageEvent} event 
     */
	onMessageFromWorker(event) {
		this.threejsInterface.onMessageFromWorker(event);
	}

    /**
     * 
     * @param {MessageEvent} event 
     */
    onMessageFromServer(event) {
        this.threejsInterface.onMessageFromServer(event);

    }
}

const simpleModelInterface = new SimpleModelInterface();

self.onmessage = (event) => simpleModelInterface.onMessageFromServer(event);
