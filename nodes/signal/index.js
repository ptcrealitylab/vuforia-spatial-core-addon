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
 
 /**
  * Signal objects should have the following properties
  * evalAtTime(t): Returns value between 0 and 1 with a period of 1cycle / 1t
  */
 var sinWave = {
     evalAtTime: (t) => {
        return (Math.sin(t * 2 * Math.PI) + 1) / 2;
     }
 };
 var squareWave = {
     evalAtTime: (t) => {
        return Math.sin(t * 2 * Math.PI) >= 0 ? 1 : 0;
     }
 };
 var triangleWave = {
    evalAtTime: (t) => {
        return Math.abs((t % 1) * 2 - 1);
    }
 }
 var sawtoothWave = {
    evalAtTime: (t) => {
        return t % 1;
    }
 }
 var constantWave = {
    evalAtTime: (t) => {
        return 1;
    }
 }

var generalProperties = {
    name: 'node',
    privateData: {
        currentT:0,
        lastTime:Date.now(),
        scale:0
    },
    publicData: {
        wave:'constant',
        speed:1
    },
    type: 'node'
};

var intervals = {};

var evalAtTime = (t, wave) => {
    if (wave === 'sin') {
        return sinWave.evalAtTime(t);
    }
    if (wave === 'square') {
        return squareWave.evalAtTime(t);
    }
    if (wave === 'triangle') {
        return triangleWave.evalAtTime(t);
    }
    if (wave === 'sawtooth') {
        return sawtoothWave.evalAtTime(t);
    }
    if (wave === 'constant') {
        return constantWave.evalAtTime(t);
    }
    return 0;
};

exports.properties = generalProperties;

exports.setup = function (object, frame, node, thisNode) {

};

exports.onRemove = function (object, frame, node, thisNode) {
    if (intervals[`${object}${frame}${node}`]) {
        clearInterval(intervals[`${object}${frame}${node}`]);
        delete intervals[`${object}${frame}${node}`];
    }
};

// written value should be a power value (alternatively, scale)
exports.render = function (object, frame, node, thisNode, callback) {
    thisNode.privateData.scale = thisNode.data.value;
    if (!intervals[`${object}${frame}${node}`]) {
        intervals[`${object}${frame}${node}`] = setInterval(() => {
            var elapsedTime = (Date.now() - thisNode.privateData.lastTime) * thisNode.publicData.speed;
            thisNode.privateData.lastTime = Date.now();
            thisNode.privateData.currentT += elapsedTime / 1000;
            thisNode.processedData.value = thisNode.privateData.scale * evalAtTime(thisNode.privateData.currentT, thisNode.publicData.wave);
            console.log('callback', object, frame, node, thisNode.uuid);
            callback(object, frame, node, thisNode);
        }, 1000/30);
    }
};
