/* global SpatialInterface, ThreejsInterface, EnvelopeContents, spatialObject */

// Various threejs and gl proxy support variables
var mainContainerObj, groundPlaneContainerObj;
let spatialInterface;
let envelopeContents;

let isGroundPlaneFound = false;

// THREE.Group containing the spatial sensor
let sensorGroup;
// Sensor's solid box
let sensorMesh;
// Sensor's wireframe box
let sensorWireframe;

// Dimensions of sensor in meters
const sensorWidth = 0.8;
const sensorHeight = 1.5;
const sensorDepth = 0.8;
// Three is in mm for its units
const mToUnit = 1000;

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

    makeSpatialSensor();

    spatialInterface.onSpatialInterfaceLoaded(function() {

        spatialInterface.setVisibilityDistance(100);

        // whenever we receive new matrices from the editor, update the 3d scene
        spatialInterface.addGroundPlaneMatrixListener(groundPlaneCallback);
        spatialInterface.addAnchoredModelViewListener(anchoredModelViewCallback);

        spatialInterface.initNode('count', 'node', -150, 0, 2.0);
        spatialInterface.initNode('occupied', 'node', 150, 0, 2.0);

        spatialInterface.addReadListener('occupied', function(e) {
            setSensorActive(e.value > 0.5);
        });

        spatialInterface.setMoveDelay(300);

        spatialInterface.subscribeToObjectsOfType('human', onHumanPoses);

        threejsInterface.removePendingLoad();
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

    let sensorPosition = getSensorPosition();
    let minX = sensorPosition.x - (sensorWidth * mToUnit) / 2;
    let maxX = sensorPosition.x + (sensorWidth * mToUnit) / 2;
    let minZ = sensorPosition.z - (sensorDepth * mToUnit) / 2;
    let maxZ = sensorPosition.z + (sensorDepth * mToUnit) / 2;

    let active = false;

    for (const poseId in humanPoseObjects) {
        const humanPoseObject = humanPoseObjects[poseId];
        setMatrixFromArray(humanMatrix, humanPoseObject.matrix);
        for (const toolId in humanPoseObject.tools) {
            const toolMatrix = humanPoseObject.tools[toolId];
            setMatrixFromArray(jointMatrix, toolMatrix);
            jointMatrix.premultiply(humanMatrix);
            jointPosition.setFromMatrixPosition(jointMatrix);
            if (jointPosition.x > minX &&
                jointPosition.x < maxX &&
                jointPosition.z > minZ &&
                jointPosition.z < maxZ) {
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
        updateSensorPosition();
    }
}

function getSensorPosition() {
    groundPlaneContainerObj.attach(sensorGroup);

    let sgPos = {
        x: sensorGroup.position.x,
        y: sensorGroup.position.y,
        z: sensorGroup.position.z,
    };

    mainContainerObj.attach(sensorGroup);

    return sgPos;
}

let lastUpdateSensorPosition = Date.now();
let UPDATE_SENSOR_POSITION_DELAY = 100;
let oldPos = {
    x: 0,
    y: 0,
    z: 0,
};

/**
 * Loosely compare two coordinates (x, y, z)
 * @param {number} a
 * @param {number} b
 * @return {boolean}
 */
function coordEqual(a, b) {
    return Math.round(a) === Math.round(b);
}

function updateSensorPosition() {
    if (Date.now() - lastUpdateSensorPosition < UPDATE_SENSOR_POSITION_DELAY) {
        return;
    }
    lastUpdateSensorPosition = Date.now();
    let newPos = getSensorPosition();
    if (coordEqual(oldPos.x, newPos.x) &&
        coordEqual(oldPos.y, newPos.y) &&
        coordEqual(oldPos.z, newPos.z)) {
        return;
    }
    spatialInterface.analyticsSetSensor(newPos);
    languageInterface.updateSummarizedState('position', newPos);
    languageInterface.sendSummarizedStateToParent();
    oldPos = newPos;
}

/**
 * Create the spatial sensor, add it to the scene, then store it in all related
 * global variables
 */
function makeSpatialSensor() {
    let group = new THREE.Group();
    // Should be 0.8 2 0.8
    let geo = new THREE.BoxGeometry(sensorWidth * mToUnit, sensorHeight * mToUnit, sensorDepth * mToUnit);
    let mat = new THREE.MeshBasicMaterial({
        color: sensorColor,
        opacity: 0.3,
        transparent: true,
    });
    let obj = new THREE.Mesh(geo, mat);
    obj.position.x = 0;
    obj.position.y = sensorHeight / 2 * mToUnit;
    obj.position.z = 0;
    sensorMesh = obj;
    group.add(obj);

    geo = new THREE.BoxGeometry(sensorWidth * mToUnit, sensorHeight * mToUnit, sensorDepth * mToUnit);
    mat = new THREE.MeshBasicMaterial({
        color: sensorColor,
        wireframe: true,
    });
    obj = new THREE.Mesh(geo, mat);
    sensorWireframe = obj;
    obj.position.x = 0;
    obj.position.y = sensorHeight / 2 * mToUnit;
    obj.position.z = 0;
    group.add(obj);

    // note: sensor gets added to mainContainerObj, which is positioned at the anchor
    // never need to update the x-z position since it will automatically center on the anchor if x=0,z=0
    mainContainerObj.add(group);
    sensorGroup = group;
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
