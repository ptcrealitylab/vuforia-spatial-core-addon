import {ThreejsInterface} from '/objectDefaultFiles/ThreejsInterface.js'
import {DrawingProxy} from './DrawingProxy.js'
import '/objectDefaultFiles/object.js'
import '/objectDefaultFiles/envelope.js'

/**
 * @typedef {import('../../../../libraries/objectDefaultFiles/object.js').SpatialInterface} SpatialInterface
 * @typedef {import('../../../../libraries/objectDefaultFiles/envelope.js').Envelope} Envelope
 */

class SpatialDrawInterface {
    constructor() {
        this.spatialInterface = new SpatialInterface();
        this.threejsInterface = new ThreejsInterface(this.spatialInterface, 'SpatialDrawWorker.js');
        this.workerMessageInterface = this.threejsInterface.getWorkerMessageInterface();
        this.workerMessageInterface.setOnMessage(this.onMessageFromWorker.bind(this));

        /**
         * @type {HTMLDivElement}
         */
        this.launchButton = this.getDivByQuery('#launchButton');

        /**
         * @type {HTMLDivElement}
         */
        this.ui = this.getDivByQuery('#ui');

        /**
         * @type {Array<HTMLDivElement>}
         */
        this.cursorMenuOptions = this.getDivByQueryAll('.cursor');

         /**
         * @type {HTMLDivElement}
         */
         this.iconMenu = this.getDivByQuery('.iconMenu');

         /**
          * @type {HTMLDivElement}
          */
         this.iconMenuPopout = this.getDivByQuery('.iconMenuPopout');

        /**
         * @type {Array<HTMLDivElement>}
         */
        this.iconCircles = this.getDivByQueryAll('.icon');

        /**
         * @type {Array<HTMLDivElement>}
         */
        this.sizeCircles = this.getDivFromUI('size');

        /**
         * @type {Array<HTMLDivElement>}
         */
        this.colorCircles = this.getDivFromUI('color');

        /**
         * @type {HTMLDivElement}
         */
        this.eraseCircle = this.getDivFromUI('erase')[0];

        /**
         * @type {HTMLDivElement}
         */
        this.undoCircle = this.getDivFromUI('undo')[0];

       
        this.loadedDrawing = null;

        /**
         * @type {boolean}
         */
        this.rendererStarted = false;

        /**
         * @type {boolean}
         */
        this.initializedApp = false;

        /**
         * @type {boolean}
         */
        this.appActive = false;

        /**
         * @type {number}
         */
        this.lastSync = 0;

        const isStackable = true;
        const areFramesOrdered = false;
        const isFullscreenFull2D = false;
        const opensWhenAdded = true;
        /**
         * @type {Envelope}
         */
        this.envelope = new Envelope(this.spatialInterface, [], uiParent, launchButton, isStackable, areFramesOrdered, isFullscreenFull2D, opensWhenAdded);

         /**
         * @type {DrawingProxy}
         */
         this.drawingManager = new DrawingProxy(this.threejsInterface);

        this.spatialInterface.setAlwaysFaceCamera(true);
        this.spatialInterface.wasToolJustCreated(justCreated => {
            if (justCreated) {
                this.launchButton.hidden = true; // Hide the launch button when automatically launching to avoid confusing the user.
                // envelope will open automatically, so no need to call envelope.open() here
            }
        });

        this.spatialInterface.initNode('storage', 'storeData');
        this.spatialInterface.addReadPublicDataListener('storage', 'drawing', drawing => {
            if (this.initializedApp && drawing.time > this.lastSync) {
                this.lastSync = drawing.time;
                this.drawingManager.deserializeDrawing(drawing);
            } else {
                this.loadedDrawing = drawing;
            }
        });

        this.launchButton.addEventListener('pointerup', () => {
            this.envelope.open();
        }, false);

        // add random init gradient for the tool icon
        const randomDelay = -Math.floor(Math.random() * 100);
        this.launchButton.style.animationDelay = `${randomDelay}s`;

        this.sizeCircles.forEach((circle, i) => {
            circle.setColor = (color) => {
                Array.from(circle.children)[0].setAttribute('fill', color);
            };
            circle.addEventListener('pointerdown', e => {
                e.stopPropagation();
                const nextCircle = this.sizeCircles[(i + 1) % this.sizeCircles.length];
                this.drawingManager.setSize(nextCircle.dataset.size);
            });
        });
        this.colorCircles.forEach(circle => {
            circle.style.backgroundColor = circle.dataset.color;
            circle.addEventListener('pointerdown', e => {
                e.stopPropagation();
                if (!circle.dataset.color) throw Error("circle dataset has no color property");
                this.drawingManager.setColor(circle.dataset.color);
            });
        });
        this.eraseCircle.addEventListener('pointerdown', e => {
            e.stopPropagation();
            this.colorCircles.forEach(colorCircle => colorCircle.classList.remove('active'));
            this.eraseCircle.classList.add('active');
            this.drawingManager.setEraseMode(true);
        });
        this.undoCircle.addEventListener('pointerdown', e => {
            e.stopPropagation();
            this.undoCircle.classList.add('active');
            setTimeout(() => this.undoCircle.classList.remove('active'), 150);
            this.drawingManager.popUndoEvent();
        });
        this.cursorMenuOptions.forEach(cursorMenuOption => {
            cursorMenuOption.addEventListener('pointerdown', e => {
                e.stopPropagation();
                this.drawingManager.setCursor(cursorMenuOption.dataset.cursor);
            });
        });
       
        this.iconMenu.addEventListener('pointerdown', e => {
            e.stopPropagation();
            this.iconMenuPopout.classList.toggle('active');
            if (!this.iconMenuPopout.classList.contains('active')) {
                this.drawingManager.setTool('LINE');
            }
        });
        this.iconCircles.forEach(iconCircle => {
            iconCircle.addEventListener('pointerdown', e => {
                e.stopPropagation();
                this.drawingManager.setIcon(iconCircle.dataset.icon);
            });
        });

        this.envelope.onOpen(() => {
            this.launchButton.hidden = false;
            this.spatialInterface.setAlwaysFaceCamera(false);
            if (!this.rendererStarted) {
                if (this.loadedDrawing) {
                    this.drawingManager.deserializeDrawing(this.loadedDrawing);
                    this.loadedDrawing = null;
                }
                this.appActive = true;
                this.drawingManager.setVisible(true);
            } else {
                this.drawingManager.enableInteractions();
                this.appActive = true;
                this.drawingManager.setVisible(true);
            }
        });
        this.envelope.onClose(() => {
            // we don't need to location.reload() here if we properly reset the state
            this.launchButton.hidden = false;
            this.spatialInterface.unregisterTouchDecider();
            this.spatialInterface.setAlwaysFaceCamera(true);
            this.drawingManager.disableInteractions();
            this.appActive = false;
            this.drawingManager.setVisible(false);
        });
        this.envelope.onBlur(() => {
            console.log('spatialDraw envelope.onBlur');
        
            // hide the 2D UI
            this.ui.style.display = 'none';
        });
        this.envelope.onFocus(() => {
            console.log('spatialDraw envelope.onFocus');
            
            // show the UI
            this.ui.style.display = '';
        });

        this.resetScroll();

        this.spatialInterface.onSpatialInterfaceLoaded(() => {
            this.spatialInterface.subscribeToMatrix();
            this.spatialInterface.addGroundPlaneMatrixListener(this.groundPlaneCallback.bind(this));
            this.spatialInterface.addMatrixListener(this.updateMatrices.bind(this)); // whenever we receive new matrices from the editor, update the 3d scene
            this.spatialInterface.registerTouchDecider(this.touchDecider.bind(this));
        });

        document.addEventListener('pointerdown', e => {
            if (e.button === 0) {
                this.drawingManager.onPointerDown({pageX: e.pageX, pageY: e.pageY, type: "pointerdown", innerWidth: window.innerWidth, innerHeight: window.innerHeight, projectedZ: e.projectedZ, worldIntersectPoint: e.worldIntersectPoint});
            }
        });
        document.addEventListener('pointermove', e => {
            this.drawingManager.onPointerMove({pageX: e.pageX, pageY: e.pageY, type: "pointermove", innerWidth: window.innerWidth, innerHeight: window.innerHeight, projectedZ: e.projectedZ, worldIntersectPoint: e.worldIntersectPoint});
        });
        document.addEventListener('pointerup', e => {
            if (e.button === 0) {
                this.drawingManager.onPointerUp({pageX: e.pageX, pageY: e.pageY, type: "pointerup", innerWidth: window.innerWidth, innerHeight: window.innerHeight, projectedZ: e.projectedZ, worldIntersectPoint: e.worldIntersectPoint});
            }
        });

        this.initializedApp = true;
    }

    // Gets passed eventData if needed
    touchDecider(eventData) {
        return this.appActive;
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
     * @param {Float32Array} projectionMatrix 
     */
    updateMatrices(modelViewMatrix, projectionMatrix) {
        this.workerMessageInterface.postMessage({ name: 'updateMatrices', modelViewMatrix: modelViewMatrix, projectionMatrix: projectionMatrix})
    }

    /**
     * seraches the page for a div element and throws an error if it can't be found
     * @param {string} query 
     * @returns {HTMLDivElement}
     */
    getDivByQuery(query) {
        /**
         * @type {Element|null}
         */
        const elem = document.querySelector(query);

        if (!(elem instanceof HTMLDivElement)) {
            throw new Error(`${query} missing`);
        }
        return elem;
    }

    /**
     * get a list of div elements on the page and throws an error when none are found
     * @param {string} query 
     * @returns {Array<HTMLDivElement>}
     */
    getDivByQueryAll(query) {
        /**
         * @type {Array<Element>}
         */
        const elem = Array.from(document.querySelectorAll(query));

        /**
         * @type {Array<HTMLDivElement>}
         */
        const htmlElem = [];
        elem.forEach(entry => {
            if (entry instanceof HTMLDivElement) {
                htmlElem.push(entry);
            }
        });

        if (htmlElem.length == 0) {
            throw new Error(`${query} missing`);
        }
        return htmlElem;
    }

    /**
     * get a list of div elements from the ui and throws an error if none are found
     * @param {string} className 
     */
    getDivFromUI(className) {
         /**
         * @type {Array<Element>}
         */
         const elem = Array.from(this.ui.children).filter(child => child.classList.contains(className));

         /**
          * @type {Array<HTMLDivElement>}
          */
         const htmlElem = [];
         elem.forEach(entry => {
             if (entry instanceof HTMLDivElement) {
                 htmlElem.push(entry);
             }
         });
 
         if (htmlElem.length == 0) {
             throw new Error(`${className} missing in ui`);
         }
         return htmlElem;
    }

    /**
     * send all messages from the worker to the server
     * tool writers can use this to intercept messages
     * @param {MessageEvent} event 
     */
	onMessageFromWorker(event) {
        const message = event.data;
        if (message.hasOwnProperty("drawingManager")) {
            if (message.drawingManager.hasOwnProperty("name")) {
                if (message.drawingManager.name === "update") {
                    this.spatialInterface.writePublicData('storage', 'drawing', message.drawingManager.drawingData);
                } else if (message.drawingManager.name === "size") {
                    this.sizeCircles.forEach(sizeCircle => sizeCircle.classList.remove('active'));
                    const nextCircle = this.sizeCircles.find(circle => circle.dataset.size === `${message.drawingManager.size}`);
                    nextCircle.classList.add('active'); // Activates
                } else if (message.drawingManager.name === "color") {
                    this.sizeCircles.forEach(sizeCircle => sizeCircle.setColor(message.drawingManager.color));
                    this.colorCircles.forEach(colorCircle => colorCircle.classList.remove('active'));
                    this.colorCircles.find(circle => circle.dataset.color === message.drawingManager.color).classList.add('active');
                } else if (message.drawingManager.name === "eraseMode") {
                    if (message.drawingManager.eraseMode) {
                        this.eraseCircle.classList.add('active');
                    } else {
                        this.eraseCircle.classList.remove('active');
                    }
                } else if (message.drawingManager.name === "cursor") {
                    this.cursorMenuOptions.forEach(option => option.classList.remove('active'));
                    this.cursorMenuOptions.find(option => message.drawingManager.cursorName === option.dataset.cursor).classList.add('active');
                } else if (message.drawingManager.name === "icon") {
                    this.iconCircles.forEach(iconCircle => iconCircle.classList.remove('active'));
                    this.iconCircles.find(iconCircle => message.drawingManager.iconName === iconCircle.dataset.icon).classList.add('active');
                } else if (message.drawingManager.name === "tool") {
                    if (message.drawingManager.toolName === 'ICON') {
                        this.iconMenu.classList.add('active');
                    } else {
                        this.iconCircles.forEach(iconCircle => iconCircle.classList.remove('active'));
                        this.iconMenu.classList.remove('active');
                    }
                }
            }
        }
		this.threejsInterface.onMessageFromWorker(event);
	}

    /**
     * send all messages from the server to the ThreejsInterface
     * tool writers can use this to intercept messages
     * @param {MessageEvent} event 
     */
    onMessageFromServer(event) {
        this.threejsInterface.onMessageFromServer(event);

    }

    resetScroll() {
        if (window.scrollX !== 0 || window.scrollY !== 0) {
            window.scrollTo(0, 0); // don't let keyboard events scroll the window
        }
        parent.postMessage(JSON.stringify({resetScroll: true}), '*');
    }
}

const spatialDrawInterface = new SpatialDrawInterface();

// send mesages from the server to the tool class
self.onmessage = (event) => spatialDrawInterface.onMessageFromServer(event);
