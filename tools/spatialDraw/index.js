/* global DrawingManager, realGl, gl, proxies */

gl.enableWebGL2 = false;

let drawingManager;
let loadedDrawing;
let initializedApp = false;
let appActive = false;
let lastSync = 0;

// Various threejs and gl proxy support variables
let realRenderer, renderer;
let camera, scene;
let mainContainerObj;
let groundPlaneContainerObj;
let spatialInterface;

let rendererWidth;
let rendererHeight;
let aspectRatio;

let lastProjectionMatrix = null;
let lastModelViewMatrix = null;
let isProjectionMatrixSet = false;
let done = false; // used by gl renderer

let mainData = {
    width: 0,
    height: 0
};

let rendererStarted = false;

// eslint-disable-next-line no-undef
main = ({width, height}) => {
    mainData.width = width;
    mainData.height = height;
};

if (!spatialInterface) {
    spatialInterface = new SpatialInterface();
}

let languageInterface = null;

function setupAPI() {
    const api = new SpatialApplicationAPI('spatialDraw', spatialObject.object, spatialObject.frame);

    api.defineAPI('addLine', [
        {name: 'startPoint', type: 'Point', description: 'Start point of the line'},
        {name: 'endPoint', type: 'Point', description: 'End point of the line'},
        {name: 'color', type: 'String', description: 'Color of the line'}
    ], {
        type: 'boolean',
        description: 'Draws a line on the canvas; returns success or error'
    }, (startPoint, endPoint, color) => {
        console.log('>> spatialDraw addLine', startPoint, endPoint, color);
        drawingManager.apiDrawLine(startPoint, endPoint, color);
        return true;
    });

    api.defineAPI('drawMultipointPath', [
        {name: 'points', type: 'Point[]', description: 'Array of points'},
        {name: 'color', type: 'String', description: 'Color of the path'}
    ], {
        type: 'boolean',
        description: 'Draws a colored path on the canvas, starting at the first point in the array and connected piecewise until reaching the last point in the array; returns success or error'
    }, (points, color) => {
        console.log('>> spatialDraw drawMultipointPath', color);
        drawingManager.apiDrawPath(points, color);
        return true;
    });

    api.defineAPI('clearCanvas', [
        // no parameters
    ], {
        type: 'boolean',
        description: 'Erases all drawings, resetting the canvas to an empty state; returns success or error'
    }, () => {
        console.log('>> spatialDraw clearCanvas');
        drawingManager.apiClearCanvas();
        return true;
    });
    
    api.defineAPI('countLines', [
        // no parameters
    ], {
        type: 'number',
        description: 'Returns the number of visible strokes that users have drawn onto the canvas'
    }, () => {
        console.log('>> spatialDraw countLines');
        return drawingManager.apiCountLines();
    });

    api.sendAPIDefinitionsToParent();
    api.listenForCalls();

    languageInterface = new LanguageInterface('spatialDraw', spatialObject.object, spatialObject.frame);

    // TODO: populate these with correct data as the user draws into the scene
    // languageInterface.updateSummarizedState('numStrokes', 0);
    // languageInterface.updateSummarizedState('centroid', {x: 0, y: 0, z: 0});
    // languageInterface.updateSummarizedState('bbox', { min: {x: 0, y: 0, z: 0}, max: {x: 0, y: 0, z: 0} });
    // languageInterface.updateSummarizedState('colorsList', []);
    // languageInterface.sendSummarizedStateToParent();

    if (loadedDrawing) {
        let drawingCopy = copyDrawingForAiSummary(loadedDrawing);
        setTimeout(() => {
            // TODO: round the coordinates
            // TODO: try to normalize the coordinates
            languageInterface.updateStateToBeProcessedByAiPrompts('drawing', drawingCopy); // TODO: maybe we can dropout some of the intermediate points for high-density user-drawn paths
            languageInterface.sendAiProcessingStateToParent();
        }, 1000);
    }
    
    languageInterface.setStateToStringReducer((summarizedState) => {
        let contentsString = ' It is currently an empty canvas with no strokes drawn.';
        let distributionString = '';
        if (summarizedState.numStrokes > 0) {
            contentsString = ` It contains some content: currently, ${summarizedState.numStrokes} strokes have been drawn.`;

            let centroid = summarizedState.centroid;
            let bbox = summarizedState.bbox;
            let colorsList = summarizedState.colorsList;
            distributionString = ` The lines/strokes of the drawing seem to be clustered into ${summarizedState.numClusters} groups.
            The centroid of the drawings are at position (${centroid.x}, ${centroid.y}, ${centroid.z}).
            The bounding box of the drawings goes from (${bbox.min.x}, ${bbox.min.y}, ${bbox.min.z}) to (${bbox.max.x}, ${bbox.max.y}, ${bbox.max.z}).
            The colors used, from most to least frequent are: ${colorsList}.`;
        }
        return `This spatialDraw tool is a 3D drawing tool that allows users to annotate the 3D scene with sketches.${contentsString}${distributionString}`;
        
        // return `This is the data of the spatialDraw tool, a 3D drawing tool that allows users to annotate the 3D scene with sketches:\n${JSON.stringify(summarizedState.drawing)}`;
    });
    
    languageInterface.addAiStateProcessingPrompt(`Please analyze the following dataset, which is generated by a 3D drawing application, and try to determine some plain-English description of the shapes/geometry/content of the 3D drawing, as a human might perceive it (for example, if you were to narrate the contents of the drawing to a blind person for accessibility reasons).

Here is how to interpret the structure of the data. The top level "drawing" contains multiple strokes, each considered one of the child "drawings". A stroke begins with "putting the pen down" in the 3D space at the first of the "points" within the drawing. The points is a list of all of the subsequent positions that the pen moves to (while being pressed down / drawing a straight line from point Xn to point X(n+1)). At the final point in the list of points for a particular drawing (stroke), the pen is lifted from the 3D canvas and the completed stroke is displayed on the screen in the given color. The next "drawing" is unrelated to the previous drawing – they are considered separate strokes. It is possible that the start point of a subsequent drawing may align with the end point of a previous drawing, which will visually compose those drawings into a more complex path or shape, but it is also possible that the subsequent drawings are in a completely disconnected position and are unrelated to the previous drawings.

Some of the most commonly-drawn shapes that you might try to categorize these strokes as include: arrows (lines/curves with arrow-heads on one end), circles, squares, and X shapes (a cross of two short lines).

Please analyze this dataset and describe its contents.`);
    languageInterface.addAiStateProcessingPrompt(`
    I've asked another GPT agent to look at a dataset produced by a 3D drawing application and attempt to describe its contents to a blind audience. I will provide to you its output (delimited by -- characters):
    Can you "summarize" that description into an even shorter but higher-level description of the contents of the 3D line/path drawing application? For example, something akin to "it contains a red circle beside a green X, and far away there is a yellow square" but with more detail.
    --
    `);
    languageInterface.sendAiProcessingPromptsToParent();
}

function copyDrawingForAiSummary(drawing) {
    let newDrawing = JSON.parse(JSON.stringify(drawing));
    if (newDrawing.drawings) {
        newDrawing.drawings = newDrawing.drawings.map(drawing => {
            let newThisDrawing = JSON.parse(JSON.stringify(drawing));
            newThisDrawing.points.forEach(point => {
                point.x = Math.round(point.x) / 1000;
                point.y = Math.round(point.y) / 1000;
                point.z = Math.round(point.z) / 1000;
            });
            return newThisDrawing;
        });
    }
    return newDrawing;
}

spatialInterface.setMoveDelay(500);
spatialInterface.useWebGlWorker();
spatialInterface.setAlwaysFaceCamera(true);

spatialInterface.wasToolJustCreated(justCreated => {
    if (justCreated) {
        launchButton.hidden = true; // Hide the launch button when automatically launching to avoid confusing the user.
        // envelope will open automatically, so no need to call envelope.open() here
    }
});

spatialInterface.initNode('storage', 'storeData');
spatialInterface.addReadPublicDataListener('storage', 'drawing', function (drawing) {
    if (initializedApp && drawing.time > lastSync) {
        lastSync = drawing.time;
        drawingManager.deserializeDrawing(drawing);
    } else {
        loadedDrawing = drawing;
        if (languageInterface) {
            let drawingCopy = copyDrawingForAiSummary(loadedDrawing);
            setTimeout(() => {
                languageInterface.updateStateToBeProcessedByAiPrompts('drawing', drawingCopy);
                languageInterface.sendAiProcessingStateToParent();
            }, 1000);
        }
    }
});

const launchIcon = document.querySelector('#launchButton');
launchIcon.addEventListener('pointerup', function () {
    envelope.open();
}, false);

// add random init gradient for the tool icon
const randomDelay = -Math.floor(Math.random() * 100);
launchIcon.style.animationDelay = `${randomDelay}s`;

const launchButton = document.querySelector('#launchButton');
const uiParent = document.querySelector('#uiParent');
const ui = document.querySelector('#ui');
const sizeCircles = Array.from(ui.children).filter(child => child.classList.contains('size'));
sizeCircles.forEach((circle, i) => {
    circle.setColor = (color) => {
        Array.from(circle.children)[0].setAttribute('fill', color);
    };
    circle.addEventListener('pointerdown', e => {
        e.stopPropagation();
        const nextCircle = sizeCircles[(i + 1) % sizeCircles.length];
        drawingManager.setSize(nextCircle.dataset.size);
    });
});
const colorCircles = Array.from(ui.children).filter(child => child.classList.contains('color'));
const eraseCircle = Array.from(ui.children).filter(child => child.classList.contains('erase'))[0];
colorCircles.forEach(circle => {
    circle.style.backgroundColor = circle.dataset.color;
    circle.addEventListener('pointerdown', e => {
        e.stopPropagation();
        drawingManager.setColor(circle.dataset.color);
    });
});
eraseCircle.addEventListener('pointerdown', e => {
    e.stopPropagation();
    colorCircles.forEach(colorCircle => colorCircle.classList.remove('active'));
    eraseCircle.classList.add('active');
    drawingManager.setEraseMode(true);
});
const undoCircle = Array.from(ui.children).filter(child => child.classList.contains('undo'))[0];
undoCircle.addEventListener('pointerdown', e => {
    e.stopPropagation();
    undoCircle.classList.add('active');
    setTimeout(() => undoCircle.classList.remove('active'), 150);
    drawingManager.popUndoEvent();
});
const cursorMenuOptions = Array.from(document.querySelectorAll('.cursor'));
cursorMenuOptions.forEach(cursorMenuOption => {
    cursorMenuOption.addEventListener('pointerdown', e => {
        e.stopPropagation();
        drawingManager.setCursor(drawingManager.cursorMap[cursorMenuOption.dataset.cursor]);
    });
});

const iconMenu = document.querySelector('.iconMenu');
const iconMenuPopout = document.querySelector('.iconMenuPopout');
iconMenu.addEventListener('pointerdown', e => {
    e.stopPropagation();
    iconMenuPopout.classList.toggle('active');
    if (!iconMenuPopout.classList.contains('active')) {
        drawingManager.setTool(drawingManager.toolMap['LINE']);
    }
});
const iconCircles = Array.from(document.querySelectorAll('.icon'));
iconCircles.forEach(iconCircle => {
    iconCircle.addEventListener('pointerdown', e => {
        e.stopPropagation();
        drawingManager.setIcon(iconCircle.dataset.icon);
    });
});

const isStackable = true;
const areFramesOrdered = false;
const isFullscreenFull2D = false;
const opensWhenAdded = true;
const envelope = new Envelope(spatialInterface, [], uiParent, launchButton, isStackable, areFramesOrdered, isFullscreenFull2D, opensWhenAdded);
envelope.onOpen(() => {
    launchButton.hidden = false;
    spatialInterface.setAlwaysFaceCamera(false);
    if (!rendererStarted) {
        initRenderer().then(() => {
            initDrawingApp();
            appActive = true;
            scene.visible = true;
        });
    } else {
        drawingManager.enableInteractions();
        appActive = true;
        scene.visible = true;
    }
    spatialInterface.changeFrameSize(mainData.width, mainData.height);
});
envelope.onClose(() => {
    // we don't need to location.reload() here if we properly reset the state
    launchButton.hidden = false;
    spatialInterface.unregisterTouchDecider();
    spatialInterface.setAlwaysFaceCamera(true);
    drawingManager.disableInteractions();
    appActive = false;
    scene.visible = false;
});
envelope.onBlur(() => {
    // hide the 2D UI
    ui.style.display = 'none';
});
envelope.onFocus(() => {
    // show the UI
    ui.style.display = '';
});

function resetScroll() {
    if (window.scrollX !== 0 || window.scrollY !== 0) {
        window.scrollTo(0, 0); // don't let keyboard events scroll the window
    }
    parent.postMessage(JSON.stringify({resetScroll: true}), '*');
}
resetScroll();

function initDrawingApp() {
    drawingManager = new DrawingManager(mainContainerObj, camera);
    drawingManager.addCallback('update', drawingData => {
        drawingData.time = Date.now();
        spatialInterface.writePublicData('storage', 'drawing', drawingData);
    });

    document.addEventListener('pointerdown', e => {
        if (e.button === 0) {
            drawingManager.onPointerDown(e);
        }
    });
    document.addEventListener('pointermove', e => {
        drawingManager.onPointerMove(e);
    });
    document.addEventListener('pointerup', e => {
        if (e.button === 0) {
            drawingManager.onPointerUp(e);
        }
    });
    if (loadedDrawing) {
        drawingManager.deserializeDrawing(loadedDrawing);
        loadedDrawing = null;
    }
    drawingManager.enableInteractions();

    drawingManager.addCallback('size', (size) => {
        sizeCircles.forEach(sizeCircle => sizeCircle.classList.remove('active'));
        const nextCircle = sizeCircles.find(circle => circle.dataset.size === `${size}`);
        nextCircle.classList.add('active'); // Activates
    });
    drawingManager.addCallback('color', (color) => {
        try {
            sizeCircles.forEach(sizeCircle => sizeCircle.setColor(color));
            colorCircles.forEach(colorCircle => colorCircle.classList.remove('active'));
            colorCircles.find(circle => circle.dataset.color === color).classList.add('active');
        } catch (e) {
            console.warn('cant update 2D UI to match the colors value');
        }
    });
    drawingManager.addCallback('eraseMode', (eraseMode) => {
        if (eraseMode) {
            eraseCircle.classList.add('active');
        } else {
            eraseCircle.classList.remove('active');
        }
    });
    drawingManager.addCallback('cursor', cursor => {
        cursorMenuOptions.forEach(option => option.classList.remove('active'));
        cursorMenuOptions.find(option => cursor === drawingManager.cursorMap[option.dataset.cursor]).classList.add('active');
    });
    drawingManager.addCallback('icon', iconName => {
        iconCircles.forEach(iconCircle => iconCircle.classList.remove('active'));
        iconCircles.find(iconCircle => iconName === iconCircle.dataset.icon).classList.add('active');
    });
    drawingManager.addCallback('tool', tool => {
        const toolName = Object.keys(drawingManager.toolMap).find(name => drawingManager.toolMap[name] === tool);
        if (toolName === 'ICON') {
            iconMenu.classList.add('active');
        } else {
            iconCircles.forEach(iconCircle => iconCircle.classList.remove('active'));
            iconMenu.classList.remove('active');
        }
    });

    initializedApp = true;
}

function glIsReady() {
    return (gl instanceof WebGLRenderingContext);
}

function adjustSidebarForWindowSize(viewportHeight) {
    const envelopeButtonsHeight = 148;
    const padding = 20;
    const usableHeight = viewportHeight - envelopeButtonsHeight;
    const scale = (usableHeight - padding) / 556; // Calculate the scale factor

    // on desktop, move toolbar down below envelope close button, and scale it down, so it doesn't overlap
    if (window.isDesktop()) {
        uiParent.style.position = 'absolute';
        uiParent.style.top = `${envelopeButtonsHeight - padding}px`;
        uiParent.style.height = `${usableHeight - padding}px`;
        ui.style.transform = `scale(${Math.max(0.6, Math.min(1.0, scale))})`;
    } else {
        ui.style.transform = '';
    }
}

function initRenderer() {
    if (rendererStarted) {
        return;
    }
    return new Promise((resolve, reject) => {
        if (glIsReady()) {
            rendererStarted = true;
            document.body.width = mainData.width + 'px';
            document.body.height = mainData.height + 'px';
            rendererWidth = mainData.width;
            rendererHeight = mainData.height;
            aspectRatio = rendererWidth / rendererHeight;

            spatialInterface.changeFrameSize(mainData.width, mainData.height);
            spatialInterface.onWindowResized(({width, height}) => {
                console.log('onWindowResized');
                mainData.width = width;
                mainData.height = height;
                rendererWidth = width;
                rendererHeight = height;
                aspectRatio = rendererWidth / rendererHeight;
                renderer.setSize(rendererWidth, rendererHeight);
                realRenderer.setSize(rendererWidth, rendererHeight);
                isProjectionMatrixSet = false;
                spatialInterface.subscribeToMatrix(); // this should trigger a new retrieval of the projectionMatrix
                adjustSidebarForWindowSize(height);
            });

            realRenderer = new THREE.WebGLRenderer( { alpha: true } );
            realRenderer.debug.checkShaderErrors = false;
            realRenderer.setPixelRatio(window.devicePixelRatio);
            realRenderer.setSize(rendererWidth, rendererHeight);
            // eslint-disable-next-line no-global-assign
            realGl = realRenderer.getContext();

            // create a fullscreen webgl renderer for the threejs content and add to the dom
            renderer = new THREE.WebGLRenderer( { context: gl, alpha: true } );
            renderer.debug.checkShaderErrors = false;
            //renderer.setPixelRatio( window.devicePixelRatio );
            renderer.setSize( rendererWidth, rendererHeight );
            //document.body.appendChild( renderer.domElement );

            // create a threejs camera and scene
            camera = new THREE.PerspectiveCamera( 70, aspectRatio, 1, 1000 );
            scene = new THREE.Scene();
            scene.add(camera);

            // create a parent 3D object to contain all the three js objects
            // we can apply the marker transform to this object and all of its
            // children objects will be affected
            mainContainerObj = new THREE.Object3D();
            mainContainerObj.matrixAutoUpdate = false;
            mainContainerObj.name = 'mainContainerObj';
            scene.add(mainContainerObj);

            groundPlaneContainerObj = new THREE.Object3D();
            groundPlaneContainerObj.matrixAutoUpdate = false;
            groundPlaneContainerObj.name = 'groundPlaneContainerObj';
            scene.add(groundPlaneContainerObj);

            // light the scene with ambient light
            const ambLight = new THREE.AmbientLight(0x404040);
            scene.add(ambLight);
            const directionalLight = new THREE.DirectionalLight(0xFFFFFF);
            directionalLight.position.set(0, 100000, 0);
            groundPlaneContainerObj.add(directionalLight);
            const directionalLight2 = new THREE.DirectionalLight(0xFFFFFF);
            directionalLight2.position.set(100000, 0, 100000);
            groundPlaneContainerObj.add(directionalLight2);

            spatialInterface.onSpatialInterfaceLoaded(function() {
                setupAPI();
                spatialInterface.subscribeToMatrix();
                spatialInterface.addGroundPlaneMatrixListener(groundPlaneCallback);
                spatialInterface.addMatrixListener(updateMatrices); // whenever we receive new matrices from the editor, update the 3d scene

                spatialInterface.subscribeToCoordinateSystems([
                    // spatialObject.COORDINATE_SYSTEMS.CAMERA,
                    // spatialObject.COORDINATE_SYSTEMS.PROJECTION_MATRIX,
                    spatialObject.COORDINATE_SYSTEMS.WORLD_ORIGIN,
                    spatialObject.COORDINATE_SYSTEMS.TOOL_ORIGIN
                ], (coordinateSystems) => {
                    // let cameraMatrix = coordinateSystems[spatialObject.COORDINATE_SYSTEMS.CAMERA];
                    // let projectionMatrix = coordinateSystems[spatialObject.COORDINATE_SYSTEMS.PROJECTION_MATRIX];
                    let toolMatrix = coordinateSystems[spatialObject.COORDINATE_SYSTEMS.TOOL_ORIGIN];
                    let worldMatrix = coordinateSystems[spatialObject.COORDINATE_SYSTEMS.WORLD_ORIGIN];
                    if (toolMatrix && worldMatrix) {
                        drawingManager.updateCoordinateSystems(toolMatrix, worldMatrix);
                    }
                });
                
                spatialInterface.registerTouchDecider(touchDecider);
                spatialInterface.getScreenDimensions((width, height) => {
                    adjustSidebarForWindowSize(height);
                });
                resolve();
            });
        } else {
            setTimeout(() => {
                initRenderer().then(resolve).catch(reject);
            }, 500);
        }
    });
}

// Gets passed eventData if needed
function touchDecider(eventData) {
    return appActive;
}

function setMatrixFromArray(matrix, array) {
    matrix.set( array[0], array[4], array[8], array[12],
        array[1], array[5], array[9], array[13],
        array[2], array[6], array[10], array[14],
        array[3], array[7], array[11], array[15]
    );
}

function groundPlaneCallback(modelViewMatrix) {
    setMatrixFromArray(groundPlaneContainerObj.matrix, modelViewMatrix);
    mainContainerObj.groundPlaneContainerObj = groundPlaneContainerObj;
}


function updateMatrices(modelViewMatrix, projectionMatrix) {
    lastProjectionMatrix = projectionMatrix;
    lastModelViewMatrix = modelViewMatrix;
}

// Draw the scene repeatedly
// eslint-disable-next-line no-undef
render = function(_now) {
    // only set the projection matrix for the camera 1 time, since it stays the same
    if (!isProjectionMatrixSet && lastProjectionMatrix && lastProjectionMatrix.length === 16) {
        setMatrixFromArray(camera.projectionMatrix, lastProjectionMatrix);
        camera.projectionMatrixInverse.getInverse(camera.projectionMatrix);
        isProjectionMatrixSet = true;
    }

    if (isProjectionMatrixSet && lastModelViewMatrix && lastModelViewMatrix.length === 16) {
        // update model view matrix
        setMatrixFromArray(mainContainerObj.matrix, lastModelViewMatrix);

        // render the scene
        mainContainerObj.visible = true;

        if (renderer && scene && camera) {
            drawingManager.triggerCallbacks('render', _now);
            renderer.render(scene, camera);
            if (done && realGl) {
                for (let proxy of proxies) {
                    proxy.__uncloneableObj = null;
                    delete proxy.__uncloneableObj;
                }
                // eslint-disable-next-line no-global-assign
                proxies = [];
                realRenderer.dispose();
                realRenderer.forceContextLoss();
                realRenderer.context = null;
                realRenderer.domElement = null;
                realRenderer = null;
                // eslint-disable-next-line no-global-assign
                realGl = null;
            }
            done = false;
        }
    }
};
