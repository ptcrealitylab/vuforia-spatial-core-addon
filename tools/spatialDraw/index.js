/* global SpatialInterface, Envelope, DrawingManager, realGl, gl, proxies */

let drawingManager;
let loadedDrawing;
let initializedApp = false;
let appActive = false;
let lastSync = 0;

// Various threejs and gl proxy support variables
let realRenderer, renderer;
let camera, scene;
let mainContainerObj;
let spatialInterface;

let rendererWidth;
let rendererHeight;
let aspectRatio;

if (!spatialInterface) {
    spatialInterface = new SpatialInterface();
    spatialInterface.setMoveDelay(500);
    spatialInterface.useWebGlWorker();

    setTimeout(() => {
        spatialInterface.initNode('storage', 'storeData');
        spatialInterface.addReadPublicDataListener('storage', 'drawing', function (drawing) {
            if (initializedApp && drawing.time > lastSync) {
                lastSync = drawing.time;
                drawingManager.deserializeDrawing(drawing);
            } else {
                loadedDrawing = drawing;
            }
        });
    }, 1000);
}

let text = document.querySelector('#text');
let textLength = text.innerText.length;
text.style.fontSize = (700 / textLength) + 'pt';

text.addEventListener('pointerup', function () {
    envelope.open();
}, false);

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

const envelope = new Envelope(spatialInterface, [], uiParent, launchButton, false, false);
envelope.onOpen(() => {
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
});
envelope.onClose(() => {
    drawingManager.disableInteractions();
    appActive = false;
    scene.visible = false;
    location.reload();
});

function resizeText() {
    text.innerText = text.innerText.toUpperCase();
    const fontSize = Math.min(70, (((text.innerText.length * 7) + 500) / (text.innerText.length))); // font size increases up to 45pt
    text.style.fontSize = fontSize + 'pt';
}
resizeText();

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
        const nextCircle = sizeCircles.find(circle => circle.dataset.size === size);
        nextCircle.classList.add('active'); // Activates
    });
    drawingManager.addCallback('color', (color) => {
        sizeCircles.forEach(sizeCircle => sizeCircle.setColor(color));
        colorCircles.forEach(colorCircle => colorCircle.classList.remove('active'));
        colorCircles.find(circle => circle.dataset.color === color).classList.add('active');
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

    initializedApp = true;
}

let mainData = {
    width: 0,
    height: 0
};

// eslint-disable-next-line no-undef
main = ({width, height}) => {
    mainData.width = width;
    mainData.height = height;
};

let rendererStarted = false;

function initRenderer() {
    if (rendererStarted) {
        return;
    }
    rendererStarted = true;
    document.body.width = mainData.width + 'px';
    document.body.height = mainData.height + 'px';
    text.remove();
    document.querySelector('svg').remove();
    rendererWidth = mainData.width;
    rendererHeight = mainData.height;
    aspectRatio = rendererWidth / rendererHeight;

    spatialInterface.changeFrameSize(mainData.width, mainData.height);

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

    // light the scene with a combination of ambient and directional white light
    let ambLight = new THREE.AmbientLight(0x404040);
    scene.add(ambLight);
    let dirLight1 = new THREE.DirectionalLight(0xffffff, 1);
    dirLight1.position.set(1000, 1000, 1000);
    scene.add(dirLight1);
    let dirLight2 = new THREE.DirectionalLight(0xffffff, 0.5);
    dirLight2.position.set(-1000, -1000, -1000);
    scene.add(dirLight2);
    let spotLight = new THREE.SpotLight(0xffffff);
    spotLight.position.set(-300, -300, 1500);
    spotLight.castShadow = true;
    mainContainerObj.add(spotLight);

    return new Promise((resolve) => {
        spatialInterface.onSpatialInterfaceLoaded(function() {
            spatialInterface.subscribeToMatrix();
            spatialInterface.addMatrixListener(updateMatrices); // whenever we receive new matrices from the editor, update the 3d scene
            spatialInterface.registerTouchDecider(touchDecider);
            resolve();
        });
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

let lastProjectionMatrix = null;
let lastModelViewMatrix = null;

function updateMatrices(modelViewMatrix, projectionMatrix) {
    lastProjectionMatrix = projectionMatrix;
    lastModelViewMatrix = modelViewMatrix;
}

let isProjectionMatrixSet = false;
let done = false;

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
