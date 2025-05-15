const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const HRVReader = require('./hrvReader');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: '*'
    }
});

const hrvReader = new HRVReader();

server.listen(3001, () => {
    console.log('🌐 Server actief op http://localhost:3001');
});

hrvReader.start();

io.on('connection', (socket) => {
    console.log('🔌 Frontend verbonden via Socket.IO');

    // Data doorsturen naar frontend
    const onData = (data) => {
        socket.emit('hrvData', data);
    };

    hrvReader.on('data', onData);

    socket.on('disconnect', () => {
        console.log('❌ Frontend losgekoppeld');
        hrvReader.off('data', onData);
    });

    // Event voor start HRV reader
    hrvReader.on('start', () => {
        socket.emit('hrvStart');
    });

    // Event voor errors
    hrvReader.on('error', (err) => {
        socket.emit('hrvError', err.message);
    });
});