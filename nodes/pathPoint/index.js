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

var generalProperties = {
    name: 'Point',
    privateData: {},
    publicData: {},
    type: 'pathPoint',
    inputTypes: ['pathPoint'],
    invisible: false
};

exports.properties = generalProperties;

exports.setup = function (_object, _tool, _node, _activeBlockProperties) {
    // add code here that should be executed once.
};

exports.render = function (object, tool, node, thisNode, callback, utilities) {
    if (!utilities) return; // only works if server version includes nodeUtilities

    let data = thisNode.data;

    // check if the message is of the right complex data type
    if (data.mode !== 'c') return;
    if (data.unit !== 'pathPoint') return;
    // check if the complex data message is complete
    if (!data.value.hasOwnProperty('address')) return;
    if (!data.value.address.hasOwnProperty('object')) return;
    if (!data.value.address.hasOwnProperty('tool')) return;
    if (!data.value.address.hasOwnProperty('node')) return;
    if (!data.value.hasOwnProperty('points')) return;
    if (data.value.points.length <= 0) return;
    for (let i = 0; i < data.value.points.length; i++) {
        if (!data.value.points[i].hasOwnProperty('matrix')) return;
        if (!data.value.points[i].hasOwnProperty('speed')) return;
    }
    if (!data.value.hasOwnProperty('worldObject')) return;

    // copy the message for processing
    thisNode.processedData = utilities.deepCopy(data);

    // call back system
    callback(object, tool, node, thisNode);
};
