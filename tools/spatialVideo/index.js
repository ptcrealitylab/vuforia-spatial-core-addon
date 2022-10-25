/* global SpatialInterface, ThreejsInterface */

import { VideoManager, VideoManagerStates } from './scripts/VideoManager.js';

// // eslint-disable-next-line no-unused-vars
// const touchDecider = defaultTouchDecider;

let videoManager;
let recordingActive = false;

// The following timeout and interval allow for one instance of the tool to declare itself the leader and be in charge of synchronizing state
// Heartbeat-style status updates are necessary to allow for new connections to know the current state rather than an outdated one
let selfNominateTimeout;
const selfNominateTimeoutDuration = 5000 + Math.random() * 1000; // Seconds before self-nomination
let leaderBroadcastInterval;
let leaderBroadcastIntervalDuration = 1000;

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

const leaderBroadcast = () => {
    spatialInterface.writePublicData('storage', 'status', {
        state: videoManager.state,
        currentTime: videoManager.videoPlayback.currentTime,
        id: videoManager.id
    });
};

const onRendererInit = () => {
    spatialInterface.initNode('storage', 'storeData');
    spatialInterface.addReadPublicDataListener('storage', 'urls', data => {
        const urls = JSON.parse(data);
        videoManager.setDefaultURLs(urls);
    });
    spatialInterface.addReadPublicDataListener('storage', 'status', status => {
        if (videoManager.videoPlayback && (videoManager.state === VideoManagerStates.PAUSED || videoManager.state === VideoManagerStates.PLAYING)) {
            videoManager.setCurrentTime(status.currentTime);
            if (videoManager.videoPlayback.state !== status.state) {
                if (status.state === 'PLAYING') {
                    videoManager.videoPlayback.play();
                } else if (status.state === 'PAUSED') {
                    videoManager.videoPlayback.pause();
                } else {
                    console.error(`Received invalid update status state: ${status.state}`);
                }
            }
            if (selfNominateTimeout) {
                clearTimeout(selfNominateTimeout);
            }
            if (leaderBroadcastInterval) {
                clearInterval(leaderBroadcastInterval);
            }
            selfNominateTimeout = setTimeout(() => {
                selfNominateTimeout = null;
                leaderBroadcast();
                leaderBroadcastInterval = setInterval(() => {
                    leaderBroadcast();
                }, leaderBroadcastIntervalDuration);
            }, selfNominateTimeoutDuration);
        }
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
                    videoManager.loadFromURLs(urls);
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
    videoManager.addCallback('LOAD', () => {
        selfNominateTimeout = setTimeout(() => {
            selfNominateTimeout = null;
            leaderBroadcast();
            leaderBroadcastInterval = setInterval(() => {
                leaderBroadcast();
            }, leaderBroadcastIntervalDuration);
        }, selfNominateTimeoutDuration);
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
