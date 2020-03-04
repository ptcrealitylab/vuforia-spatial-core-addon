// Import events module
var events = require('events');
const clientio = require('socket.io-client');

/**
*  This class connects to the socket
*  created by the robot in order to access
*  realtime data from the robot
*/
class SocketInterface{

    constructor(hostIP, port){
        
        console.log('KINETICAR: Socket trying to connect...\n');

        this.client = clientio.connect('http://' + hostIP + ':' + port);

    }

    send(data){

        //console.log("Sending Values to other servers", data);

        this.client.emit('/update/object/position', data);
    }

}

exports.SocketInterface = SocketInterface;

