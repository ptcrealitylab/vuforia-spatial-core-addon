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

/*
 *  PHILIPS HUE CONNECTOR
 *
 * This hardware interface can communicate with philips Hue lights. The config.json file specifies the connection information
 * for the lamps in your setup. A light in this config file has the following attributes:
 * {
 * "host":"localhost",                  // ip or hostname of the philips Hue bridge
 * "url":"/api/newdeveloper/lights/1",  // base path of the light on the bridge, replace newdeveloper with a valid username (see http://www.developers.meethue.com/documentation/getting-started)
 * "id":"Light1",                       // the name of the RealityInterface
 * "port":"80"                          // port the hue bridge is listening on (80 on all bridges by default)
 *
 * }
 *
 * Some helpful resources on the Philips Hue API:
 * http://www.developers.meethue.com/documentation/getting-started
 * http://www.developers.meethue.com/documentation/lights-api
 *
 * TODO: Add some more functionality, i.e. change color or whatever the philips Hue API offers
 */

//Enable this hardware interface
var server = require('@libraries/hardwareInterfaces');
var settings = server.loadHardwareInterface(__dirname);

exports.enabled = settings("enabled");
exports.configurable = true; // can be turned on/off/adjusted from the web frontend

if (exports.enabled) {

    var kepware1 = null;

    server.addEventListener('reset', function() {
        console.log('reset kepware');
        kepware1 = null;
        setup();
    });

    // server.addEventListener('shutdown', function() {
    //     console.log('shutdown kepware');
    // });

    function setup() {
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
                helpText: 'The name of the frame on that object where nodes be added.'
            },
            tagsInfo: settings('tagsInfo')
        };

        if (settings('enabled')) {
            var kepware1 = new Kepware(settings('ip'), settings('name'),  settings('port'),  settings('updateRate'), settings('tagsInfo'));
            kepware1.setup();
        }
    }

    function Kepware (kepwareServerIP, kepwareServerName, kepwareServerPort, kepwareServerRequestInterval, kepwareServerTagsInfo) {
        this.KepwareData = function() {
            this.name = "";
            this.id = "";
            this.data = {
                "id": "",
                "s": true,
                "r": "",
                "v": 0,
                "t": 0,
                "min": 10000,
                "max":0,
                "value":0
            };
            this.dataOld = {
                "id": "",
                "s": true,
                "r": "",
                "v": 0,
                "t": 0,
                "min": 10000,
                "max":0,
                "value":0
            };
            this.enabled = true;
        };
        this.kepwareInterfaces = {};
        this.Client = require('node-rest-client').Client;
        this.remoteDevice = new this.Client();
        server.enableDeveloperUI(true);
        this.kepwareAddress = "http://" + kepwareServerIP + ":" + kepwareServerPort + "/iotgateway/";

        console.log("tags info saved in settings.json: ", kepwareServerTagsInfo);

        /**
         * Browse the IoT gateway and create nodes for each found tag. Also starts an update interval.
         */
        this.setup = function () {

            this.thisID = {};
            this.remoteDevice.get(this.kepwareAddress + "browse", function (data, _res) {

                for (var i = 0; i < data.browseResults.length; i++) {
                    this.thisID = data.browseResults[i].id;
                    this.kepwareInterfaces[this.thisID] = new this.KepwareData();
                    this.kepwareInterfaces[this.thisID].id = data.browseResults[i].id;
                    this.kepwareInterfaces[this.thisID].name = this.thisID.substr(this.thisID.lastIndexOf('.') + 1);

                    console.log(kepwareServerName +"_"+ this.kepwareInterfaces[this.thisID].name);

                    // enabled by default, unless there is a specific entry in the settings.tagsInfo saying it is disabled
                    this.kepwareInterfaces[this.thisID].enabled = typeof kepwareServerTagsInfo[this.thisID] === 'undefined' || typeof kepwareServerTagsInfo[this.thisID].enabled === 'undefined' || kepwareServerTagsInfo[this.thisID].enabled;

                    // TODO: better frame naming configuration instead of just appending a "1" to the end of the object name
                    if (this.kepwareInterfaces[this.thisID].enabled) {
                        server.addNode(kepwareServerName, kepwareServerName+"1",this.kepwareInterfaces[this.thisID].name, "node");
                        this.setReadList(kepwareServerName, kepwareServerName+"1",this.thisID, this.kepwareInterfaces[this.thisID].name, this.kepwareInterfaces);
                    } else {
                        // remove node instead of adding if settings.tagsInfo is disabled for this node
                        server.removeNode(kepwareServerName, kepwareServerName+"1",this.kepwareInterfaces[this.thisID].name);
                    }

                }

                server.pushUpdatesToDevices(kepwareServerName);

                this.interval = setInterval(this.start, kepwareServerRequestInterval);

            }.bind(this)).on('error', function (_err) {
                this.error();

            }.bind(this));

        }.bind(this);

        /**
         * When new data arrives at the node from a linked node, write the result to the kepware device using the IoT gateway.
         */
        this.setReadList = function(object, frame, node, name, kepwareInterfaces){

            server.addReadListener(object,frame, name, function (data) {

                kepwareInterfaces[node].data.value = data.value;

                var args = {
                    data: [{id:node, v :  kepwareInterfaces[node].data.value}],
                    headers: { "Content-Type": "application/json" }
                };

                this.remoteDevice.post(this.kepwareAddress + "write", args, function (data, res) {

                }).on('error', function (_err) {
                    this.error();

                }.bind(this));

            }.bind(this));

        }.bind(this);

        /**
         * The update interval that gets called many times per second (defined by settings("updateRate"))
         * Reads all tags at once from the kepware device.
         */
        this.start = function () {

            var argstring = "?";
            for (var key in this.kepwareInterfaces) {
                argstring += "ids="+ key +"&";
            }

            this.remoteDevice.get(this.kepwareAddress + "read"+argstring, function (data, res) {
                // parsed response body as js object

                for (var i = 0; i < data.readResults.length; i++) {
                    var thisID = data.readResults[i].id;

                    if (this.kepwareInterfaces[thisID] && !this.kepwareInterfaces[thisID].enabled) {
                        continue; // don't try to update nodes that are disabled (they don't exist!)
                    }

                    this.kepwareInterfaces[thisID].data.s = data.readResults[i].s;
                    this.kepwareInterfaces[thisID].data.r = data.readResults[i].r;
                    this.kepwareInterfaces[thisID].data.v = data.readResults[i].v;
                    this.kepwareInterfaces[thisID].data.t = data.readResults[i].t;

                    if (typeof this.kepwareInterfaces[thisID].data.v === "boolean" ) { // converts boolean to 0 or 1 because nodes can only handle numbers
                        this.kepwareInterfaces[thisID].data.v = this.kepwareInterfaces[thisID].data.v ? 1 : 0;
                    }
                    if (isNaN(this.kepwareInterfaces[thisID].data.v)) {
                        console.warn(thisID + ' kepware tag value isNaN ' + this.kepwareInterfaces[thisID].data.v);
                        this.kepwareInterfaces[thisID].data.v = 0; // uses 0 as default node value if NaN
                    }

                    let definedMin = this.kepwareInterfaces[thisID].min;
                    let definedMax = this.kepwareInterfaces[thisID].max;
                    let definedUnit = this.kepwareInterfaces[thisID].unit;

                    if (typeof definedMax === 'undefined') {
                        // continuously adjusts min and max based on values it's seen so far
                        if (this.kepwareInterfaces[thisID].data.v > this.kepwareInterfaces[thisID].data.max) {
                            this.kepwareInterfaces[thisID].data.max = this.kepwareInterfaces[thisID].data.v;
                        }
                    } else {
                        this.kepwareInterfaces[thisID].data.max = definedMax;
                    }

                    if (typeof definedMin === 'undefined') {
                        // continuously adjusts min and max based on values it's seen so far
                        if (this.kepwareInterfaces[thisID].data.v < this.kepwareInterfaces[thisID].data.min) {
                            this.kepwareInterfaces[thisID].data.min = this.kepwareInterfaces[thisID].data.v;
                        }
                    } else {
                        this.kepwareInterfaces[thisID].data.min = definedMin;
                    }

                    // clip readings to their [min - max] range, and then normalize them to the range of [0 - 1]
                    if (this.kepwareInterfaces[thisID].data.v < this.kepwareInterfaces[thisID].data.min) {
                        this.kepwareInterfaces[thisID].data.v = this.kepwareInterfaces[thisID].data.min;
                    }
                    if (this.kepwareInterfaces[thisID].data.v > this.kepwareInterfaces[thisID].data.max) {
                        this.kepwareInterfaces[thisID].data.v = this.kepwareInterfaces[thisID].data.max;
                    }
                    this.kepwareInterfaces[thisID].data.value = Math.round(server.map(this.kepwareInterfaces[thisID].data.v, this.kepwareInterfaces[thisID].data.min, this.kepwareInterfaces[thisID].data.max, 0, 1) * 1000) / 1000;

                    // if the new value is different than the previous value, write to the node -> propagate value to rest of the system
                    if (this.kepwareInterfaces[thisID].name && (this.kepwareInterfaces[thisID].dataOld.value !== this.kepwareInterfaces[thisID].data.value)) {

                        // write the normalized value to the server
                        server.write(kepwareServerName,
                            kepwareServerName + "1", // TODO: make frame name configurable instead of just kepwareBox -> kepwareBox1
                            this.kepwareInterfaces[thisID].name,
                            this.kepwareInterfaces[thisID].data.value,
                            "f", // floating point
                            definedUnit || this.kepwareInterfaces[thisID].name,
                            this.kepwareInterfaces[thisID].data.min,
                            this.kepwareInterfaces[thisID].data.max);

                    }

                    this.kepwareInterfaces[thisID].dataOld.value = this.kepwareInterfaces[thisID].data.value;
                }

            }.bind(this)).on('error', function (_err) {
                this.error();

            }.bind(this));

        }.bind(this);

        /**
         * If there's ever an error with connecting to the IoT gateway, print debug information.
         */
        this.error = function() {
            console.log("cant find kepware server: \033[33m"+ kepwareServerName +"\033[0m with the IP: \033[33m"+ kepwareServerIP+"\033[0m");
        }
    }

    setup();
}
