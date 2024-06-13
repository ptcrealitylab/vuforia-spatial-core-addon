import {isPointInsideWalls} from './winding.js';

// Various threejs and gl proxy support variables
var mainContainerObj, groundPlaneContainerObj;
let spatialInterface, languageInterface;
let envelopeContents;

let isGroundPlaneFound = false;

// THREE.Group containing the spatial sensor
let sensorGroup;
let sensorMesh;
let sensorWireframe;

// Dimensions of sensor in meters
const sensorHeight = 0.5;

// Three is in mm for its units
const mToUnit = 1000;

let points = null;

// Randomly selected base color of sensor
const palette = ['#eb0e7e']; // '#ff0077', '#0077ff', '#ff00ff', '#ff7700', '#7700ff', '#ffff00'];
const sensorColor = new THREE.Color(palette[Math.floor(Math.random() * palette.length)]);
// Active (occupied) color of sensor
const sensorColorActive = new THREE.Color('#1CF4DB');

if (!spatialInterface) {
    spatialInterface = new SpatialInterface();
    envelopeContents = new EnvelopeContents(spatialInterface, document.getElementById('container'));
    spatialInterface.useWebGlWorker();

    languageInterface = new LanguageInterface('spatialSensor', spatialObject.object, spatialObject.frame);
    languageInterface.updateSummarizedState('occupied', false);
    languageInterface.updateSummarizedState('position', {x: 0, y: 0, z: 0});
    languageInterface.sendSummarizedStateToParent();
}

let threejsInterface = new ThreejsInterface(spatialInterface);

threejsInterface.addPendingLoad();

threejsInterface.onSceneCreated(function onSceneCreated(scene) {

    // create a parent 3D object to contain all the three js objects
    // we can apply the marker transform to this object and all of its
    // children objects will be affected
    mainContainerObj = new THREE.Object3D();
    mainContainerObj.matrixAutoUpdate = false;
    mainContainerObj.name = 'mainContainerObj';
    scene.add(mainContainerObj);

    groundPlaneContainerObj = new THREE.Object3D();
    groundPlaneContainerObj.matrixAutoUpdate = false;
    groundPlaneContainerObj.name = 'groundPlaneContainer';
    scene.add(groundPlaneContainerObj);

    var ambLight = new THREE.AmbientLight(0xaaaaaa);
    scene.add(ambLight);

    spatialInterface.onSpatialInterfaceLoaded(function() {

        spatialInterface.setVisibilityDistance(100);

        // whenever we receive new matrices from the editor, update the 3d scene
        spatialInterface.addGroundPlaneMatrixListener(groundPlaneCallback);
        spatialInterface.addAnchoredModelViewListener(anchoredModelViewCallback);

        spatialInterface.initNode('count', 'node', -150, 0, 2.0);
        spatialInterface.initNode('occupied', 'node', 150, 0, 2.0);

        spatialInterface.initNode('storage', 'storeData');

        spatialInterface.addReadPublicDataListener('storage', 'points', storedPoints => {
            setPoints(storedPoints);
        });

        setTimeout(() => {
            if (points) {
                return;
            }
            callPromptForArea();
        }, 2000);

        spatialInterface.addReadListener('occupied', function(e) {
            setSensorActive(e.value > 0.5);
        });

        spatialInterface.setMoveDelay(300);

        spatialInterface.subscribeToObjectsOfType('human', onHumanPoses);
    });
});

function setMatrixFromArray(matrix, array) {
    matrix.set( array[0], array[4], array[8], array[12],
        array[1], array[5], array[9], array[13],
        array[2], array[6], array[10], array[14],
        array[3], array[7], array[11], array[15]
    );
}

function groundPlaneCallback(modelViewMatrix, _projectionMatrix) {
    setMatrixFromArray(groundPlaneContainerObj.matrix, modelViewMatrix);
    if (!isGroundPlaneFound) {
        isGroundPlaneFound = true;
    }
}

const humanMatrix = new THREE.Matrix4();
const jointMatrix = new THREE.Matrix4();
const jointPosition = new THREE.Vector3();

let isPlaybackActive = false;

function onHumanPoses(humanPoseObjects) {
    if (!humanPoseObjects) {
        if (!isPlaybackActive) {
            setSensorActive(false);
        }
        return;
    }

    let active = false;

    for (const poseId in humanPoseObjects) {
        const humanPoseObject = humanPoseObjects[poseId];
        setMatrixFromArray(humanMatrix, humanPoseObject.matrix);
        for (const toolId in humanPoseObject.tools) {
            const toolMatrix = humanPoseObject.tools[toolId];
            setMatrixFromArray(jointMatrix, toolMatrix);
            jointMatrix.premultiply(humanMatrix);
            jointPosition.setFromMatrixPosition(jointMatrix);

            let pos = {x: joint.position.x, y: joint.position.z};
            if (isPointInsideWalls(pos, points)) {
                active = true;
                break;
            }
        }
        if (active) {
            break;
        }
    }

    setSensorActive(active);
    isPlaybackActive = false;
    languageInterface.updateSummarizedState('occupied', active);
    languageInterface.sendSummarizedStateToParent();
}

function anchoredModelViewCallback(modelViewMatrix, _projectionMatrix) {
    if (threejsInterface.isProjectionMatrixSet && isGroundPlaneFound) {
        setMatrixFromArray(mainContainerObj.matrix, modelViewMatrix);  // update model view matrix
    }
}

/**
 * Create the spatial sensor, add it to the scene, then store it in all related
 * global variables
 */
function setPoints(newPoints) {
    console.log('setpoints', newPoints);
    if (points) {
        console.log('TOO LATE, THE POINTS ARE SET');
        return;
    }

    points = newPoints.map(p => {
        return new THREE.Vector2(p.x, p.y);
    });

    let group = new THREE.Group();

    let mat = new THREE.MeshBasicMaterial({
        color: sensorColor,
        opacity: 0.3,
        transparent: true,
        side: THREE.DoubleSide,
    });

    // if (points.length > 1) {
    //     // Draw walls
    //     for (let i = 0; i < points.length; i++) {
    //         const wallStart = points[i];
    //         const wallEnd = (i === points.length - 1) ? points[0] : points[i+1];
    //         const wallWidth = wallStart.distanceTo(wallEnd);
    //         const wallGeometry = new THREE.PlaneGeometry(wallWidth, sensorHeight * 1000).translate(wallWidth / 2, sensorHeight * 1000 / 2, 0);
    //         const wall = new THREE.Mesh(wallGeometry, mat);
    //         group.add(wall);
    //         wall.position.copy(new THREE.Vector3(wallStart.x, 0, wallStart.y));
    //         wall.lookAt(new THREE.Vector3(wallEnd.x, 0, wallEnd.y));
    //         wall.rotateY(-Math.PI / 2);
    //     }
    // }

    const floorShape = new THREE.Shape(points);
    const floorGeometry = new THREE.ShapeGeometry(floorShape);
    floorGeometry.rotateX(Math.PI / 2); // Lay flat on ground, not vertical

    sensorMesh = new THREE.Mesh(floorGeometry, mat);
    group.add(sensorMesh);

    mat = new THREE.MeshBasicMaterial({
        color: sensorColor,
        wireframe: true,
    });
    sensorWireframe = new THREE.Mesh(floorGeometry, mat);
    group.add(sensorWireframe);

    groundPlaneContainerObj.add(group);
    sensorGroup = group;

    spatialInterface.analyticsSetSensor({
        position: {x: 0, y: 0, z: 0},
        points,
    });

    spatialInterface.writePublicData('storage', 'points', points.map(p => {
        return {x: p.x, y: p.y, z: p.z};
    }));

    threejsInterface.removePendingLoad();
}

let currentActive = false;
/**
 * Display whether the sensor is active and send a message to the containing
 * envelope if applicable
 *
 * @param {boolean} active
 */
function setSensorActive(active) {
    if (active === currentActive) {
        return;
    }
    currentActive = active;
    if (!sensorMesh) {
        console.warn('Sensor not initialized');
        return;
    }

    if (active) {
        sensorMesh.material.opacity = 0.8;
        sensorWireframe.material.opacity = 1;

        sensorMesh.material.color.set(sensorColorActive);
        sensorWireframe.material.color.set(sensorColorActive);

        envelopeContents.sendMessageToEnvelope({
            stepActive: true,
        });
    } else {
        sensorMesh.material.opacity = 0.3;
        sensorWireframe.material.opacity = 0;

        sensorMesh.material.color.set(sensorColor);
        sensorWireframe.material.color.set(sensorColor);

        envelopeContents.sendMessageToEnvelope({
            stepActive: false,
        });
    }
}

function callPromptForArea() {
    spatialInterface.promptForArea({
        drawingMode: 'POLYGON', defineHeight: false
    }).then(area => {
        area.points.pop();
        setPoints(area.points);
    });
}

spatialObject.messageCallBacks.analyticsSetSensorColor = function (msgContent) {
    if (!msgContent.analyticsSetSensorColor) {
        return;
    }
    let color = new THREE.Color(msgContent.analyticsSetSensorColor.color);
    sensorColorActive.copy(color);
    const hsl = sensorColorActive.getHSL();
    sensorColor.setHSL(hsl.h, 0.7, 0.3);
    const realActive = currentActive;
    // Flip currentActive to make sure we reset the sensor color
    currentActive = !currentActive;
    setSensorActive(realActive);
};

spatialObject.messageCallBacks.analyticsSetSensorPlaybackActive = function (msgContent) {
    if (!msgContent.analyticsSetSensorPlaybackActive) {
        return;
    }
    isPlaybackActive = true;
    setSensorActive(msgContent.analyticsSetSensorPlaybackActive.active);
};
