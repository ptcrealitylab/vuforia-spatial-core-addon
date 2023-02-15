/**
 * @typedef {import("./object.js").SpatialInterface} SpatialInterface
 */

class SimpleCubeInterface {
    /**
     * 
     * @param {SpatialInterface} spatialInterface 
     */
    constructor(spatialInterface) {
        console.log("tool is in a secure context: " + isSecureContext + " and isolated: " + crossOriginIsolated);
        this.spatialInterface = spatialInterface;
        this.prefersAttachingToWorld = true;
        this.pendingLoads = 0;
        this.done = false;

        this.onSpatialInterfaceLoaded = this.onSpatialInterfaceLoaded.bind(this);
        this.anchoredModelViewCallback = this.anchoredModelViewCallback.bind(this);

        this.spatialInterface.onSpatialInterfaceLoaded(this.onSpatialInterfaceLoaded);

        this.worker = new Worker("SimpleCubeWorker.js", {type: "module"});
        this.worker.onmessage = (event) => {
            window.parent.postMessage(event.data, "*");
        }
    }

    onSpatialInterfaceLoaded() {
        this.spatialInterface.subscribeToMatrix();
        this.spatialInterface.setFullScreenOn();

        if (this.prefersAttachingToWorld) {
            this.spatialInterface.prefersAttachingToWorld();
        }

        this.spatialInterface.addAnchoredModelViewListener(this.anchoredModelViewCallback);

        this.spatialInterface.setMoveDelay(300);

        this.spatialInterface.setVisibilityDistance(100);
        this.spatialInterface.addGroundPlaneMatrixListener(groundPlaneCallback);
        this.spatialInterface.addMatrixListener(modelViewCallback);

        //this.removePendingLoad();
    }

    addPendingLoad() {
        this.pendingLoads += 1;
    }

    removePendingLoad() {
        this.pendingLoads -= 1;
    }

    anchoredModelViewCallback(modelViewMatrix, projectionMatrix) {
    }

    /**
     * 
     * @param {MessageEvent} event 
     * @returns 
     */
    onMessage(event) {
        this.worker.postMessage(event.data);
    }
}

// Various threejs and gl proxy support variables
let mainContainerObj;
let groundPlaneContainerObj;
let spatialInterface;

let isGroundPlaneFound = false;

if (!spatialInterface) {
    spatialInterface = new SpatialInterface();
    spatialInterface.useWebGlWorker();
}

let simpleCubeInterface = new SimpleCubeInterface(spatialInterface);
simpleCubeInterface.addPendingLoad();

function groundPlaneCallback(modelViewMatrix, _projectionMatrix) {
    if (!isGroundPlaneFound) {
        isGroundPlaneFound = true;
        simpleCubeInterface.worker.postMessage({name: "setProjectionMatrix", matrix: _projectionMatrix});
    }
}

function modelViewCallback(modelViewMatrix, _projectionMatrix) {
    if (isGroundPlaneFound) {
        simpleCubeInterface.worker.postMessage({name: "setWorldMatrix", matrix: modelViewMatrix});
    }
}

function createWorld() {
    simpleCubeInterface.removePendingLoad();
}

window.addEventListener('message', function(event) {
    const message = event.data;
    if (!message) {
        if (debugGlWorker) console.warn('Event missing data', message);
        return;
    }
    if (typeof message !== 'object') {
        return;
    }
    if (message.hasOwnProperty("name")) {
        if (message.name === "bootstrap") {
            let {width, height} = message;
            spatialInterface.changeFrameSize(width, height);
            this.synclock = message.synclock;
        }
    }
    simpleCubeInterface.onMessage(event);
});
