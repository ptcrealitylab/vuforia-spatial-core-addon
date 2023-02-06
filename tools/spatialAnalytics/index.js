/* global Envelope, SpatialInterface */

let spatialInterface;

let startTime = -1; // 1675441836335 + 20; // Date.now();
let endTime = -1; // 1675443006371 - 30; // -1;

if (!spatialInterface) {
    spatialInterface = new SpatialInterface();
}

const launchButton = document.querySelector('#launchButton');
launchButton.addEventListener('pointerup', function () {
    envelope.open();
}, false);
const envelopeContainer = document.querySelector('#envelopeContainer');
const envelope = new Envelope(spatialInterface, [], envelopeContainer, launchButton, false, false);
envelope.onOpen(() => {
    if (startTime < 0) {
        startTime = Date.now();
        writePublicData();
    }

    spatialInterface.analyticsAdd();
    spatialInterface.analyticsSetDisplayRegion({
        startTime,
        endTime,
    });
});
envelope.onClose(() => {
    spatialInterface.analyticsRemove();
    if (endTime < 0) {
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
        console.log('rpdl status', status);
        if (status && status.hasOwnProperty('startTime')) {
            startTime = status.startTime;
            endTime = status.endTime;
        }
    });
});
