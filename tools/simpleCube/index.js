import '/objectDefaultFiles/object.js'

/**
 * @typedef {import('./object.js').SpatialInterface} SpatialInterface
 */

/**
 * mediates betweeen the server, SpatialInterfae and the webworker
 */
class SimpleCubeInterface {
    /**
     * 
     * @param {SpatialInterface} spatialInterface 
     */
    constructor(spatialInterface) {
        console.log('tool is in a secure context: ' + isSecureContext + ' and isolated: ' + crossOriginIsolated);
        this.spatialInterface = spatialInterface;
        this.prefersAttachingToWorld = true;
        this.pendingLoads = 0;
        this.done = false;

        this.onSpatialInterfaceLoaded = this.onSpatialInterfaceLoaded.bind(this);
        this.anchoredModelViewCallback = this.anchoredModelViewCallback.bind(this);

        this.spatialInterface.onSpatialInterfaceLoaded(this.onSpatialInterfaceLoaded);

        this.worker = new Worker('SimpleCubeWorker.js', {type: 'module'});
        this.worker.onmessage = (event) => {
            window.parent.postMessage(event.data, '*');
        }
    }

    /**
     * finishes the initialisation after the spatialinterface is done loading
     */
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
     * send all messages from the server directly to the webworker
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

// initialize SpatialInterface
if (!spatialInterface) {
    spatialInterface = new SpatialInterface();
    spatialInterface.useWebGlWorker();
}

// initialize tool code
let simpleCubeInterface = new SimpleCubeInterface(spatialInterface);
simpleCubeInterface.addPendingLoad();

/**
 * called to setup the projection matrix
 * @param {Float32Array} modelViewMatrix 
 * @param {Float32Array} _projectionMatrix 
 */
function groundPlaneCallback(modelViewMatrix, _projectionMatrix) {
    if (!isGroundPlaneFound) {
        isGroundPlaneFound = true;
        simpleCubeInterface.worker.postMessage({name: 'setProjectionMatrix', matrix: _projectionMatrix});
    }
}

/**
 * called when the world origin changes, the location of the tool it self in the scene changes
 * @param {Float32Array} modelViewMatrix 
 * @param {Float32Array} _projectionMatrix 
 */
function modelViewCallback(modelViewMatrix, _projectionMatrix) {
    if (isGroundPlaneFound) {
        simpleCubeInterface.worker.postMessage({name: 'setWorldMatrix', matrix: modelViewMatrix});
    }
}

function createWorld() {
    simpleCubeInterface.removePendingLoad();
}

/**
 * receives mesages from the server
 */
window.addEventListener('message', function(event) {
    const message = event.data;
    if (!message) {
        if (debugGlWorker) console.warn('Event missing data', message);
        return;
    }
    if (typeof message !== 'object') {
        return;
    }
    if (message.hasOwnProperty('name')) {
        // intercept bootstrap messages to finish intialisation of the client
        if (message.name === 'bootstrap') {
            let {width, height} = message;
            spatialInterface.changeFrameSize(width, height);
            this.synclock = message.synclock;
        }
    }
    // pass all messages to the tool code
    simpleCubeInterface.onMessage(event);
});
