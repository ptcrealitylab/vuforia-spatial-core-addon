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

var generalProperties = {
    name: 'Mission',
    privateData: {},
    publicData: {
        mission: {
            objectOrigin: [],
            worldObject: null,
            mission: {},
            mode: ''
        },
        path: {}
    },
    type: 'mission',
    inputTypes: ['path'],
    invisible: false
};

const Data = require('../../../../models/Data');

exports.properties = generalProperties;

exports.setup = function (_object, _tool, _node, _activeBlockProperties) {
    // add code here that should be executed once.
};

exports.render = function (object, tool, node, thisNode, callback, utilities) {
    if (!utilities) return; // only works if server version includes nodeUtilities

    let data = thisNode.data;
    let path = thisNode.publicData.path;
    let mission = thisNode.publicData.mission;
    let _publicData = thisNode.publicData;
    // check if the message is of the right complex data type
    if (data.mode !== 'c') return;
    if (data.unit === 'path') {
        thisNode.publicData.path = utilities.deepCopy(data.value);
        path = thisNode.publicData.path; // re-establish pointer after deep copy

        if (!path.hasOwnProperty('address')) return;
        if (!path.hasOwnProperty('worldObject')) return;
        if (!path.hasOwnProperty('path')) return;
        if (!path.hasOwnProperty('mode')) return;

        mission.worldObject = utilities.getWorldObject(object);
        mission.objectOrigin = utilities.getWorldLocation(object);

        if (!mission.objectOrigin) return;
        if (!mission.worldObject) return;

        if (path.worldObject !== mission.worldObject) return;

        mission.mode = path.mode;
        thisNode.publicData.mission = utilities.deepCopy(path.path);
        mission.mission = thisNode.publicData.mission;

        let msg = {};
        msg[path.address.object + path.address.tool] = mission;

        thisNode.processedData = new Data();
        thisNode.processedData.value = msg;
        thisNode.processedData.mode = 'c';
        thisNode.processedData.unit = 'mission';

        // call back system
        callback(object, tool, node, thisNode);
    }
};
