/* global THREE, screen, SpatialInterface, window, gl, document, SplineRender, Envelope, Pathfinder */

/******** THREEJS ********/

const debugPath = false;
const enablePathfinding = false;

let realRenderer, renderer;
let spatialInterface;
let camera, scene, splineRenderer;
let mainContainerObj, groundPlaneContainerObj;
let isProjectionMatrixSet = false;
let currentWorldId = null;
let pins = {};
let defaultPin;

let rendererWidth = screen.height; // width is height because landscape orientation
let rendererHeight = screen.width; // height is width
var aspectRatio = rendererWidth / rendererHeight;

window.addEventListener('load', function() {
    if (!spatialInterface) {
        spatialInterface = new SpatialInterface();
    }
    spatialInterface.useWebGlWorker();
});

// eslint-disable-next-line no-unused-vars
function main() {

    realRenderer = new THREE.WebGLRenderer( { alpha: true } );
    realRenderer.setPixelRatio(window.devicePixelRatio);
    realRenderer.setSize(rendererWidth, rendererHeight);
    // document.body.appendChild( realRenderer.domElement );
    // eslint-disable-next-line no-undef
    realGl = realRenderer.getContext();

    // create a fullscreen webgl renderer for the threejs content and add to the dom
    renderer = new THREE.WebGLRenderer( { context: gl, alpha: true } );
    renderer.setPixelRatio( window.devicePixelRatio );
    renderer.setSize( rendererWidth, rendererHeight );
    document.body.appendChild( renderer.domElement );

    // create a threejs camera and scene
    camera = new THREE.PerspectiveCamera( 70, aspectRatio, 1, 1000 );
    scene = new THREE.Scene();

    mainContainerObj = new THREE.Object3D();
    mainContainerObj.matrixAutoUpdate = false;
    scene.add(mainContainerObj);
    mainContainerObj.name = 'mainContainerObj';

    groundPlaneContainerObj = new THREE.Object3D();
    groundPlaneContainerObj.matrixAutoUpdate = false;
    scene.add(groundPlaneContainerObj);
    groundPlaneContainerObj.name = 'groundPlaneContainerObj';

    let textureArrow = new THREE.TextureLoader().load('resources/pathArrow2.png');
    splineRenderer = new SplineRender(groundPlaneContainerObj, textureArrow);

    // Create new spline now to avoid problems with glcanvas creating new geometry

    let geometrycube = new THREE.BoxGeometry( 10, 10, 10 );
    let material = new THREE.MeshBasicMaterial( {color: 0xffffff} );
    defaultPin = new THREE.Mesh( geometrycube, material );  // red
    groundPlaneContainerObj.add( defaultPin );
    defaultPin.position.set(0, 0, 0);

    /*
        let geometrycube = new THREE.BoxGeometry( 10, 10, 10 );
        let material = new THREE.MeshBasicMaterial( {color: 0xff0000} );

        let material2 = new THREE.MeshBasicMaterial( {color: 0x00ff00} );
        let material3 = new THREE.MeshBasicMaterial( {color: 0x0000ff} );
        let cube_z = new THREE.Mesh( geometrycube, material2 ); // green
        let cube_y = new THREE.Mesh( geometrycube, material3 ); // blue
        let cube_x = new THREE.Mesh( geometrycube, material );  // red
        groundPlaneContainerObj.add( cube_x );
        groundPlaneContainerObj.add( cube_z );
        groundPlaneContainerObj.add( cube_y );
        cube_x.position.set(50, 0, 0);
        cube_y.position.set(0, 50, 0);
        cube_z.position.set(0, 0, 50);
        cube_y.name = 'cube_y';
        cube_z.name = 'cube_z';
        cube_x.name = 'cube_x';

        let newPos1 = new THREE.Vector3(100, 0, 0);
        let newPos2 = new THREE.Vector3(0, 100, 0);
        let newPos3 = new THREE.Vector3(0, 0, 100);
        let test = [newPos1, newPos2, newPos3];
        splineRenderer.updateSpline(CAMERA_ID, test);*/

}

/****** ******/

if (!spatialInterface) {
    spatialInterface = new SpatialInterface();
}

// Define a list of the names of tools that can go inside this envelope
let compatibleToolTypes = ['pathPoint'];

let rootElementWhenOpen = document.getElementById('rootElementWhenOpen');
let rootElementWhenClosed = document.getElementById('rootElementWhenClosed');
let canvas = document.getElementById('canvas');
let smallIcon = document.getElementById('smallIcon');
let bigIcon = document.getElementById('bigIcon');
let graphics = document.getElementById('graphics');
let details = document.getElementById('details');
let mainDetailText = document.getElementById('mainDetailText');
let subDetailText = document.getElementById('subDetailText');
let editNameIcon = document.getElementById('editNameIcon');

let screenWidth = 812;
let screenHeight = 375; // TODO: get via API

let defaultName = 'UN-NAMED PATH';
let name = defaultName;

let areToolsOrdered = true;
let isStackable = false;

// Designate this tool as an envelope by, automatically enabling all the associated features
let envelope = new Envelope(spatialInterface, compatibleToolTypes, rootElementWhenOpen, rootElementWhenClosed, isStackable, areToolsOrdered);

// The pathfinder object maintains a graph composed of points of interest and obstacles and computes shortest paths
let pathfinder = new Pathfinder();
let firstPOI = '';
//pathfinder.addPointOfInterest(CAMERA_ID);

let distancesToCenter = {};

//let shouldRender = false;

let THRESHOLD_VERY_CLOSE = 600; // less than 500 = close
let THRESHOLD_CLOSE = 1600; // less than 1000 = medium
// anything bigger than this is considered far
// if you want another level, try 2400 for veryFar

let DISTANCES = Object.freeze({
    veryClose: 'veryClose',
    close: 'close',
    far: 'far'
});

let currentDistance = DISTANCES.veryClose;

renderIcon(currentDistance, true);  // Set initial icon

let lastProjectionMatrix = null;
let lastModelViewMatrix = null;

spatialInterface.onRealityInterfaceLoaded(function() {

    spatialInterface.getScreenDimensions(function(width, height) {
        screenWidth = width;
        screenHeight = height;
        canvas.width = screenWidth + 'px';
        canvas.height = screenHeight + 'px';
        canvas.style.width = screenWidth + 'px';
        canvas.style.height = screenHeight + 'px';

        //spatialInterface.changeFrameSize(width, height);
    });

    spatialInterface.initNode('path', 'path', 0, 0);
    spatialInterface.sendMoveNode('open', 0, 200); // move auto-generated envelope node to new position

    spatialInterface.subscribeToMatrix();
    //spatialInterface.setMoveDelay(10);

    spatialInterface.addMatrixListener(function(modelView, _projection) {

        lastProjectionMatrix = _projection;
        lastModelViewMatrix = modelView;

    });

    spatialInterface.addGroundPlaneMatrixListener(function(groundPlaneMatrix, _projectionMatrix) {

        if (isProjectionMatrixSet) {                                                // don't turn into else statement, both can happen

            setMatrixFromArray(groundPlaneContainerObj.matrix, groundPlaneMatrix);  // update model view matrix
            groundPlaneContainerObj.visible = true;

            // Update Camera node position:

            let groundPlaneCoordinates = new THREE.Vector3(camera.position.x, camera.position.y, camera.position.z);    // world coordinates
            groundPlaneContainerObj.worldToLocal(groundPlaneCoordinates);   // convert to ground plane coordinates

            //pathfinder.updateNodePosition(CAMERA_ID, groundPlaneCoordinates.x, groundPlaneCoordinates.z, 0);    // Update camera node position

        }

    });

    spatialInterface.subscribeToWorldId(function(worldId) {
        currentWorldId = worldId;
    });
});



function renderIcon(distance, forceRender) {
    if (distance === currentDistance && !forceRender) { return; } // don't re-render redundantly

    currentDistance = distance;

    if (distance === DISTANCES.close || distance === DISTANCES.veryClose) {
        if (distance === DISTANCES.veryClose) {
            // render a preview with info related to what's inside
            if (!bigIcon.classList.contains('extraBig')) {
                bigIcon.classList.add('extraBig');
            }

            if (details.classList.contains('fadeoutDetails')) {
                details.classList.remove('fadeoutDetails');
            }

            mainDetailText.textContent = name.toUpperCase();
            let fontSize = 42; // pixels
            if (name.length > 9) { // (max width = 42 * 9 = 378) => (W = 42 * length) => (378/length = fontSize)
                fontSize = (42 * 9) / name.length;
            }
            mainDetailText.style.fontSize = fontSize + 'px';

            let numPointsOfInterest = Math.max(pathfinder.pointsOfInterest.length - 1, 0);
            let plural = numPointsOfInterest === 1 ? '' : 'S';
            subDetailText.textContent = numPointsOfInterest + ' POINT' + plural + ' OF INTEREST';
        } else {
            if (bigIcon.classList.contains('extraBig')) {
                bigIcon.classList.remove('extraBig');
            }

            if (!details.classList.contains('fadeoutDetails')) {
                details.classList.add('fadeoutDetails');
            }
        }

        // render the hexagon icon with details
        if (!smallIcon.classList.contains('fadeoutSmallIcon')) {
            smallIcon.classList.add('fadeoutSmallIcon');
        }

        if (bigIcon.classList.contains('fadeoutBigIcon')) {
            bigIcon.classList.remove('fadeoutBigIcon');
            graphics.classList.remove('fadeoutGraphics');
        }

    } else if (distance === DISTANCES.far) {
        // render a small hexagon
        if (smallIcon.classList.contains('fadeoutSmallIcon')) {
            smallIcon.classList.remove('fadeoutSmallIcon');
        }

        if (!bigIcon.classList.contains('fadeoutBigIcon')) {
            bigIcon.classList.add('fadeoutBigIcon');
            graphics.classList.add('fadeoutGraphics');
        }

        if (bigIcon.classList.contains('extraBig')) {
            bigIcon.classList.remove('extraBig');
        }

        if (!details.classList.contains('fadeoutDetails')) {
            details.classList.add('fadeoutDetails');
        }
    }
}

let isListeningForKeyboard = false;

function onKeyUp(e) {
    if (!isListeningForKeyboard) { return; }

    var isCharacter = !!e.key.match(/^[a-zA-Z0-9]$/);

    if (isCharacter) {
        name = name + e.key;
    } else {
        if (e.key === 'Backspace') {
            name = name.slice(0, -1); // remove last character
        } else if (e.key === ' ') {
            name = name + '\u00a0'; // special space character doesn't get escaped
            // resetScroll();
            // setTimeout(function() {
            //     resetScroll(); // also do it after a slight delay
            // }, 100);
        }
    }

    renderIcon(currentDistance, true);

    // resizeText();
    spatialInterface.writePublicData('storage', 'name',  name);

}

spatialInterface.onKeyboardClosed(function() {
    isListeningForKeyboard = false; // stop listening once the keyboard closes
    if (name === '') {
        name = defaultName;
        renderIcon(currentDistance, true);
    }
});

spatialInterface.addReadPublicDataListener('storage', 'name', function (e) {
    if (typeof e === 'string') {
        name = e;
        if (name === '') {
            name = defaultName;
        }
        renderIcon(currentDistance, true);
    }
});

spatialInterface.onKeyUp(onKeyUp);

let wasClosedIconPressed = false;
rootElementWhenClosed.addEventListener('pointerdown', function() {
    wasClosedIconPressed = true;
});

// Add a touch event that opens up the envelope into fullscreen mode when the icon is tapped
rootElementWhenClosed.addEventListener('pointerup', function(e) {


    if (currentDistance === DISTANCES.close || currentDistance === DISTANCES.veryClose) {


        // if overlapping pencil icon
        let pencilRect = editNameIcon.getClientRects()[0];
        if (e.pageX > pencilRect.left && e.pageX < pencilRect.right &&
            e.pageY > pencilRect.top && e.pageY < pencilRect.bottom) {

            isListeningForKeyboard = true;

            if (name === defaultName) {
                name = '';
                renderIcon(currentDistance, true);
            }

            spatialInterface.openKeyboard();

        } else {

            if (wasClosedIconPressed) {
                envelope.open();
            }
        }
    }

    wasClosedIconPressed = false;
});

envelope.onClose(function() {
    spatialInterface.setStickinessOff();
    document.getElementById('canvas').style.display = 'none';
    spatialInterface.ignoreAllTouches(false);
});

envelope.onOpen(function() {
    spatialInterface.setStickyFullScreenOn();
    document.getElementById('canvas').style.display = '';
    spatialInterface.ignoreAllTouches(true);
});

// This is the "onload" for the envelope - inside this, containedFrames will be correct
envelope.onPublicDataLoaded(function() {

    // Subscribe to positions of all contained tools
    envelope.forEachFrame(function(frameId, frameData) {
        subscribeToFramePosition(frameId, frameData);

        if (frameData.type === 'pathPoint') {

            if (debugPath) console.log('onPublicDataLoaded: Adding new POI to path: ', frameId);

            pathfinder.addPointOfInterest(frameId);
            renderIcon(currentDistance, true);
        }
    });
});

// Subscribe to the positions of any new frames as they get added
// {objectId: string, frameId: string, frameType: string}
envelope.onFrameAdded(function(frameAddedMessage) {

    let frameId = frameAddedMessage.frameId;
    let frameData = envelope.containedFrames[frameId];
    subscribeToFramePosition(frameId, frameData);

    if (frameData.type === 'pathPoint') {

        if (debugPath) console.log('onFrameAdded: Adding new POI to path: ', frameId);

        pathfinder.addPointOfInterest(frameId);
        renderIcon(currentDistance, true);

        if (pathfinder.pointsOfInterest.length === 1) firstPOI = frameId;

        if (debugPath) console.log('pathfinder.pointsOfInterest.length: ', pathfinder.pointsOfInterest.length);

        writePathList();

    }
});

envelope.onFrameDeleted(function(frameDeletedMessage) {
    let frameId = frameDeletedMessage.frameId;
    let frameType = frameDeletedMessage.frameType;
    if (frameType === 'pathPoint') {
        pathfinder.removePointOfInterest(frameId);
        renderIcon(currentDistance, true);
    }
});

function writePathList() {
    // write list to path node
    let frameIdOrder = JSON.parse(JSON.stringify(envelope.frameIdOrdering));

    let pathList = {
        list: [],
        mode: 'PATH',
        worldObject: currentWorldId
    };

    frameIdOrder.forEach(function(frameId) {
        let frameData = envelope.containedFrames[frameId];
        pathList.list.push({
            object: frameData.objectId,
            tool: frameId
        });
    });

    spatialInterface.write('path', pathList, 'c', 'pathList'); // write to path node
}

// 11. This is just a helper function to set a three.js matrix using an array
function setMatrixFromArray(matrix, array) {
    matrix.set( array[0], array[4], array[8], array[12],
        array[1], array[5], array[9], array[13],
        array[2], array[6], array[10], array[14],
        array[3], array[7], array[11], array[15]);
}

// TODO: figure out if I need to properly unsubscribe or not... maybe not?
// {objectId: string, frameId: string, frameType: string}
// envelope.onFrameDeleted(function(frameDeletedMessage) { });

function subscribeToFramePosition(frameId, frameData) {
    if (debugPath) console.log('subscribe to position of ' + frameId + ' (type = ' + frameData.type + ')');

    let shouldSubscribe3d = true;
    envelope.subscribeToPosition(frameId, function(centerX, centerY, displayWidth, displayHeight, centerZ, displayDepth, worldCoordinates) {
        if (!envelope.isOpen) { return; } // don't waste time computing paths and rendering if not open
        let groundPlaneCoordinates = new THREE.Vector3(worldCoordinates.position.x, worldCoordinates.position.y, worldCoordinates.position.z);
        groundPlaneContainerObj.worldToLocal(groundPlaneCoordinates);   // convert to ground plane coordinates

        pathfinder.updateNodePosition(frameId, groundPlaneCoordinates.x, groundPlaneCoordinates.z, 0);
        pathfinder.updateNodeRadius(frameId, 50); // consider scale to be homogeneous

        updatePinPosition(frameId, groundPlaneCoordinates);

        if (frameData.type === 'pathPoint') {
            let distanceToCenterOfScreen = {
                x: Math.abs(centerX - screenWidth / 2),
                y: Math.abs(centerY - screenHeight / 2),
                z: centerZ
            };
            distancesToCenter[frameId] = distanceToCenterOfScreen;
        }

        //shouldRender = true;
    }, shouldSubscribe3d);
}

/*
 * In order for the spline to render properly
 * another object has to be rendered and visible at all times (this is an unresolved bug)
 * For that matter, we position cubes at each one of the path point positions
 */
function updatePinPosition(frameId, position) {
    if (!(frameId in pins)) {
        console.log('Creating new pin: ', frameId, position);
        pins[frameId] = defaultPin.clone();
        groundPlaneContainerObj.attach(pins[frameId]);

        console.log(pins);
    }
    pins[frameId].position.set(position.x, position.y, position.z);
}

function setIcon() {

    var scaleFactor = Math.abs(lastModelViewMatrix[0]);
    var zDistance = Math.abs(lastModelViewMatrix[14]);

    let scaledDistance = zDistance / scaleFactor;

    if (scaledDistance < THRESHOLD_VERY_CLOSE) {
        renderIcon(DISTANCES.veryClose);
    } else if (scaledDistance < THRESHOLD_CLOSE) {
        renderIcon(DISTANCES.close);
    } else {
        renderIcon(DISTANCES.far);
    }

}

// eslint-disable-next-line no-undef
render = function() {
    /*if (!shouldRender) {
        return;
    }*/

    if (isProjectionMatrixSet && lastModelViewMatrix && !envelope.isOpen) setIcon();

    if (envelope.isOpen) {

        try {

            // send a message to the frame that is closest to the center of the screen
            //highlightTargetedFrame();

            //let allShortestPaths = {};
            //allShortestPaths[firstPOI] = {};

            let index = 0;
            let previousNode = null;
            let positions = [];

            //console.log('How many POI: ', pathfinder.pointsOfInterest.length);

            // compute the path from the CAMERA to each point-of-interest tool and draw lines along the "edges" between each of the "nodes" on the path
            pathfinder.pointsOfInterest.forEach(function(nodeB) {
                if (!enablePathfinding) {
                    let newPos = new THREE.Vector3(nodeB.x, nodeB.y, nodeB.z);
                    positions.push(newPos);
                    return;
                }

                if (nodeB.id === firstPOI) {
                    return;
                } // don't draw line to self

                let thisPath, newPos;

                if (index === 0) {
                    // actually compute the path from the CAMERA to the green circle using the pathfinder's computeShortestPath method
                    thisPath = pathfinder.computeShortestPath(firstPOI, nodeB.id);
                    //allShortestPaths[firstPOI][nodeB.id] = thisPath;

                    // First position = nodeA in first edge
                    newPos = new THREE.Vector3(thisPath.edges[0].nodeA.x, thisPath.edges[0].nodeA.y, thisPath.edges[0].nodeA.z);
                    positions = [newPos];

                    //console.log('camera pos: ', newPos);

                } else {

                    //console.log('Path from: ', previousNode.id, ' to: ', nodeB.id);

                    thisPath = pathfinder.computeShortestPath(previousNode.id, nodeB.id);
                    //allShortestPaths[previousNode.id][nodeB.id] = thisPath;

                }


                // render the path
                thisPath.edges.forEach(function(edge) {

                    //console.log(edge);

                    /*
                    // by default each edge is a transparent blue
                    edgesInAnyShortestPath[edge.id] = edge; // not necessary for this demo, but storing this for old demo

                    if (nodeB.id === targetedPointOfInterest) {
                        // if the tool is the "target" one, highlight the line
                        edgesInTargetedPath[edge.id] = edge; // not necessary for this demo, but storing this for old demo

                    }*/

                    newPos = new THREE.Vector3(edge.nodeB.x, edge.nodeB.y, edge.nodeB.z);
                    positions.push(newPos);
                    //console.log('new pos: ', newPos);

                });

                //console.log('NODE: ', nodeB.id, ' | positions: ', positions);

                previousNode = nodeB;
                index++;
            });

            if (pathfinder.pointsOfInterest.length > 1) {
                splineRenderer.updateSpline(firstPOI, positions);
            }


            //shouldRender = false;
        } catch (e) {
            console.error('error in render function', e);
        }

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
            mainContainerObj.visible = envelope.isOpen;

            if (isProjectionMatrixSet && envelope.isOpen) {
                if (renderer && scene && camera) {

                    renderer.render(scene, camera);
                    // if (done && realGl) {
                    //
                    //     //console.log('OPTIMIZE PROXY');
                    //
                    //     for (let proxy of proxies) {
                    //         proxy.__uncloneableObj = null;
                    //         delete proxy.__uncloneableObj;
                    //     }
                    //     proxies = [];
                    //     realRenderer.dispose();
                    //     realRenderer.forceContextLoss();
                    //     realRenderer.context = null;
                    //     realRenderer.domElement = null;
                    //     realRenderer = null;
                    //     realGl = null;
                    // }
                    //done = true;
                }
            }
        }
    }
};
