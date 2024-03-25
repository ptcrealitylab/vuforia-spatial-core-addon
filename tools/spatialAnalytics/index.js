/* global Envelope, SpatialInterface, isDesktop */
const MINIMIZED_TOOL_WIDTH = 1200;
const MINIMIZED_TOOL_HEIGHT = 600;

const RECORD_VIDEO = false;

let spatialInterface;

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
        markStepIcon.style.display = 'none';
        break;
    case RecordingState.recording:
        recordingIcon.src = 'sprites/recording.png';
        markStepIcon.style.display = 'inline';
        recIconBackground.classList.add('recording');
        break;
    case RecordingState.saving:
        recordingIcon.src = 'sprites/saving.svg';
        markStepIcon.style.display = 'none';
        recIconBackground.classList.add('recording');
        break;

    case RecordingState.done:
        recordingIcon.style.display = 'none';
        markStepIcon.style.display = 'none';
        msIconBackground.style.display = 'none';
        recIconBackground.style.display = 'none';
        iconContainer.style.display = 'none';
        break;
    }

    if (recordingState === RecordingState.done && !isDesktop()) {
        const message = document.createElement('p');
        message.textContent = 'Recording Done';
        message.classList.add('recordingDone');
        envelopeContainer.appendChild(message);
    }
}

recordingIcon.addEventListener('pointerup', function() {
    switch (recordingState) {
    case RecordingState.empty:
        setRecordingState(RecordingState.recording);
        startTime = Date.now();
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

        if (RECORD_VIDEO) {
            spatialInterface.startVirtualizerRecording();
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

        if (RECORD_VIDEO) {
            spatialInterface.stopVirtualizerRecording((baseUrl, recordingId, deviceId) => {
                setRecordingState(RecordingState.done);
                const urls = {
                    color: `${baseUrl}/virtualizer_recordings/${deviceId}/color/${recordingId}.mp4`,
                    rvl: `${baseUrl}/virtualizer_recordings/${deviceId}/depth/${recordingId}.dat`
                };
                data.videoUrls = urls;
                spatialInterface.writePublicData('storage', 'analyticsData', data);
                spatialInterface.analyticsHydrate(data);
            });
        } else {
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
    if (regionCardStartTime > 0) {
        let regionCardEndTime = Date.now();
        appendRegionCard({
            startTime: regionCardStartTime,
            endTime: regionCardEndTime,
        });
        regionCardStartTime = -1;
        markStepIcon.parentNode.classList.remove('end');
        markStepIcon.parentNode.classList.add('start');
    } else {
        regionCardStartTime = Date.now();
        markStepIcon.parentNode.classList.remove('start');
        markStepIcon.parentNode.classList.add('end');
    }
});

let lastSetDisplayRegion = {};

envelope.onOpen(() => {
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
    iconContainer.style.display = 'block';
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
    iconContainer.style.display = 'none';
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
    let labelTitle = document.getElementById('labelTitle');
    let label = document.getElementById('label');
    label.style.display = '';

    labelTitle.innerText = titleText;
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

spatialInterface.changeFrameSize(MINIMIZED_TOOL_WIDTH, MINIMIZED_TOOL_HEIGHT);
