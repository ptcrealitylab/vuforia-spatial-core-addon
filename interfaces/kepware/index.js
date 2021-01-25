/**
 * Copyright (c) 2018 PTC
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

const Kepware = require('./kepware');
var kepwareObjects = [];
var server = require('../../../../libraries/hardwareInterfaces');
var settings = server.loadHardwareInterface(__dirname);
var kepware;
var itemCounts = {};

exports.enabled = settings('enabled');
exports.configurable = true; // can be turned on/off/adjusted from the web frontend

const isObjectEnabled = (deviceName, groupName, tagName) => {
    const enabledKepwareObjects = settings('enabledKepwareObjects', []);
    return enabledKepwareObjects.some(enabledKepObj=>enabledKepObj.machine===deviceName&&enabledKepObj.frame===groupName&&enabledKepObj.tag===tagName);
}

const createObjectNodes = (objectName, frameName, nodeName, item, permissions) => {
    if (permissions.canRead) {
        server.addNode(objectName, frameName, `read${nodeName}`, 'node', {x:50,y:itemCounts[objectName]*100});
    }
    if (permissions.canWrite) {
        server.addNode(objectName, frameName, `write${nodeName}`, 'node', {x:-50,y:itemCounts[objectName]*100});
        server.addReadListener(objectName, frameName, `write${nodeName}`, data => {
            kepware.writeItem(item, data.value);
        });
    }
    if (!itemCounts[objectName]) {
        itemCounts[objectName] = 0;
    }
    itemCounts[objectName]++;
    // console.log(`Added item ${item.browseName.name}`);
}

const writeObjectNode = (objectName, frameName, nodeName, value) => {
    server.write(objectName, frameName, `read${nodeName}`, value);
    // console.log(`Writing to ${objectName} ${frameName} read${nodeName}: ${value}`);
}

const removeObjectNodes = (objectName, frameName, nodeName) => {
    server.removeNode(objectName, frameName, `read${nodeName}`);
    server.removeNode(objectName, frameName, `write${nodeName}`);
    // console.log(`Removed item ${item.browseName.name}`);
}

if (exports.enabled) {
    const onItemAdd = (item, permissions) => {
        const parsedId = Kepware.parseId(item.nodeId);
        const objectName = `${settings('name')}_${parsedId.deviceName}`;
        const frameName = parsedId.groupName;
        const nodeName = parsedId.tagName;
        if (permissions.canRead || permissions.canWrite) {
            const kepwareObject = kepwareObjects.find(kepObj=>kepObj.name===parsedId.deviceName) || {name:parsedId.deviceName, frames:[]};
            if (!kepwareObjects.includes(kepwareObject)) {
                kepwareObjects.push(kepwareObject);
            }
            const frame = kepwareObject.frames.find(kFrame=>kFrame.name===frameName) || {name:parsedId.groupName, tags:[]};
            if (!kepwareObject.frames.includes(frame)) {
                kepwareObject.frames.push(frame);
            }
            const tag = frame.tags.find(kTag=>kTag.name===nodeName) || {name:parsedId.tagName, enabled:false};
            if (!frame.tags.includes(tag)) {
                frame.tags.push(tag);
            }
        }
        
        if (isObjectEnabled(parsedId.deviceName, parsedId.groupName, parsedId.tagName)) {
            createObjectNodes(objectName, frameName, nodeName, item, permissions);
        } else {
            removeObjectNodes(objectName, frameName, nodeName);
        }
    }

    const onItemUpdate = (item, result) => {
        const parsedId = Kepware.parseId(item.nodeId);
        const objectName = `${settings('name')}_${parsedId.deviceName}`;
        const frameName = parsedId.groupName;
        const nodeName = parsedId.tagName;
        if (isObjectEnabled(parsedId.deviceName, parsedId.groupName, parsedId.tagName)) {
            // console.log(`Monitored item update for ${item.nodeId.toString().slice(0, item.nodeId.toString().lastIndexOf('.'))} ${item.browseName.name}: ${result.value.value}`);
            writeObjectNode(objectName, frameName, nodeName, Number(result.value.value));
        }
    }

    const onItemRemove = (item) => {
        const parsedId = Kepware.parseId(item.nodeId);
        const objectName = `${settings('name')}_${parsedId.deviceName}`;
        const frameName = parsedId.groupName;
        const nodeName = parsedId.tagName;
        const kepwareObject = kepwareObjects.find(kepObj=>kepObj.name===parsedId.deviceName) || {name:parsedId.deviceName, frames:[]};
        const kepwareFrame = kepwareObject.frames.find(kepFrame=>kepFrame.name===parsedId.groupName) || {name:parsedId.groupName, tags:[]};
        const kepwareTag = kepwareFrame.tags.find(kepTag=>kepTag.name===parsedId.tagName) || {name:parsedId.tagName, enabled:false};
        const tagIndex = kepwareFrame.tags.indexOf(kepwareTag);
        if (tagIndex >= 0) {
            kepwareFrame.tags.splice(tagIndex, 1);
        }
        if (isObjectEnabled(parsedId.deviceName, parsedId.groupName, parsedId.tagName)) {
            removeObjectNodes(objectName, frameName, nodeName);
        }
    }

    server.addEventListener('reset', function() {
        console.log('Resetting Kepware interface');
        if (kepware) {
            kepware.disconnect();
        }
        setup();
    });

    function setup() { // eslint-disable-line no-inner-declarations
        settings = server.loadHardwareInterface(__dirname);
        itemCounts = {};
        kepwareObjects = [];
        
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
            },
            enabledKepwareObjects: {
                value: settings('enabledKepwareObjects', []),
                type: 'array',
                helpText: 'The tags for which nodes will be created.',
                hidden: true
            }
        };
        exports.availableKepwareObjects = kepwareObjects;

        if (settings('enabled')) {
            console.log('Setting up Kepware interface');
            console.log({userName:settings('username', ''), password:settings('password', '')})
            kepware = new Kepware(settings('discoveryUrl', ''), {userName:settings('username', ''), password:settings('password', '')}, onItemAdd, onItemUpdate, onItemRemove);
            kepware.connect();
            server.enableDeveloperUI(true);
        }
    }
}
