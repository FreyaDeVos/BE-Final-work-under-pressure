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

// Optioneel: een simpele check route
app.get('/', (req, res) => {
    res.send('HRV backend server is running');
});

// Start de HRV reader (bluetooth scan etc)
hrvReader.start();

io.on('connection', (socket) => {
    console.log('🔌 Frontend verbonden via Socket.IO');

    // Forward HRV data events naar deze client
    const onData = (data) => {
        socket.emit('hrvData', data);
    };

    // Voeg event listeners toe
    hrvReader.on('data', onData);

    // Event voor start HRV reader
    const onStart = () => {
        socket.emit('hrvStart');
    };
    hrvReader.on('start', onStart);

    // Event voor errors
    const onError = (err) => {
        socket.emit('hrvError', err.message);
    };
    hrvReader.on('error', onError);

    // Ontkoppel event listeners bij disconnect
    socket.on('disconnect', () => {
        console.log('❌ Frontend losgekoppeld');
        hrvReader.off('data', onData);
        hrvReader.off('start', onStart);
        hrvReader.off('error', onError);
    });
});