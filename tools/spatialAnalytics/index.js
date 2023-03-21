/* global Envelope, SpatialInterface, isDesktop */

let spatialInterface;

let startTime = Date.now(); // 1675809876408 - 20
let endTime = -1; // 1675809963335 + 3 * 60 * 60 * 1000;
let knownRegionCards = [];

if (!spatialInterface) {
    spatialInterface = new SpatialInterface();
}

const launchButton = document.getElementById('launchButton');
launchButton.addEventListener('pointerup', function () {
    envelope.open();
}, false);
const envelopeContainer = document.querySelector('#envelopeContainer');
const envelope = new Envelope(spatialInterface, [], envelopeContainer, launchButton, false, false);
const recordingIcon = document.querySelector('.recordingIcon');

const RecordingState = {
    empty: 'empty',
    recording: 'recording',
    done: 'done',
};
let recordingState = RecordingState.empty;

function setRecordingState(newState) {
    recordingState = newState;
    switch (recordingState) {
    case RecordingState.empty:
        recordingIcon.src = 'sprites/empty.png';
        break;
    case RecordingState.recording:
        recordingIcon.src = 'sprites/recording.png';
        break;
    case RecordingState.done:
        recordingIcon.style.display = 'none';
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
            startTime,
            endTime,
        });
        writePublicData();
        break;
    case RecordingState.recording:
        setRecordingState(RecordingState.done);
        endTime = Date.now();
        spatialInterface.analyticsSetDisplayRegion({
            startTime,
            endTime,
        });
        writePublicData();
        break;
    case RecordingState.done:
        break;
    }
});

envelope.onOpen(() => {
    spatialInterface.analyticsAdd();
    spatialInterface.analyticsSetDisplayRegion({
        startTime,
        endTime,
    });
    spatialInterface.analyticsHydrateRegionCards(knownRegionCards);
});
envelope.onClose(() => {
    spatialInterface.analyticsRemove();
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
            if (status.summary) {
                const container = document.createElement('div');
                container.id = 'summaryContainer';
                // TODO if the socket io connection is compromised then this is
                // compromised too
                container.innerHTML = status.summary;
                launchButton.appendChild(container);
                launchButton.style.width = '2400px';
                launchButton.style.height = '1600px';
                spatialInterface.changeFrameSize(2400, 1600);
                const card = container.querySelector('.analytics-region-card');
                card.setAttribute('style', '');
                // card.classList.add('minimized');
                // card.addEventListener('pointermove', () => { // should be `over`
                //     card.classList.remove('minimized');
                // });
                // card.addEventListener('pointerout', () => {
                //     card.classList.add('minimized');
                // });
                let pin = container.querySelector('.analytics-region-card-pin');
                pin.parentNode.removeChild(pin);
                let enter = container.querySelector('.analytics-region-card-enter');
                enter.parentNode.removeChild(enter);

                const launchIcon = document.getElementById('launchIcon');
                launchIcon.parentNode.removeChild(launchIcon);
            }
        }
    });

    spatialInterface.addReadPublicDataListener('storage', 'cards', cards => {
        knownRegionCards = cards;
    });
});
