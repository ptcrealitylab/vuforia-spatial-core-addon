const WebSocket = require('ws');

/**
*  This class connects to the WebSocket
*  created by the robot in order to access
*  realtime data from it.
*/
class WebSocketInterface {

    constructor(hostIP, port){

        const ws_host = "ws://" + hostIP;
        const ws_port = port;
        this._currentRobotAngle = {x:1, y:1, z:1, w:1};
        this._currentRobotPosition = {x:1, y:1};

        console.log('KINETICAR: WebSocket trying to connect...\n');
        const ws = new WebSocket(ws_host + ':' + ws_port);

        ws.on('open', function open(event) {
            
            console.log('\x1b[95m', '\nKINETICAR: WEBSOCKET CONNECTION SUCCESSFUL AT ', '\x1b[32m', hostIP, ':', port, '\n');

            // Subscribing to robot pose
            const s = '{"op":"subscribe","topic":"/robot_pose"}';
            ws.send(s);

        });

        /** Parse robot pose **/
        ws.on('message', function incoming(data) {

            const parsedData = JSON.parse(data);

            this._currentRobotAngle = {x:parseFloat(parsedData['msg']['orientation']['x']),
                                        y:parseFloat(parsedData['msg']['orientation']['y']), 
                                        z:parseFloat(parsedData['msg']['orientation']['z']), 
                                        w:parseFloat(parsedData['msg']['orientation']['w'])};
            
            this._currentRobotPosition = {x:parseFloat(parsedData['msg']['position']['x']),
                                        y:parseFloat(parsedData['msg']['position']['y'])};
        }.bind(this));

        ws.onerror = function(event) {
            console.warn('\x1b[36m', "\nKINETICAR: Could not connect to Robot's WebSocket. Is the robot on? ☹ ");
        };
    }

    get currentRobotAngle(){
        return this._currentRobotAngle;
    }
    set currentRobotAngle(currentAngle){
        this._currentRobotAngle = currentAngle;
    }

    get currentRobotPosition(){
        return this._currentRobotPosition;

    }
    set currentRobotPosition(currentPos){
        this._currentRobotPosition = currentPos;
    }

    currentYaw(){

        let yaw = 2 * Math.asin(this._currentRobotAngle.z);

        if ((this._currentRobotAngle.w * this._currentRobotAngle.z) < 0.0){
            yaw = -Math.abs(yaw);
        }

        return yaw * (180 / Math.PI);
    }
}

exports.WebSocketInterface = WebSocketInterface;

