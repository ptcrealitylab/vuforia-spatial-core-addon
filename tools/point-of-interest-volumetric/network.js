window.network = {};

(function(exports) {
    // const DEBUG_ALWAYS_PRIMARY = true;
    const socketId = 'primary';
    let socket = null;

    function establishConnectionWithZone(zoneIp) {
        if (typeof io === 'undefined' || !io) {
            console.warn('No reality zone viewer connection');

            // eslint-disable-next-line no-global-assign
            io = function() {
                return {
                    on: function() {
                    },
                    emit: function() {
                    },
                };
            };
        }

        if (socket) { return; }

        // let socket = io('http://10.10.10.202:31337');
        socket = io(zoneIp);
        socket.on('connect', function() {
            console.log('socket.io connected to volumetric');

            // let socketId = zoneIp.includes(getPrimaryZoneIP()) ? 'primary' : 'secondary';
            // if (DEBUG_ALWAYS_PRIMARY) { socketId = 'primary'; }

            // on connect, send viewer info
            socket.emit('name', JSON.stringify({
                type: 'viewer',
                editorId: tempUuid
            }));

            socket.on('image', function(data) {
                window.renderer.processImageFromSource(socketId, data);
            });

            socket.on('error', function(data) {
                console.warn(data);
            });

            // TODO: immediately sends the most recent matrices as a test, but in future just send in render loop?
            // sendMatricesToRealityZones();
        });

        socket.on('connect_error', function(e) {
            console.warn('error connecting socket.io to volumetric', e);
        });

        socket.on('disconnect', function(e) {
            console.warn('socket.io disconnected from volumetric', e);
        });
    }

    /**
     * Sends the visible matrices to any reality zones that the desktop client has formed a web socket connection with.
     * @todo: should we just send the camera position instead? or just one matrix (one matrix -> one image)
     */
    function sendMatricesToRealityZones(cameraMatrix, projectionMatrix) {
        if (!socket) { return; }

        var messageBody = {
            cameraPoseMatrix: cameraMatrix,
            projectionMatrix: projectionMatrix,
            resolution: {
                width: parseInt(document.body.width),
                height: parseInt(document.body.height)
            },
            editorId: tempUuid
        };

        socket.emit('cameraPosition', JSON.stringify(messageBody));
    }

    exports.establishConnectionWithZone = establishConnectionWithZone;
    exports.sendMatricesToRealityZones = sendMatricesToRealityZones;
})(window.network);
