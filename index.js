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

app.get('/', (req, res) => {
    res.send('HRV backend server is running');
});

hrvReader.start();

io.on('connection', (socket) => {
    console.log('🔌 Frontend verbonden via Socket.IO');

    const onData = (data) => {
        socket.emit('hrvData', data);
    };

    hrvReader.on('data', onData);

    const onStart = () => {
        socket.emit('hrvStart');
    };
    hrvReader.on('start', onStart);

    const onError = (err) => {
        socket.emit('hrvError', err.message);
    };
    hrvReader.on('error', onError);

    socket.on('disconnect', () => {
        console.log('❌ Frontend losgekoppeld');
        hrvReader.off('data', onData);
        hrvReader.off('start', onStart);
        hrvReader.off('error', onError);
    });
});