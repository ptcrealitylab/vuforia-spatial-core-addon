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

let spatialInterface;

if (!spatialInterface) {
    spatialInterface = new SpatialInterface();
}

const leaderBroadcast = () => {
    spatialInterface.writePublicData('storage', 'status', {
        state: videoManager.state,
        currentTime: videoManager.videoPlayback.currentTime,
        id: videoManager.id
    });
};

spatialInterface.onSpatialInterfaceLoaded(function() {
    spatialInterface.setVisibilityDistance(100);
    spatialInterface.setMoveDelay(300);
    spatialInterface.setAlwaysFaceCamera(true);
    videoManager = new VideoManager(spatialInterface);

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
});
