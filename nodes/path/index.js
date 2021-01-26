/**
 * @preserve
 *
 *                                     .,,,;;,'''..
 *                                 .'','...     ..',,,.
 *                               .,,,,,,',,',;;:;,.  .,l,
 *                              .,',.     ...     ,;,   :l.
 *                             ':;.    .'.:do;;.    .c   ol;'.
 *      ';;'                   ;.;    ', .dkl';,    .c   :; .'.',::,,'''.
 *     ',,;;;,.                ; .,'     .'''.    .'.   .d;''.''''.
 *    .oxddl;::,,.             ',  .'''.   .... .'.   ,:;..
 *     .'cOX0OOkdoc.            .,'.   .. .....     'lc.
 *    .:;,,::co0XOko'              ....''..'.'''''''.
 *    .dxk0KKdc:cdOXKl............. .. ..,c....
 *     .',lxOOxl:'':xkl,',......'....    ,'.
 *          .';:oo:...                        .
 *               .cd,    ╔═╗┌─┐┬─┐┬  ┬┌─┐┬─┐   .
 *                 .l;   ╚═╗├┤ ├┬┘└┐┌┘├┤ ├┬┘   '
 *                   'l. ╚═╝└─┘┴└─ └┘ └─┘┴└─  '.
 *                    .o.                   ...
 *                     .''''','.;:''.........
 *                          .'  .l
 *                         .:.   l'
 *                        .:.    .l.
 *                       .x:      :k;,.
 *                       cxlc;    cdc,,;;.
 *                      'l :..   .c  ,
 *                      o.
 *                     .,
 *
 *             ╦ ╦┬ ┬┌┐ ┬─┐┬┌┬┐  ╔═╗┌┐  ┬┌─┐┌─┐┌┬┐┌─┐
 *             ╠═╣└┬┘├┴┐├┬┘│ ││  ║ ║├┴┐ │├┤ │   │ └─┐
 *             ╩ ╩ ┴ └─┘┴└─┴─┴┘  ╚═╝└─┘└┘└─┘└─┘ ┴ └─┘
 *
 * Created by Valentin on 10/22/14.
 *
 * Copyright (c) 2015 Valentin Heun
 *
 * All ascii characters above must be included in any redistribution.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/**
 * @desc prototype for a plugin. This prototype is called when a value should be changed.
 * It defines how this value should be transformed before sending it to the destination.
 * @param {object} objectID Origin object in which the related link is saved.
 * @param {string} linkID the id of the link that is related to the call
 * @param {object} inputData the data that needs to be processed
 * @param {function} callback the function that is called for when the process is rendered.
 * @note the callback has the same structure then the initial prototype, however inputData has changed to outputData
 **/

const Data = require('../../../../models/Data');

var generalProperties = {
    name: 'Path',
    privateData: {},
    publicData: {
        pathList: {
            list: [],
            mode: 'PATH',
            worldObject: null
        },
        pathPoints: {},
    },
    type: 'path',
    inputTypes: ['pathList', 'pathPoint'],
    invisible: false
};

exports.properties = generalProperties;

exports.setup = function (_object, _tool, _node, _activeBlockProperties) {
    // add code here that should be executed once.
};

exports.render = function (object, tool, node, thisNode, callback, utilities) {
    if (!utilities) return; // only works if server version includes nodeUtilities

    let data = thisNode.data;
    let pathList = thisNode.publicData.pathList;
    let publicData = thisNode.publicData;

    // check if the message is of the right complex data type
    if (data.mode !== 'c') return;

    // accepts two "units" of data: pathList (ordering) and pathPoint (coordinates). it needs both.
    if (data.unit === 'pathList') {
        if (!data.value.hasOwnProperty('list')) return;
        if (!data.value.hasOwnProperty('worldObject')) return;
        if (!data.value.hasOwnProperty('mode')) return;
        thisNode.publicData.pathList = utilities.deepCopy(data.value);
        pathList = thisNode.publicData.pathList; // re-establish pointer after deep-copy or it doesn't work

        // connect to other links
        if (pathList.list instanceof Array) {
            for (let i = 0; i < pathList.list.length; i++) {
                if (!pathList.list[i].hasOwnProperty('object')) continue;
                if (!pathList.list[i].hasOwnProperty('tool')) continue;

                utilities.searchNodeByType('pathPoint', pathList.list[i].object, pathList.list[i].tool, null, function (originObject, originTool, originNode) {
                    utilities.createLink(originObject, originTool, originNode, object, tool, node);
                });
            }
        }

    } else if (data.unit === 'pathPoint') {
        if (!data.value.hasOwnProperty('address')) return;
        if (!data.value.address.hasOwnProperty('object')) return;
        if (!data.value.address.hasOwnProperty('tool')) return;
        if (data.value.address.object + data.value.address.tool === '') return;

        publicData.pathPoints[data.value.address.object + data.value.address.tool] = utilities.deepCopy(data.value);

        if (!pathList.hasOwnProperty('list')) return;
        if (!pathList.hasOwnProperty('worldObject')) return;
        if (!pathList.hasOwnProperty('mode')) return;

        let msg = {
            address: {
                object: object,
                tool: tool,
                node: node
            },
            mode: pathList.mode,
            path: [],
            worldObject: pathList.worldObject
        };

        for (let i = 0; i < pathList.list.length; i++) {
            let uuid = pathList.list[i].object + pathList.list[i].tool;
            if (publicData.pathPoints.hasOwnProperty(uuid)) {
                msg.path.push(publicData.pathPoints[uuid]);
            }
        }

        thisNode.processedData = new Data();
        thisNode.processedData.value = msg;
        thisNode.processedData.mode = 'c';
        thisNode.processedData.unit = 'path';

        // Connect to all missions within the node
        utilities.searchNodeByType('mission', object, null, null, function (foundObject, foundTool, foundNode) {
            utilities.createLink(object, tool, node, foundObject, foundTool, foundNode);
        });

        // call back system
        callback(object, tool, node, thisNode);
    }
};
