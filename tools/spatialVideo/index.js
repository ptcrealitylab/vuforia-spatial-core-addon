/* global SpatialInterface, ThreejsFakeProxyInterface */

import { VideoManager, VideoManagerStates } from './scripts/VideoManager.js';

// // eslint-disable-next-line no-unused-vars
// const touchDecider = defaultTouchDecider;

let videoManager;
let recordingActive = false;

let mainContainerObj;
let spatialInterface;

if (!spatialInterface) {
    spatialInterface = new SpatialInterface();
    spatialInterface.useWebGlWorker();
}

const threejsInterface = new ThreejsInterface(spatialInterface, THREE);
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
        if (window.isDesktop()) {
            videoManager.setDefaultURLs(urls);
        } else {
            videoManager.setState(VideoManagerStates.MOBILE_LOADED);
        }
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
    let virtualizerTimeout = null;
    const stopRecording = () => {
        clearTimeout(virtualizerTimeout);
        virtualizerTimeout = null;
        if (recordingActive) {
            spatialInterface.stopVirtualizerRecording((baseUrl, recordingId, deviceId) => {
                setTimeout(() => {
                    const urls = {
                        color: `${baseUrl}/virtualizer_recordings/${deviceId}/color/${recordingId}.mp4`,
                        rvl: `${baseUrl}/virtualizer_recordings/${deviceId}/depth/${recordingId}.dat`
                    };
                    if (window.isDesktop()) {
                        videoManager.loadFromURLs(urls);
                    } else {
                        videoManager.setState(VideoManagerStates.MOBILE_LOADED);
                    }
                    spatialInterface.writePublicData('storage', 'urls', JSON.stringify(urls));
                }, 15000); // TODO: don't use timeout
            });
        }
        recordingActive = false;
    };
    videoManager.addCallback('STATE', state => {
        if (state === VideoManagerStates.RECORDING && !recordingActive) {
            recordingActive = true;
            spatialInterface.startVirtualizerRecording();
            virtualizerTimeout = setTimeout(() => {
                stopRecording();
            }, 20000); // Max recording of 20 seconds
        } else {
            stopRecording();
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

        // whenever we receive new matrices from the editor, update the 3d scene
        spatialInterface.addMatrixListener(modelViewCallback);

        spatialInterface.setMoveDelay(300);

        videoManager = new VideoManager(scene, mainContainerObj, threejsInterface.camera, spatialInterface);
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

function modelViewCallback(modelViewMatrix, _projectionMatrix) {
    if (threejsInterface.isProjectionMatrixSet) {
        setMatrixFromArray(mainContainerObj.matrix, modelViewMatrix);  // update model view matrix
    }
}
