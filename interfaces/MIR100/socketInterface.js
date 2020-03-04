// Import events module
var events = require('events');
const clientio = require('socket.io-client');

/*
*  This class connects to the socket
*  created by the robot in order to access
*  realtime data from the robot
*/
class SocketInterface{

    constructor(hostIP, port){
        
        console.log('MIR: Socket trying to connect...');

        this.client = clientio.connect('http://' + hostIP + ':' + port);
        
        //var socket = this.client.socket;
        
        /*
        this.client.socket.on('connect_failed', function(){
            console.log('Connection Failed');
        });
        this.client.socket.on('connect', function(){
            console.log('Connected');
        });
        this.client.socket.on('disconnect', function () {
            console.log('Disconnected');
        });*/

        /*this.client.connect({
            port: port,
            host: hostIP
        }, function () {

            console.log('CONNECTED ***************');

        }.bind(this));

        this.client.on('data', function(data) {

            console.log('Data Received');

        }.bind(this));*/
        

        /*
        this.client.on('timeout', function() {

            console.log('WEBSOCKET ERROR');

        }.bind(this));*/

    }

    send(data){

        //console.log("Sending Values to other servers", data);

        this.client.emit('/update/object/position', data);
    }

}

exports.SocketInterface = SocketInterface;

