/* global SpatialInterface, ThreejsFakeProxyInterface */

import { VideoManager, VideoManagerStates } from './scripts/VideoManager.js';

// // eslint-disable-next-line no-unused-vars
// const touchDecider = defaultTouchDecider;

let videoManager;
let recordingActive = false;

let mainContainerObj;
let groundPlaneContainerObj;
let spatialInterface;

if (!spatialInterface) {
    spatialInterface = new SpatialInterface();
    spatialInterface.useWebGlWorker();
}

const threejsInterface = new ThreejsFakeProxyInterface(spatialInterface, THREE);
threejsInterface.addPendingLoad();

const onRender = () => {
    videoManager.render();
};

// TODO: set playbackStart value on initial load after recording and when pausing (take into account offset)
// TODO: read current public data value
// TODO: synchronize timestamps somehow??

const onRendererInit = () => {
    spatialInterface.initNode('storage', 'storeData');
    spatialInterface.addReadPublicDataListener('storage', 'urls', data => {
        const urls = JSON.parse(data);
        console.log(`URLS: ${data}`);
        videoManager.setDefaultURLs(urls);
    });
    spatialInterface.addReadPublicDataListener('storage', 'seekTime', data => {
        const time = JSON.parse(data);
        videoManager.setCurrentTime(time);
    });
    document.addEventListener('pointerdown', e => {
        if (e.button === 0) {
            videoManager.onPointerDown(e);
        }
    });
    videoManager.addCallback('STATE', state => {
        if (state === VideoManagerStates.RECORDING && !recordingActive) {
            recordingActive = true;
            spatialInterface.startVirtualizerRecording();
        } else {
            if (recordingActive) {
                spatialInterface.stopVirtualizerRecording((baseUrl, recordingId, deviceId) => {
                    setTimeout(() => {
                        const baseUrl = baseUrl.replace('https://toolboxedge.net', window.location);
                        const urls = {
                            color: `${baseUrl}/virtualizer_recordings/${deviceId}/color/${recordingId}.mp4`,
                            rvl: `${baseUrl}/virtualizer_recordings/${deviceId}/depth/${recordingId}.dat`
                        };
                        videoManager.loadFromURLs(urls).then(() => {});
                        spatialInterface.writePublicData('storage', 'urls', JSON.stringify(urls));
                    }, 15000); // TODO: don't use timeout
                });
            }
            recordingActive = false;
        }
    });
};

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
    groundPlaneContainerObj.name = 'groundPlaneContainerObj';
    scene.add(groundPlaneContainerObj);

    // light the scene with a combination of ambient and directional white light
    const ambLight = new THREE.AmbientLight(0xaaaaaa);
    scene.add(ambLight);

    let loaded = false;
    spatialInterface.onSpatialInterfaceLoaded(function() {
        if (loaded) {
            return;
        }
        loaded = true;

        spatialInterface.setVisibilityDistance(100);

        spatialInterface.addGroundPlaneMatrixListener(groundPlaneCallback);
        // whenever we receive new matrices from the editor, update the 3d scene
        spatialInterface.addMatrixListener(modelViewCallback);

        spatialInterface.setMoveDelay(300);

        videoManager = new VideoManager(scene, mainContainerObj, groundPlaneContainerObj, threejsInterface.camera);
        onRendererInit();
        // threejsInterface.removePendingLoad();
        threejsInterface.onRender(onRender);
    });
});

function setMatrixFromArray(matrix, array) {
    matrix.set(array[0], array[4], array[8], array[12],
        array[1], array[5], array[9], array[13],
        array[2], array[6], array[10], array[14],
        array[3], array[7], array[11], array[15]
    );
}

function groundPlaneCallback(modelViewMatrix, _projectionMatrix, floorOffset) {
    setMatrixFromArray(groundPlaneContainerObj.matrix, modelViewMatrix);
    videoManager.setFloorOffset(floorOffset);
}

function modelViewCallback(modelViewMatrix, _projectionMatrix) {
    if (threejsInterface.isProjectionMatrixSet) {
        setMatrixFromArray(mainContainerObj.matrix, modelViewMatrix);  // update model view matrix
    }
}
