/* global SpatialInterface, realGl, gl, proxies */

// Various threejs and gl proxy support variables
let realRenderer, renderer;
let camera, scene;
let mainContainerObj, groundPlaneContainerObj;
let spatialInterface;

let rendererWidth;
let rendererHeight;
let aspectRatio;

let mainData = {
    width: 0,
    height: 0
};

let rendererStarted = false;

if (!spatialInterface) {
    spatialInterface = new SpatialInterface();
    spatialInterface.setMoveDelay(500);
    spatialInterface.useWebGlWorker();
}

function initRenderer() {
    if (rendererStarted) {
        return Promise.resolve();
    }
    rendererStarted = true;
    document.body.width = mainData.width + 'px';
    document.body.height = mainData.height + 'px';
    rendererWidth = mainData.width;
    rendererHeight = mainData.height;
    aspectRatio = rendererWidth / rendererHeight;

    spatialInterface.changeFrameSize(mainData.width, mainData.height);
    spatialInterface.setStickyFullScreenOn();

    const tempCanvas = document.createElement('canvas');
    // eslint-disable-next-line no-global-assign
    realGl = tempCanvas.getContext('webgl2');
    realRenderer = new THREE.WebGLRenderer( { context: realGl, alpha: true } );
    realRenderer.debug.checkShaderErrors = true;
    realRenderer.setPixelRatio(window.devicePixelRatio);
    realRenderer.setSize(rendererWidth, rendererHeight);

    // create a fullscreen webgl renderer for the threejs content and add to the dom
    renderer = new THREE.WebGLRenderer( { context: gl, alpha: true } );
    renderer.debug.checkShaderErrors = true;
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
            spatialInterface.addGroundPlaneMatrixListener(groundPlaneCallback);
            spatialInterface.registerTouchDecider(touchDecider);
            resolve();
        });
    });
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

function groundPlaneCallback(modelViewMatrix, _projectionMatrix) {
    setMatrixFromArray(groundPlaneContainerObj.matrix, modelViewMatrix);
}

let isProjectionMatrixSet = false;
let proxySetupDone = false;

const renderCallbacks = [];
renderCallbacks.add = callback => renderCallbacks.push(callback);
renderCallbacks.remove = callback => renderCallbacks.splice(renderCallbacks.indexOf(callback), 1);

// Draw the scene repeatedly
// eslint-disable-next-line no-undef
render = function(_now) {
    // only set the projection matrix for the camera 1 time, since it stays the same
    if (!isProjectionMatrixSet && lastProjectionMatrix && lastProjectionMatrix.length === 16) {
        setMatrixFromArray(camera.projectionMatrix, lastProjectionMatrix);
        camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
        isProjectionMatrixSet = true;
    }

    if (isProjectionMatrixSet && lastModelViewMatrix && lastModelViewMatrix.length === 16) {
        // update model view matrix
        setMatrixFromArray(mainContainerObj.matrix, lastModelViewMatrix);

        // render the scene
        mainContainerObj.visible = true;

        if (renderer && scene && camera) {
            renderer.render(scene, camera);
            renderCallbacks.forEach(callback => {
                callback(_now);
            });
            if (proxySetupDone && realGl) {
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
            proxySetupDone = false;
        }
    }
};

const defaultTouchDeciderRaycaster = new THREE.Raycaster();
const defaultTouchDeciderPointer = new THREE.Vector2();
// eslint-disable-next-line no-unused-vars
function defaultTouchDecider(event) {
    defaultTouchDeciderPointer.x = ( event.x / window.innerWidth ) * 2 - 1;
    defaultTouchDeciderPointer.y = - ( event.y / window.innerHeight ) * 2 + 1;
    defaultTouchDeciderRaycaster.setFromCamera(defaultTouchDeciderPointer, camera);
    return defaultTouchDeciderRaycaster.intersectObjects( scene.children ).length > 0;
}
