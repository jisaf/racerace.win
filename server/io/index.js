'use strict';
var socketio = require('socket.io');
var io = null;

module.exports = function (server) {

    if (io) return io;

    io = socketio(server);

    io.on('connection', function (data) {
        console.log("someone connected", data.id)
        // data.send()
        data.emit('joined', {id: data.id})
        // Now have access to socket, wowzers!
        // data.on('xOrientationChange', function(data){
        //     // console.log("x", data)
        // });

        data.on('velocity', function(d){
            // console.log("v", d, data.id)
            io.emit("velocity", {velocity: d, socket: data.id})
        });

        data.on('playerJoin', function(data){
            console.log('player joinedddd')
            io.emit('playerJoin', data)
        })

        data.on('raceStart', function(data){
            io.emit('raceStart', {})
        })
    });



    return io;

};
