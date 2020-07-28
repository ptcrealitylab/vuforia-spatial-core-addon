/**
 * Copyright (c) 2018 PTC
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

const Kepware = require('./kepware');
var server = require('../../../../libraries/hardwareInterfaces');
var settings = server.loadHardwareInterface(__dirname);
var kepware;
var itemCounts = {};

exports.enabled = settings('enabled');
exports.configurable = true; // can be turned on/off/adjusted from the web frontend

if (exports.enabled) {
    const onItemAdd = (item, permissions) => {
        const parsedId = Kepware.parseId(item.nodeId);
        const objectName = `${settings('name')}.${parsedId.deviceName}`;
        const frameName = parsedId.groupName;
        const nodeName = parsedId.tagName;
        if (permissions.canRead) {
            server.addNode(objectName, frameName, `read${nodeName}`, 'node', {x:50,y:itemCounts[objectName]*100});
        }
        if (permissions.canWrite) {
            server.addNode(objectName, frameName, `write${nodeName}`, 'node', {x:-50,y:itemCounts[objectName]*100});
            server.addReadListener(objectName, frameName, `write${nodeName}`, data => {
                // console.log(`Writing data for ${item.browseName.name} = ${data.value}`);
                kepware.writeItem(item, data.value);
            });
        }
        if (!itemCounts[objectName]) {
            itemCounts[objectName] = 0;
        }
        itemCounts[objectName]++;
        // console.log(`Added item ${item.browseName.name}`);
    }

    const onItemUpdate = (item, result) => {
        const parsedId = Kepware.parseId(item.nodeId);
        const objectName = `${settings('name')}.${parsedId.deviceName}`;
        const frameName = parsedId.groupName;
        const nodeName = parsedId.tagName;
        server.write(objectName, frameName, `read${nodeName}`, Number(result.value.value));
        // console.log(`Monitored item update for ${nodeId.slice(0, nodeId.lastIndexOf('.'))} ${item.browseName.name}: ${result.value.value}`);
    }

    const onItemRemove = (item) => {
        const parsedId = Kepware.parseId(item.nodeId);
        const objectName = `${settings('name')}.${parsedId.deviceName}`;
        const frameName = parsedId.groupName;
        const nodeName = parsedId.tagName;
        server.removeNode(objectName, frameName, `read${nodeName}`);
        server.removeNode(objectName, frameName, `write${nodeName}`);
        // console.log(`Removed item ${item.browseName.name}`);
    }

    server.addEventListener('reset', function() {
        console.log('Resetting Kepware interface');
        if (kepware) {
            kepware.disconnect();
        }
        itemCounts = {};
        setup();
    });

    function setup() { // eslint-disable-line no-inner-declarations
        settings = server.loadHardwareInterface(__dirname);
        
        /**
         * These settings will be exposed to the webFrontend to potentially be modified
         */
        exports.settings = {
            discoveryUrl: {
                value: settings('discoveryUrl', ''), // "opc.tcp://ubuntuPtc.local:49330"
                type: 'text',
                helpText: 'The url and port (default: 49330) of the Kepware OPC UA discovery endpoint you want to connect to.'
            },
            username: {
                value: settings('username', ''),
                type: 'text',
                helpText: 'The username used to connect to the Kepware OPC UA server'
            },
            password: {
                value: settings('password', ''),
                type: 'text',
                helpText: 'The password used to connect to the Kepware OPC UA server'
            },
            name: {
                value: settings('name', 'kepware'),
                type: 'text',
                helpText: 'The prefix of the Reality Object where nodes for each tag will be created.'
            }
        };

        if (settings('enabled')) {
            console.log('Setting up Kepware interface');
            kepware = new Kepware(settings('discoveryUrl', ''), {userName:settings('username', ''), password:settings('password', '')}, onItemAdd, onItemUpdate, onItemRemove);
            kepware.connect();
            server.enableDeveloperUI(true);
        }
    }
}
