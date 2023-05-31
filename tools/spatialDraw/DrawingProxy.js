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
     * @param {Object} message 
     */
    postMessage(message) {
        this.workerMessageInterface.postMessage({drawingManager: message});
    }

    /**
     * 
     * @param {boolean} visible 
     */
    setVisible(visible) {
        this.postMessage({name: "setVisible", visible: visible});
    }

    deserializeDrawing(drawing) {
        this.postMessage({name: "deserializeDrawing", drawing: drawing});
    }

    /**
     * 
     * @param {number} size 
     */
    setSize(size) {
        this.postMessage({name: "setSize", size: size});
    }

    /**
     * 
     * @param {string} color 
     */
    setColor(color) {
        this.postMessage({name: "setColor", color: color});
    }

    /**
     * 
     * @param {boolean} value 
     */
    setEraseMode(value) {
        this.postMessage({name: "setEraseMode", value: value});
    }

    popUndoEvent() {
        this.postMessage({name: "popUndoEvent"});
    }

    /**
     * 
     * @param {string} cursorName 
     */
    setCursor(cursorName) {
        this.postMessage({name: "setCursor", cursorName: cursorName});
    }

    /**
     * 
     * @param {string} toolName 
     */
    setTool(toolName) {
        this.postMessage({name: "setTool", toolName: toolName});
    }

    /**
     * 
     * @param {string} iconName 
     */
    setIcon(iconName) {
        this.postMessage({name: "setIcon", iconName: iconName});
    }

    enableInteractions() {
        this.postMessage({name: "enableInteractions"});
    }

    disableInteractions() {
        this.postMessage({name: "disableInteractions"});
    }


}

export {DrawingProxy};
