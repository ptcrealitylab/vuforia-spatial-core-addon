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
 * Created by Anna Fuste on 01/15/20.
 *
 * Copyright (c) 2020 PTC Reality Lab
 *
 * All ascii characters above must be included in any redistribution.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

var server = require('@libraries/hardwareInterfaces');
var settings = server.loadHardwareInterface(__dirname);

// Our custom imports here:
const { RestAPIInterface } = require('./restapiInterface');
const { CustomMaths } = require('./customMaths');
const { WebSocketInterface } = require('./websocketInterface');
const { SocketInterface } = require('./socketInterface');

exports.enabled = false;    // If disabled, this hardware interface won't run

if (exports.enabled) {

    let enableRobotConnection = false;                // Set to false for debugging without robot
    console.log('\x1b[36m%s\x1b[0m','\nKINETICAR: Robot Connection: ', enableRobotConnection, '\n');

    server.enableDeveloperUI(true);        // Developer UI

    server.removeAllNodes('robot', 'kineticAR');   // Clear nodes from the Frame when server turns on

    // ROBOT IP and PORT
    const hostIP = 'XX.XX.XX.XXX';  // Replace with robot IP
    const port = 1234;              // Replace with communication Port

    let maths = new CustomMaths();

    let websocket;
    
    /** SAMPLE REST API CONNECTION**/
    let restapi;
    const endpoints = {
        endpoint1: "/endpoint1",
        endpoint2: "/endpoint2",
        endpoint3: "/endpoint3",
        endpoint4: "/endpoint4"
    };
    const restAddress = "http://" + hostIP + "/api_address_here";
    function restRequest(endpoint){
        return restapi.getData(restAddress + endpoint);
    }

    // This websocket is used to store the position of the object in realtime so that anyone can access it
    /*const objectUpdateIP = "127.0.0.1";
    const objectUpdatePort = 8080;
    let websocketObjectUpdate = new SocketInterface(objectUpdateIP, objectUpdatePort);*/

    const groundPlaneScaleFactor = 1000;        // We need to be very aware of units. Ground plane is in mm, but the robot probably operates in meters
    
    let robotStatus = {};                       // ROBOT PHYSICAL STATUS
    let arStatus = {};                          // OBJECT AR STATUS
    let inMotion = false;                       // Is robot moving
    let robotInterrupted = false;
    let robotCurrentState = 3;                  // MIR starts with state 3: READY! ??

    let pathData = [];                          // List of paths with checkpoints in server
    let activeCheckpointName = null;            // Current active checkpoint

    let currentRobotPosition = {x: 0, y: 0};    // Current position of the robot in its own map (in case of AGV)
    let currentRobotOrientation = 0;            // Current orientation of the robot in its own map (in case of AGV)
    let initRobotPosition = {x: 0, y: 0};       // Physical position when the Object is tracked and the Frame talks to the server for the first time
    let initRobotOrientation = 0;               // Physical orientation angle when the Object is tracked and the Frame talks to the server for the first time
    let initOrientationAR = 0;                  // AR Orientation angle when the Object is tracked and the Frame talks to the server for the first time 
    let initialFrameSync = false;               // This sets to true the first time we receive from the Frame

    let lastPositionAR = {x: 0, y: 0};          // Variable to keep the last position of the robot in AR
    let lastDirectionAR = {x: 0, y: 0};         // Variable to keep the last direction of the robot in AR

    /** Different Nodes that can be created to transfer data from Frame to Server **/
    server.addNode("robot", "kineticAR", "kineticNode1", "storeData");     // Node for occlusion data
    server.addNode("robot", "kineticAR", "kineticNode2", "storeData");     // Node for the data path. Follow Checkpoints
    server.addNode("robot", "kineticAR", "kineticNode3", "storeData");     // Node for receiving AR status
    server.addNode("robot", "kineticAR", "kineticNode4", "storeData");     // Node for cleaning the path

    /** Listener to obtain the position and orientation of the robot when the frame is first tracked using the AR Application **/
    server.addPublicDataListener("robot", "kineticAR", "kineticNode3","ARstatus",function (data){

        console.log('KINETICAR: Frame has been loaded and is sending its own AR position', data);
        
        arStatus = data;    // Keep AR Status in global variable
        
        // At this point, you should store the AR position and rotation of the object target received by the Frame
        // And also store the physical position and rotation of the robot at this precise moment in order to synchronize them
        // In the case of the AGV, we work with x and y coordinates (from its own map) and an orientation angle

        lastPositionAR.x = data.robotInitPosition['x']/groundPlaneScaleFactor;  // Apply required conversion from ground plane units to robot units
        lastPositionAR.y = data.robotInitPosition['z']/groundPlaneScaleFactor;  // Apply required conversion from ground plane units to robot units
        lastDirectionAR.x = data.robotInitDirection['x'];                       // The orientation is sent from the Frame with a 2D Vector
        lastDirectionAR.y = data.robotInitDirection['z'];
        initOrientationAR =  (-1) * maths.signed_angle([1,0], [data.robotInitPosition['x'], data.robotInitPosition['z']]) * 180 / Math.PI;  // Compute orientation angle
        
        initRobotPosition.x = currentRobotPosition.x;                           // Get physical x position at this moment in time
        initRobotPosition.y = currentRobotPosition.y;                           // Get physical y position at this moment in time
        initRobotOrientation = currentRobotOrientation;                         // Get physical orientation at this moment in time [angle]
        
        initialFrameSync = true;
        
    });

    /** Listener for when Frame wants to clear the path array **/
    server.addPublicDataListener("robot", "kineticAR", "kineticNode4","ClearPath",function (data) {

        console.log('KINETICAR: Frame has requested to clear path: ', data);

        pathData.forEach(path => {
            path.checkpoints.forEach(checkpoint => {
                server.removeNode("robot", "kineticAR", checkpoint.name);
            });
            path.checkpoints = [];
        });

        server.pushUpdatesToDevices("robot");

        inMotion = false;
        activeCheckpointName = null;

    });

    /** Listener for when Frame wants to synchronize the path data **/
    server.addPublicDataListener("robot", "kineticAR", "kineticNode2","pathData",function (data){

        
        console.log('PATH DATA');
        
        // We go through array of paths sent by the Frame
        data.forEach(framePath => {

            let pathExists = false;
            
            pathData.forEach(serverPath => {

                if (serverPath.index === framePath.index){   // If this path exists on the server, proceed to compare checkpoints
                    pathExists = true;

                    // Foreach checkpoint received from the frame
                    framePath.checkpoints.forEach(frameCheckpoint => {

                        let exists = false;

                        // Check against each checkpoint stored on the server
                        serverPath.checkpoints.forEach(serverCheckpoint => {

                            if (serverCheckpoint.name === frameCheckpoint.name){    // Same checkpoint. Check if position has changed and update
                                
                                exists = true;

                                if (serverCheckpoint.posX !== frameCheckpoint.posX) serverCheckpoint.posX = frameCheckpoint.posX;
                                if (serverCheckpoint.posY !== frameCheckpoint.posY) serverCheckpoint.posY = frameCheckpoint.posY;
                                if (serverCheckpoint.posZ !== frameCheckpoint.posZ) serverCheckpoint.posZ = frameCheckpoint.posZ;
                                if (serverCheckpoint.orientation !== frameCheckpoint.orientation) serverCheckpoint.orientation = frameCheckpoint.orientation;

                                /** Move the programming node to the same position as the checkpoint **/
                                server.moveNode("robot", "kineticAR", frameCheckpoint.name, frameCheckpoint.posX, frameCheckpoint.posZ, 0.3,[
                                    1, 0, 0, 0,
                                    0, 1, 0, 0,
                                    0, 0, 1, 0,
                                    0, 0, frameCheckpoint.posY * 2, 1
                                ], true);
                            }
                        });
                        
                        if (!exists){   // If the checkpoint is not in the server, add it and add the node listener.
                            serverPath.checkpoints.push(frameCheckpoint);

                            //console.log('KINETICAR: New ' + frameCheckpoint.name + ' at position: ', frameCheckpoint.posX, frameCheckpoint.posZ);
                            
                            server.addNode("robot", "kineticAR", frameCheckpoint.name, "node");

                            
                            console.log('NEW NODE AT: ', frameCheckpoint );
                            
                            
                            /** Move the programming node to the same position as the checkpoint **/
                            
                            server.moveNode("robot", "kineticAR", frameCheckpoint.name, frameCheckpoint.posX, frameCheckpoint.posZ, 0.3,[
                                1, 0, 0, 0,
                                0, 1, 0, 0,
                                0, 0, 1, 0,
                                0, 0, frameCheckpoint.posY * 2, 1
                            ], true);
                            
                            /** Subscribe to any change in the node value for each checkpoint **/
                            server.addReadListener("robot", "kineticAR", frameCheckpoint.name, function(data){    // Add listener to node

                                // Checkpoint.name example for the second checkpoint of path 0 -> checkpoint_0:1
                                
                                let indexValues = frameCheckpoint.name.split("_")[1];
                                let pathIdx = parseInt(indexValues.split(":")[0]);          // Extract path index from name
                                let checkpointIdx = parseInt(indexValues.split(":")[1]);    // Extract checkpoint index from name

                                nodeReadCallback(data, checkpointIdx, pathIdx);

                            });
                        }
                    });
                }
            });

            if (!pathExists){   // If the path doesn't exist on the server, add it to the server path data

                pathData.push(framePath);

            }
        });

        console.log('\nKINETICAR: Current path data in server: ', JSON.stringify(pathData), '\n');

        server.pushUpdatesToDevices("robot");

    });

    /** Callback for node value change **/
    function nodeReadCallback(data, checkpointIdx, pathIdx){
        
        // This method will get triggered when there is a value change in any of the checkpoint nodes.

        console.log('KINETICAR: NODE ', checkpointIdx, ' path: ', pathIdx, ' received ', data);

        let checkpointTriggered = pathData[pathIdx].checkpoints[checkpointIdx];     // Take the checkpoint that contains this node

        if (data.value === 1){          // If the value of the checkpoint node changed to 1, we need to send the robot to that checkpoint.

            if (!checkpointTriggered.active){   // Checkpoint has changed from not active to active. We have to send robot here
                
                activeCheckpointName = checkpointTriggered.name;
                checkpointTriggered.active = 1; // This checkpoint gets activated

                /** Compute, in robot coordinates, where this checkpoint is **/
                let missionData = computeRobotCoordinatesTo(checkpointTriggered.posX, checkpointTriggered.posZ, checkpointTriggered.orientation);

                /** Send the command to the robot to move to this checkpoint **/
                if (enableRobotConnection) {
                    let newAddress = restAddress + '/mission_queue';
                    restapi.postData(newAddress, missionData)
                        .then(res => console.log(res)) // JSON-string from `response.json()` call
                        .catch(error => console.error(error));
                }

                inMotion = true;
            } else {
                // This checkpoint was already active
            }
        } else if (data.value === 0){   // If the value of the checkpoint node changed to 0, the robot just reached the checkpoint.

            if (checkpointTriggered.active){

                console.log('KINETICAR: Checkpoint has changed from active to not active: ', checkpointTriggered.name);

                if (inMotion){

                    // The node has been deactivated in the middle of a motion
                    // We need to stop the robot and reset anything needed

                    // In this example, we send a rest request to clear the mission queue in the AGV
                    
                    let newAddress = restAddress + '[endpoint here]';

                    restapi.deleteData(newAddress)
                        .then(res => console.log(res))
                        .catch(error => console.error(error));

                    robotInterrupted = true;
                    checkpointTriggered.active = 0;

                } else {    // Checkpoint has changed from active to not active, robot just got here. We have to trigger next checkpoint
                    
                    checkpointTriggered.active = 0;     // This checkpoint gets deactivated

                    let nextCheckpointToTrigger = null;

                    if (checkpointIdx + 1 < pathData[pathIdx].checkpoints.length){                      // Next checkpoint in same path
                        nextCheckpointToTrigger = pathData[pathIdx].checkpoints[checkpointIdx + 1];

                        console.log('KINETICAR: Next checkpoint triggered: ', nextCheckpointToTrigger.name);
                        server.write("robot", "kineticAR", nextCheckpointToTrigger.name, 1);

                    } else {                                                                            // We reached end of path
                        activeCheckpointName = null;
                    }
                }
            }
        }
    }

    /** Computer Robot coordinates to new checkpoint **/
    function computeRobotCoordinatesTo(newCheckpointX, newCheckpointY, checkpointOrientation){

        let lastDirectionTo = [lastDirectionAR.x, lastDirectionAR.y];

        let from = [lastPositionAR.x, lastPositionAR.y];
        let to = [newCheckpointX / groundPlaneScaleFactor, newCheckpointY / groundPlaneScaleFactor];    // Make sure that all units are on the same scale

        const newDistance = maths.distance(from, to);                                   // Distance that the robot has to travel to get to the next point

        let newDirectionVector = [to[0] - from[0], to[1] - from[1]];                    // newDirection = to - from

        let angleBetween = maths.signed_angle(newDirectionVector, lastDirectionTo);     // Angle between direction vectors

        const newDirectionDeg = maths.radians_to_degrees(angleBetween);                 // Angle that the robot has to turn to go to next coordinate in deg

        currentRobotOrientation = currentRobotOrientation + newDirectionDeg;            // Angle in the robot Coordinate system

        currentRobotPosition.x += newDistance * Math.cos(maths.degrees_to_radians(currentRobotOrientation));    // Compute position based on orientation and distance
        currentRobotPosition.y += newDistance * Math.sin(maths.degrees_to_radians(currentRobotOrientation));    // Compute position based on orientation and distance

        let angleDifferenceAR = initOrientationAR + checkpointOrientation;
        let newOrientation = initRobotOrientation - angleDifferenceAR;

        // Normalize to range range (-180, 180]
        if (newOrientation > 180)        { newOrientation -= 360; }
        else if (newOrientation <= -180) { newOrientation += 360; }

        /** This struct will vary depending on what your robot needs to receive **/
        let dataObj = {
            "mission_id": 'move mission id here',
            "parameters":[{"input_name":"positionX","value": currentRobotPosition.x},
                {"input_name":"positionY","value": currentRobotPosition.y},
                {"input_name":"orientation","value": newOrientation}]
        };

        currentRobotOrientation = newOrientation;
        lastDirectionAR.x = Math.cos(maths.degrees_to_radians(checkpointOrientation));
        lastDirectionAR.y = Math.sin(maths.degrees_to_radians(checkpointOrientation));
        lastPositionAR.x = to[0];
        lastPositionAR.y = to[1];

        return dataObj;
    }

    /** Process the data coming from the robot.
     * This will depend on your hardware and what type of protocol your robot uses.
     * This is based in the MIR hardware interface. 
     * Here we are processing the results coming from the REST request for status
     * **/
    function processStatus(data) {

        if (data !== undefined){
            robotStatus = data;                                                                                         // Store position and rotation here

            if (robotStatus !== undefined){

                const state_id = data['robot state'];                                                                   // Extract the current state of the robot (ready, moving, emergency stop, etc)

                currentRobotPosition.x = robotStatus['x'];                                                              
                currentRobotPosition.y = robotStatus['y'];
                currentRobotOrientation = robotStatus['orientation'];

                switch(state_id){
                    case 0:                                                                                             // Ready State
                        if (robotCurrentState !== 0){
                            if (!robotInterrupted) {                                                                    // Robot has finished mission. Send a 0 to current checkpoint
                                if (activeCheckpointName !== null){
                                    server.write("robot", "kineticAR", activeCheckpointName, 0);
                                } else {
                                    console.log("KINETIC AR: No checkpoint active. Active checkpoint is NULL");
                                }
                            }

                            inMotion = false;               // reset motion
                            robotCurrentState = 0;          // reset state
                            robotInterrupted = false;       // reset variable
                        }
                        break;
                    case 1:                                 // Pause State
                        break;
                    case 2:
                        if (robotCurrentState !== 2){       // Executing State / Robot starts moving
                            robotCurrentState = 2;
                            inMotion = true;        
                        }
                        break;
                    case 3:                                 // Emergency State
                        break;
                    case 4:                                 // Manual Control State
                        break;
                    default:
                        break;
                }
            }
        }
    }

    /**
     ** Send the realtime position of the robot translated to AR
     ** to the Frame
     **/
    function sendRealtimePosition(){

        let _currentOrientationRobot = websocket.currentYaw();                                                          // Orientation of the robot at this frame in degrees (from WebSocket)
        let _currentPositionRobot = websocket.currentRobotPosition;                                                     // Position of the robot at this frame

        let newARPosition = positionFromMIRToAR(_currentPositionRobot, _currentOrientationRobot);

        server.writePublicData("robot", "kineticAR", "kineticNode1", "ARposition", newARPosition);                      // Send newARPosition to frame

    }

    function positionFromMIRToAR(newPosition, newDirectionAngle)
    {
        let newARPosition = {x:0, y:0, z:0};

        if (newDirectionAngle < 0) newDirectionAngle += 360;                                                            // newDirectionAngle between 0 - 360

        let initialAngleRobot = initRobotOrientation;
        if (initialAngleRobot < 0) initialAngleRobot += 360;                                                            // initialAngleMIR between 0 - 360
        let initialRobotDirectionVector = [Math.cos(maths.degrees_to_radians(initialAngleRobot)),                       // MIR space
            Math.sin(maths.degrees_to_radians(initialAngleRobot))];

        let from = [initRobotPosition.x, initRobotPosition.y];
        let to = [newPosition.x, newPosition.y];

        let newDistance = maths.distance(from, to);                                                                     // Distance between points

        let newDir = [to[0] - from[0], to[1] - from[1]];                                                                // newDirection = to - from
        let newDirectionRad = maths.signed_angle(initialRobotDirectionVector, newDir);                                  // Angle between initial direction and new direction

        let angleDifference = newDirectionAngle - initialAngleRobot;                                                    // Angle difference between current and initial MIR orientation

        let _initialOrientation_AR = maths.signed_angle([arStatus.robotInitDirection['x'],                      // Initial AR direction
                arStatus.robotInitDirection['z']],
            [1,0]);

        if (_initialOrientation_AR < 0) _initialOrientation_AR += 2 * Math.PI;                                          // _initialOrientation_AR between 0 - 360

        let newARAngle = maths.radians_to_degrees(_initialOrientation_AR) + angleDifference;
        let newAngleDeg = maths.radians_to_degrees(_initialOrientation_AR) + maths.radians_to_degrees(newDirectionRad);

        newARPosition.x = (arStatus.robotInitPosition['x']/groundPlaneScaleFactor) + (newDistance * Math.cos(maths.degrees_to_radians(newAngleDeg)));
        newARPosition.y = - ((- arStatus.robotInitPosition['z']/groundPlaneScaleFactor) + (newDistance * Math.sin(maths.degrees_to_radians(newAngleDeg))));
        newARPosition.z = maths.degrees_to_radians(newARAngle);

        /*
        // Send position and rotation to server. 
        var messageBody = {
            objectKey: "MIRA5el60nk4klg",
            position: {
                x: newARPosition.x * groundPlaneScaleFactor,
                y: - newARPosition.y * groundPlaneScaleFactor,
                z: 0
            },
            rotationInRadians: maths.degrees_to_radians(newARAngle), // right now this API only supports rotation about the vertical axis. use the other API to pass a full rotation matrix.
            editorId: 'testID' // the actual value doesn't matter but it needs to have one
        };
        websocketObjectUpdate.send(JSON.stringify(messageBody));
        */

        return newARPosition;
    }

    /**
    ** Recursively ask for status.
    ** Wait until the request has been answered in order to request again
    **/
    function requestStatus(){
        restRequest('[insert status endpoint]').then(function (data){
            processStatus(data);
            requestStatus();
        }).catch(error => console.error(error));
    }

    /** Initial requests **/
    if (enableRobotConnection){
        websocket = new WebSocketInterface(hostIP, port);   // Realtime connection to the robot
        restapi = new RestAPIInterface(hostIP);             // REST API connection to the robot

        requestStatus();
    }
    
    /** UPDATE FUNCTION **/
    function updateEvery(i, time) {
        setTimeout(() => {
            
            if (enableRobotConnection && initialFrameSync) sendRealtimePosition();
            
            updateEvery(++i, time);
            
        }, time)
    }

    updateEvery(0, 100);
    
    server.addEventListener("reset", function () {
    });

    server.addEventListener("shutdown", function () {
    });
}
