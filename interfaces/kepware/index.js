/**
 * Copyright (c) 2018 PTC
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

const KepwareClient = require('./kepwareClient');
var server = require('../../../../libraries/hardwareInterfaces');
var settings = server.loadHardwareInterface(__dirname);
var kepwareClient = new KepwareClient('Spatial Toolbox');

exports.enabled = settings('enabled', false);
exports.configurable = true; // can be turned on/off/adjusted from the web frontend

const parseId = (nodeId) => {
  const split = nodeId.split('.');
  if (split.length === 3) {
    return {
      channelName: split[0].split(' ').join(''),
      objectName: split[1].split(' ').join(''),
      frameName: split[2].split(' ').join(''), // If not in a group, consider it in a group of itself
      tagName: split[2].split(' ').join('')
    }
  }
  return {
    channelName: split[0].split(' ').join(''),
    objectName: split[1].split(' ').join(''),
    frameName: split.slice(2, split.length - 1).join('_').split(' ').join(''),
    tagName: split[split.length - 1].split(' ').join('')
  }
}

const createNode = (tag) => {
  const {objectName, frameName, tagName} = parseId(tag.nodeId);
  kepwareClient.getTagPermissions(tag).then(permissions => {
    if (permissions.canRead) {
      server.addNode(`${settings('name')}_${objectName}`, frameName, tagName, 'node', {x:0,y:0});
    }
    if (permissions.canWrite) {
      server.addReadListener(`${settings('name')}_${objectName}`, frameName, tagName, data => {
        kepwareClient.writeTag(tag, data.value);
      });
    }
  });
  kepwareClient.monitorTag(tag, value => {
    server.write(`${settings('name')}_${objectName}`, frameName, tagName, value);
  })
}

const removeNode = (tag) => {
  const {objectName, frameName, tagName} = parseId(tag.nodeId);
  server.removeNode(`${settings('name')}_${objectName}`, frameName, tagName);
}

const onKepwareConnect = () => {
  kepwareClient.getAllTags().then(allTags => {
    const enabledTags = settings('enabledTags', []);
    allTags.forEach(tag => {
      if (enabledTags.find(enabledTag => enabledTag.nodeId === tag.nodeId)) {
        createNode(tag);
      } else {
        removeNode(tag);
      }
    })
    exports.allTags = allTags;
  });
}

if (exports.enabled) {
  server.addEventListener('reset', function() {
    console.log('Resetting Kepware interface');
    exports.allTags = [];
    kepwareClient.disconnect().catch(err => {
      console.error(err);
    }).finally(() => {
      setup();
    });
  });

  function setup() { // eslint-disable-line no-inner-declarations
    settings = server.loadHardwareInterface(__dirname);
    
    /**
    * These settings will be exposed to the webFrontend to potentially be modified
    */
    exports.settings = {
      endpointUrl: {
        value: settings('endpointUrl', ''),
        type: 'text',
        helpText: 'The url and port (example: 192.168.1.189:49330) of the Kepware OPC UA endpoint you want to connect to.'
      },
      username: {
        value: settings('username', ''),
        type: 'text',
        helpText: 'The username used to connect to the Kepware OPC UA server.'
      },
      password: {
        value: settings('password', ''),
        type: 'text',
        helpText: 'The password used to connect to the Kepware OPC UA server.'
      },
      name: {
        value: settings('name', 'kepware'),
        type: 'text',
        helpText: 'The prefix of the Reality Object where nodes for each tag will be created.'
      },
      enabledTags: {
        value: settings('enabledTags', []),
        type: 'array',
        helpText: 'The tags for which nodes will be created.',
        hidden: true
      }
    };
    
    if (settings('enabled', false)) {
      const url = settings('endpointUrl', '');
      const credentials = {
        userName: settings('username', ''),
        password: settings('password', '')
      }
      kepwareClient.connect(url, credentials).then(onKepwareConnect).catch((e) => console.warn(e));
      server.enableDeveloperUI(true);
    }
  }
}
