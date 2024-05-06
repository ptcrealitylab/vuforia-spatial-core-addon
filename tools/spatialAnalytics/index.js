/* global Envelope, SpatialInterface */
import {VideoToggle} from './VideoToggle.js';
import {createErrorPopup} from './createErrorPopup.js';

const MINIMIZED_TOOL_WIDTH = 1200;
const MINIMIZED_TOOL_HEIGHT = 600;

let spatialInterface;

let screenDimensions = null;

let startTime = Date.now(); // 1675809876408 - 20
let endTime = -1; // 1675809963335 + 3 * 60 * 60 * 1000;
let data = {
    title: '',
    regionCards: [],
    videoUrls: null,
};
let regionCardStartTime = -1;

if (!spatialInterface) {
    spatialInterface = new SpatialInterface();
}

const launchButton = document.getElementById('layout');
launchButton.addEventListener('pointerup', function () {
    envelope.open();
}, false);

// add random init gradient for the tool icon
const randomDelay = -Math.floor(Math.random() * 100);
launchButton.style.animationDelay = `${randomDelay}s`;

const envelopeContainer = document.querySelector('#envelopeContainer');
const envelope = new Envelope(spatialInterface, [], envelopeContainer, launchButton, true, false);
const iconContainer = document.getElementById('iconContainer');
const recordingIcon = document.querySelector('.recordingIcon');
const markStepIcon = document.querySelector('.markStepIcon');
const recIconBackground = document.querySelector('#analyticsRecordingIcon');
const msIconBackground = document.querySelector('#analyticsMarkStepIcon');

const labelTitle = document.getElementById('labelTitle');
const label = document.getElementById('label');

let videoEnabled = true;
const videoToggle = new VideoToggle();
videoToggle.onToggle = (newVideoEnabled) => {
    videoEnabled = newVideoEnabled;
};

const RecordingState = {
    empty: 'empty',
    recording: 'recording',
    saving: 'saving',
    done: 'done',
};
let recordingState = RecordingState.empty;

function setRecordingState(newState) {
    recordingState = newState;
    switch (recordingState) {
    case RecordingState.empty:
        recordingIcon.src = 'sprites/empty.png';
        msIconBackground.style.display = 'none';
        break;
    case RecordingState.recording:
        recordingIcon.src = 'sprites/recording.png';
        msIconBackground.style.display = '';
        recIconBackground.classList.add('recording');
        videoToggle.remove();

        if (videoEnabled) {
            spatialInterface.startVirtualizerRecording(error => {
                if (!error) {
                    return;
                }
                createErrorPopup(envelopeContainer, error);
                setRecordingState(RecordingState.empty);
            });
        }
        break;
    case RecordingState.saving:
        recordingIcon.src = 'sprites/saving.svg';
        msIconBackground.style.visibility = 'hidden';
        recIconBackground.classList.add('recording');
        videoToggle.remove();

        if (videoEnabled) {
            spatialInterface.stopVirtualizerRecording(onStopVirtualizerRecording);
        }
        break;

    case RecordingState.done:
        recordingIcon.style.display = 'none';
        msIconBackground.style.display = 'none';
        recIconBackground.style.display = 'none';
        iconContainer.style.display = 'none';
        videoToggle.remove();
        break;
    }
}

function onStopVirtualizerRecording(error, baseUrl, recordingId, deviceId, orientation) {
    if (error) {
        createErrorPopup(envelopeContainer, error);
    }
    const urls = {
        color: `${baseUrl}/virtualizer_recordings/${deviceId}/color/${recordingId}.mp4`,
        rvl: `${baseUrl}/virtualizer_recordings/${deviceId}/depth/${recordingId}.dat`
    };
    data.videoUrls = urls;
    data.orientation = orientation;
    spatialInterface.writePublicData('storage', 'analyticsData', data);
    spatialInterface.analyticsHydrate(data);

    setRecordingState(RecordingState.done);
}

recordingIcon.addEventListener('pointerup', function() {
    switch (recordingState) {
    case RecordingState.empty:
        setRecordingState(RecordingState.recording);
        startTime = Date.now();
        regionCardStartTime = startTime;
        spatialInterface.analyticsSetDisplayRegion({
            recordingState,
            startTime,
            endTime,
        });
        writePublicData();

        if (!data.title) {
            const dateTimeFormat = new Intl.DateTimeFormat('default', {
                timeStyle: 'short',
                hour12: false,
            });
            data.title = 'Study ' + dateTimeFormat.format(new Date());
            setLabelTitle(data.title);

            spatialInterface.writePublicData('storage', 'analyticsData', data);
            spatialInterface.analyticsHydrate(data);
        }
        break;
    case RecordingState.recording:
        setRecordingState(RecordingState.saving);
        endTime = Date.now();
        spatialInterface.analyticsSetDisplayRegion({
            recordingState,
            startTime,
            endTime,
        });
        writePublicData();
        // user pressed the mark split button during this recording
        if (regionCardStartTime !== startTime && regionCardStartTime > 0) {
            appendRegionCard({
                startTime: regionCardStartTime,
                endTime,
            });
        }

        if (!videoEnabled) {
            setRecordingState(RecordingState.done);
            spatialInterface.writePublicData('storage', 'analyticsData', data);
            spatialInterface.analyticsHydrate(data);
        }
        break;
    case RecordingState.done:
        break;
    }
});

markStepIcon.addEventListener('pointerdown', function() {
    markStepIcon.classList.add('pressed');
});

markStepIcon.addEventListener('pointerleave', function() {
    markStepIcon.classList.remove('pressed');
});

markStepIcon.addEventListener('pointerup', function() {
    markStepIcon.classList.remove('pressed');
    if (recordingState !== RecordingState.recording) {
        return;
    }
    let regionCardEndTime = Date.now();
    appendRegionCard({
        startTime: regionCardStartTime,
        endTime: regionCardEndTime,
    });
    // Immediately start next regionCard
    regionCardStartTime = regionCardEndTime;
});

let lastSetDisplayRegion = {};

envelope.onOpen(() => {
    if (screenDimensions) {
        const {width, height} = screenDimensions;
        spatialInterface.changeFrameSize(width, height);
        updateDocumentStyles(width, height);
    }

    spatialInterface.analyticsOpen();
    if (lastSetDisplayRegion.startTime !== startTime ||
        lastSetDisplayRegion.endTime !== endTime) {
        spatialInterface.analyticsSetDisplayRegion({
            recordingState,
            startTime,
            endTime,
        });
        lastSetDisplayRegion.startTime = startTime;
        lastSetDisplayRegion.endTime = endTime;
    }
    if (data.regionCards.length > 0 || data.videoUrls) {
        spatialInterface.analyticsHydrate(data);
    }
});

let focused = false;
envelope.onFocus(() => {
    focused = true;
    envelopeContainer.style.display = 'block';
    spatialInterface.analyticsFocus();
    if (lastSetDisplayRegion.startTime !== startTime ||
        lastSetDisplayRegion.endTime !== endTime) {
        spatialInterface.analyticsSetDisplayRegion({
            recordingState,
            startTime,
            endTime,
        });
        lastSetDisplayRegion.startTime = startTime;
        lastSetDisplayRegion.endTime = endTime;
    }
    if (data.regionCards.length > 0 || data.videoUrls) {
        spatialInterface.analyticsHydrate(data);
    }
});

envelope.onBlur(() => {
    focused = false;
    envelopeContainer.style.display = 'none';
    spatialInterface.analyticsBlur();
});

envelope.onClose(() => {
    if (!focused) {
        return;
    }
    spatialInterface.analyticsClose();
    if (recordingState === RecordingState.recording) {
        endTime = Date.now();
        writePublicData();
    }
    spatialInterface.changeFrameSize(MINIMIZED_TOOL_WIDTH, MINIMIZED_TOOL_HEIGHT);
    updateDocumentStyles(MINIMIZED_TOOL_WIDTH, MINIMIZED_TOOL_HEIGHT);
    setLabelTitle(labelTitle.textContent);
});

const writePublicData = () => {
    spatialInterface.writePublicData('storage', 'status', {
        startTime,
        endTime,
    });
};

function appendRegionCard(regionCard) {
    data.regionCards.push(regionCard);
    spatialInterface.writePublicData('storage', 'analyticsData', data);
    spatialInterface.analyticsHydrate(data);
}

spatialInterface.onSpatialInterfaceLoaded(function() {
    spatialInterface.setVisibilityDistance(100);
    spatialInterface.setMoveDelay(300);
    spatialInterface.setAlwaysFaceCamera(true);

    spatialInterface.initNode('storage', 'storeData');

    spatialInterface.addReadPublicDataListener('storage', 'status', status => {
        if (status && status.hasOwnProperty('startTime')) {
            startTime = status.startTime;
            endTime = status.endTime;
            if (startTime < 0) {
                setRecordingState(RecordingState.empty);
            } else if (endTime < 0) {
                setRecordingState(RecordingState.recording);
            } else {
                setRecordingState(RecordingState.done);
            }
        }
    });

    spatialInterface.addReadPublicDataListener('storage', 'analyticsData', analyticsData => {
        data = analyticsData;
        if (data.regionCards.length > 0) {
            spatialInterface.analyticsHydrate(analyticsData);
        }
        if (data.title) {
            setLabelTitle(data.title);
        }
    });
    spatialInterface.addReadPublicDataListener('storage', 'cards', migrateCardData);
});

function migrateCardData(cards) {
    if (!cards) {
        return;
    }
    const newCards = cards.filter(card => !data.regionCards.some(existingCard => existingCard.label === card.label));
    newCards.forEach(card => {
        data.regionCards.push(card);
    });
    spatialInterface.writePublicData('storage', 'cards', null);
    spatialInterface.analyticsHydrate(data);
}

function calculateFontSize(stringLength, pixelWidth) {
    return (pixelWidth / stringLength * 2);
}

function setLabelTitle(titleText) {
    label.style.display = '';

    labelTitle.textContent = titleText;
    if (titleText && titleText.length > 0) {
        label.classList.remove('noTitle');
    }

    let labelFontSize = 100;
    if (titleText.length > 6) {
        let labelWidth = label.getBoundingClientRect().width || MINIMIZED_TOOL_WIDTH;
        labelFontSize = calculateFontSize(titleText.length,  labelWidth - 180);
        labelFontSize = Math.max(40, Math.min(100, labelFontSize));
    }
    if (titleText.length > 20) {
        labelTitle.classList.add('longTitle');
    } else {
        labelTitle.classList.remove('longTitle');
    }
    labelTitle.style.fontSize = `${labelFontSize}px`;
}

spatialInterface.wasToolJustCreated((_isFirstCreated) => {
    spatialInterface.getScreenDimensions((width, height) => {
        screenDimensions = {width, height};
    });
    spatialInterface.changeFrameSize(MINIMIZED_TOOL_WIDTH, MINIMIZED_TOOL_HEIGHT);
    updateDocumentStyles(MINIMIZED_TOOL_WIDTH, MINIMIZED_TOOL_HEIGHT);
    setLabelTitle(labelTitle.textContent);
});

// function for changing the tool window size for open and closed states to accommodate title label UI
// (smaller screenizes crop the title)
function updateDocumentStyles(width, height) {
    document.body.width = width + 'px';
    document.body.height = height + 'px';
    document.body.style.width = width + 'px';
    document.body.style.height = height + 'px';
}
