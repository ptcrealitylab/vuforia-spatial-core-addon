/**
 * Created by Carsten on 12/06/15.
 * Modified by Peter Som de Cerff (PCS) on 12/21/15
 *
 * Copyright (c) 2015 Carsten Strunk
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

const NodeRestClient = require('node-rest-client').Client;

//Enable this hardware interface
var server = require('@libraries/hardwareInterfaces');
var settings = server.loadHardwareInterface(__dirname);

exports.enabled = settings('enabled');
exports.configurable = true; // can be turned on/off/adjusted from the web frontend

if (exports.enabled) {

    let kepware1 = null;

    server.addEventListener('reset', function() {
        console.log('reset kepware');
        kepware1 = null;
        setup();
    });

    function setup() { // eslint-disable-line no-inner-declarations
        console.log('setup kepware');
        settings = server.loadHardwareInterface(__dirname);

        /**
         * These settings will be exposed to the webFrontend to potentially be modified
         */
        exports.settings = {
            ip: {
                value: settings('ip'),
                type: 'text',
                helpText: 'The IP address of the KEPServerEX you want to connect to.'
            },
            port: {
                value: settings('port'),
                type: 'number',
                default: 39320,
                helpText: 'The port of the IoT Gateway on the KEPServerEx.'
            },
            updateRate: {
                value: settings('updateRate'),
                type: 'number',
                default: 100,
                helpText: 'How many times per second to stream data into this server from the IoT Gateway.'
            },
            name: {
                value: settings('name'),
                type: 'text',
                helpText: 'The name of the Reality Object where nodes for each tag will be created.'
            },
            frameName: {
                value: settings('frameName'),
                type: 'text',
                helpText: 'The name of the frame on that object where nodes will be added.'
            },
            tagsInfo: settings('tagsInfo')
        };

        if (settings('enabled')) {
            kepware1 = new Kepware(settings('ip'), settings('name'),  settings('port'),  settings('updateRate'), settings('tagsInfo'));
            kepware1.setup();
        }
    }


    setup();
}

function KepwareData() {
    this.name = '';
    this.id = '';
    this.data = {
        id: '',
        s: true,
        r: '',
        v: 0,
        t: 0,
        min: 10000,
        max: 0,
        value: 0
    };
    this.dataOld = {
        id: '',
        s: true,
        r: '',
        v: 0,
        t: 0,
        min: 10000,
        max: 0,
        value: 0
    };
    this.enabled = true;
}

/**
 * @param {string} kepwareServerIP
 * @param {string} kepwareServerName
 * @param {number} kepwareServerRequestInterval
 * @param {Object} kepwareServerTagsInfo
 */
function Kepware(kepwareServerIP, kepwareServerName, kepwareServerPort, kepwareServerRequestInterval, kepwareServerTagsInfo) {
    this.kepwareServerIP = kepwareServerIP;
    this.kepwareServerName = kepwareServerName;
    this.kepwareServerPort = kepwareServerPort;

    this.kepwareInterfaces = {};
    this.remoteDevice = new NodeRestClient();
    server.enableDeveloperUI(true);
    this.kepwareAddress = 'http://' + kepwareServerIP + ':' + kepwareServerPort + '/iotgateway/';

    console.log('tags info saved in settings.json: ', kepwareServerTagsInfo);

    this.setup = this.setup.bind(this);
    this.setReadList = this.setReadList.bind(this);
    this.start = this.start.bind(this);
    this.error = this.error.bind(this);
}

/**
 * Browse the IoT gateway and create nodes for each found tag. Also starts an update interval.
 */
Kepware.prototype.setup = function() {
    this.remoteDevice.get(this.kepwareAddress + 'browse', (data, _res) => {
        for (var i = 0; i < data.browseResults.length; i++) {
            const id = data.browseResults[i].id;
            const kepwareInterface = new KepwareData();
            this.kepwareInterfaces[id] = kepwareInterface;
            kepwareInterface.id = data.browseResults[i].id;
            kepwareInterface.name = id.substr(id.lastIndexOf('.') + 1);

            console.log(this.kepwareServerName + '_' + kepwareInterface.name);

            const tagInfo = this.kepwareServerTagsInfo[id];
            // enabled by default, unless there is a specific entry in the settings.tagsInfo saying it is disabled
            kepwareInterface.enabled = !tagInfo || tagInfo.enabled;

            if (kepwareInterface.enabled) {
                server.addNode(this.kepwareServerName, this.getFrameName(this.kepwareServerName), kepwareInterface.name, 'node');
                this.setReadList(this.kepwareServerName, this.getFrameName(this.kepwareServerName), id, kepwareInterface.name);
            } else {
                // remove node instead of adding if settings.tagsInfo is disabled for this node
                server.removeNode(this.kepwareServerName, this.getFrameName(this.kepwareServerName), kepwareInterface.name);
            }

        }

        server.pushUpdatesToDevices(this.kepwareServerName);

        this.interval = setInterval(this.start, this.kepwareServerRequestInterval);
    }).on('error', (err) => {
        this.error(err);
    });
};

// TODO: better frame naming configuration instead of just appending a '1' to the end of the object name
Kepware.prototype.getFrameName = function(serverName) {
    return serverName + '1';
};

/**
 * When new data arrives at the node from a linked node, write the result to the kepware device using the IoT gateway.
 */
Kepware.prototype.setReadList = function(object, frame, node, name) {
    server.addReadListener(object, frame, name, (data) => {
        this.kepwareInterfaces[node].data.value = data.value;

        var args = {
            data: [{id: node, v: this.kepwareInterfaces[node].data.value}],
            headers: { 'Content-Type': 'application/json' }
        };

        this.remoteDevice.post(this.kepwareAddress + 'write', args, (_data, _res) => {
        }).on('error', () => {
            this.error();
        });
    });
};

/**
 * The update interval that gets called many times per second (defined by settings('updateRate'))
 * Reads all tags at once from the kepware device.
 */
Kepware.prototype.start = function() {
    var argstring = '?';
    for (var key in this.kepwareInterfaces) {
        argstring += 'ids=' + key + '&';
    }

    this.remoteDevice.get(this.kepwareAddress + 'read' + argstring, function(data, _res) {
        // parsed response body as js object

        for (var i = 0; i < data.readResults.length; i++) {
            var id = data.readResults[i].id;
            const kepwareInterface = this.kepwareInterfaces[id];

            if (kepwareInterface && !kepwareInterface.enabled) {
                continue; // don't try to update nodes that are disabled (they don't exist!)
            }

            kepwareInterface.data.s = data.readResults[i].s;
            kepwareInterface.data.r = data.readResults[i].r;
            kepwareInterface.data.v = data.readResults[i].v;
            kepwareInterface.data.t = data.readResults[i].t;

            const tagInfo = this.kepwareServerTagsInfo[id];
            let definedUnit = tagInfo ? tagInfo.unit : undefined;

            this.normalizeData(id, kepwareInterface);

            // if the new value is different than the previous value, write to the node -> propagate value to rest of the system
            if (kepwareInterface.name && (kepwareInterface.dataOld.value !== kepwareInterface.data.value)) {

                // write the normalized value to the server
                server.write(this.kepwareServerName,
                    this.getFrameName(this.kepwareServerName),
                    kepwareInterface.name,
                    kepwareInterface.data.value,
                    'f', // floating point
                    definedUnit || kepwareInterface.name,
                    kepwareInterface.data.min,
                    kepwareInterface.data.max);
            }

            kepwareInterface.dataOld.value = kepwareInterface.data.value;
        }
    }).on('error', (err) => {
        this.error(err);
    });
};

/**
 * Normalize the data value of a KepwareData for sending along in the server
 * @param {string} id
 * @param {KepwareData} kepwareInterface
 */
Kepware.prototype.normalizeData = function(id, kepwareInterface) {
    if (typeof kepwareInterface.data.v === 'boolean' ) { // converts boolean to 0 or 1 because nodes can only handle numbers
        kepwareInterface.data.v = kepwareInterface.data.v ? 1 : 0;
    }
    if (isNaN(kepwareInterface.data.v)) {
        console.warn(id + ' kepware tag value isNaN ' + kepwareInterface.data.v);
        kepwareInterface.data.v = 0; // uses 0 as default node value if NaN
    }

    const tagInfo = this.kepwareServerTagsInfo[id];
    let definedMin = tagInfo ? tagInfo.min : undefined;
    let definedMax = tagInfo ? tagInfo.max : undefined;

    if (typeof definedMax === 'undefined') {
        // continuously adjusts min and max based on values it's seen so far
        kepwareInterface.data.max = Math.max(1, Math.max(kepwareInterface.data.v, kepwareInterface.data.max));
    } else {
        kepwareInterface.data.max = definedMax;
    }

    if (typeof definedMin === 'undefined') {
        // continuously adjusts min and max based on values it's seen so far
        kepwareInterface.data.min = Math.min(0, Math.min(kepwareInterface.data.v, kepwareInterface.data.min));
    } else {
        kepwareInterface.data.min = definedMin;
    }

    // clip readings to their [min - max] range, and then normalize them to the range of [0 - 1]
    if (kepwareInterface.data.v < kepwareInterface.data.min) {
        kepwareInterface.data.v = kepwareInterface.data.min;
    }
    if (kepwareInterface.data.v > kepwareInterface.data.max) {
        kepwareInterface.data.v = kepwareInterface.data.max;
    }
    kepwareInterface.data.value = Math.round(server.map(kepwareInterface.data.v, kepwareInterface.data.min, kepwareInterface.data.max, 0, 1) * 1000) / 1000;
};

/**
 * If there's ever an error with connecting to the IoT gateway, print debug information.
 */
Kepware.prototype.error = function(_err) {
    //  console.error('kepware error', err); // todo err just outputs a gigantic json object. Needs some more specifics.
    console.error('cant find kepware server: \033[33m' + this.kepwareServerName + '\033[0m with the IP: \033[33m' + this.kepwareServerIP + '\033[0m');
};
