const express = require('express');
const {
    createServer
} = require('node:http');
const {
    join
} = require('node:path');
const socketIo = require('socket.io'); // Voeg dit toe

const app = express();
const server = createServer(app);
const io = socketIo(server); // Voeg dit toe om de socket.io server te initialiseren

app.get('/', (req, res) => {
    res.sendFile(join(__dirname, 'index.html'));
});

// Verbind de client via Socket.io
io.on('connection', (socket) => {
    console.log('a user connected');
    socket.on('chat message', (msg) => {
        console.log('message: ' + msg);
    });
});

server.listen(3000, () => {
    console.log('server running at http://localhost:3000');
});