import {ThreejsInterface} from '/objectDefaultFiles/ThreejsInterface.js'

class DrawingProxy {
    /**
     * 
     * @param {ThreejsInterface} threejsInterface 
     */
    constructor(threejsInterface) {
        this.threejsInterface = threejsInterface;
        this.workerMessageInterface = threejsInterface.getWorkerMessageInterface();
    }

    /**
     * 
     * @param {boolean} visible 
     */
    setVisible(visible) {
        this.workerMessageInterface.postMessage({drawingManager: {name: "setVisible", visible: visible}});
    }
}

export {DrawingProxy};
