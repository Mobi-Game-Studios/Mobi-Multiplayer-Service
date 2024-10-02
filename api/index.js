require('dotenv').config();
const express = require('express');
const faunadb = require('faunadb');

const app = express();
const q = faunadb.query;
const client = new faunadb.Client({ secret: process.env.FAUNA_SERVER_KEY });

let currentUserId = null;
let currentServerKey = null;
let isConnected = false;

const checkLoginStatus = () => {
    if (!currentUserId) {
        throw { status: 403, message: 'ERROR: Not logged in.', code: 'ERR_NOT_LOGGED_IN' };
    }
    if (!currentServerKey) {
        throw { status: 403, message: 'ERROR: Not connected to a server.', code: 'ERR_NOT_CONNECTED' };
    }
    if (!isConnected) {
        throw { status: 403, message: 'ERROR: Not connected to a server.', code: 'ERR_NOT_CONNECTED' };
    }
};

app.get('/api/ping', (req, res) => {
    checkLoginStatus();
    res.json({ message: 'pong', status: 200 });
});

app.post('/api/login-custom-id', (req, res) => {
    const { userId } = req.body;
    if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
    }
    currentUserId = userId;
    res.json({ message: 'Logged in successfully', status: 200 });
});

app.post('/api/create-server-key', async (req, res) => {
    try {
        const serverKey = [...Array(3)].map(() => 
            Math.random().toString(36).slice(2, 34).replace(/(.{32})/, '$1-')
        ).join('').slice(0, -1);
        
        await client.query(q.Create(q.Collection('servers'), { data: { key: serverKey } }));
        currentServerKey = serverKey;
        res.json({ message: 'Server key created', serverKey, status: 200 });
    } catch (error) {
        console.error('Error creating server key:', error);
        res.status(500).json({ error: 'Error creating server key', details: error });
    }
});

app.post('/api/connect-server-key', async (req, res) => {
    const { serverKey } = req.body;
    try {
        const server = await client.query(q.Get(q.Match(q.Index('server_by_key'), serverKey)));
        currentServerKey = serverKey;
        res.json({ message: 'Connected to server', server, status: 200 });
    } catch (error) {
        console.error('Error connecting to server:', error);
        res.status(500).json({ error: 'Error connecting to server', details: error });
    }
});

app.post('/api/create-room', async (req, res) => {
    checkLoginStatus();
    const { code } = req.body;
    try {
        const roomCode = code || Math.random().toString(36).slice(2, 6).toUpperCase();
        await client.query(q.Create(q.Collection('rooms'), { data: { code: roomCode, serverKey: currentServerKey } }));
        res.json({ message: 'Room created', roomCode, status: 200 });
    } catch (error) {
        console.error('Error creating room:', error);
        res.status(500).json({ error: 'Error creating room', details: error });
    }
});

app.get('/api/get-server-info', (req, res) => {
    checkLoginStatus();
    res.json({ serverKey: currentServerKey, status: 200 });
});

app.get('/api/get-room-info', async (req, res) => {
    checkLoginStatus();
    try {
        const roomInfo = await client.query(q.Paginate(q.Documents(q.Collection('rooms'))));
        res.json({ roomInfo, status: 200 });
    } catch (error) {
        console.error('Error fetching room info:', error);
        res.status(500).json({ error: 'Error fetching room info', details: error });
    }
});

app.post('/api/disconnect', (req, res) => {
    isConnected = false;
    res.json({ message: 'Disconnected', status: 200 });
});

app.post('/api/connect', (req, res) => {
    isConnected = true;
    res.json({ message: 'Connected', status: 200 });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
