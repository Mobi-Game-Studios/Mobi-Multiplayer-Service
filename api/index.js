const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({
    user: process.env.POSTGRES_USER,
    host: process.env.POSTGRES_HOST,
    database: process.env.POSTGRES_DATABASE,
    password: process.env.POSTGRES_PASSWORD,
    port: process.env.DB_PORT || 5432,
});

let currentUserId = null;
let currentServerKey = null;
let globalPlayerCount = 0;
let isConnected = false;

const generateRandomString = (length) => {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
};

const generateServerKey = () => {
    return `${generateRandomString(32)}-${generateRandomString(32)}-${generateRandomString(32)}`;
};

const validateServerKey = async (serverKey) => {
    const result = await pool.query('SELECT * FROM servers WHERE server_key = $1', [serverKey]);
    return result.rows.length > 0;
};

const checkLoginStatus = () => {
    if (!currentUserId) {
        throw { status: 403, message: 'ERROR: Not logged in.', code: 'ERR_NOT_LOGGED_IN' };
    }
    if (!currentServerKey || !isConnected) {
        throw { status: 403, message: 'ERROR: Not connected to a server.', code: 'ERR_NOT_CONNECTED' };
    }
};

const checkRoomOwnership = async (roomCode) => {
    const roomResult = await pool.query('SELECT * FROM rooms WHERE room_code = $1 AND server_key = $2', [roomCode, currentServerKey]);
    return roomResult.rows.length > 0;
};

app.get('/api/ping', (req, res) => {
    checkLoginStatus();
    res.json({ message: 'pong', status: 200 });
});

app.post('/api/login-custom-id', (req, res) => {
    const { customId } = req.body;
    currentUserId = customId;
    globalPlayerCount++;
    res.json({ message: `Logged in as ${customId}`, status: 200 });
});

app.post('/api/create-server-key', async (req, res) => {
    const serverKey = generateServerKey();
    try {
        await pool.query('INSERT INTO servers (server_key) VALUES ($1)', [serverKey]);
        currentServerKey = serverKey;
        res.json({ message: `Server key created: ${serverKey}`, status: 200 });
    } catch (error) {
        console.error('Error creating server key:', error);
        res.status(500).json({ error: 'Internal server error', cause: error, code: 'ERR_INTERNAL_SERVER', status: 500 });
    }
});

app.any('/api/test-db-connection', async (req, res) => {
    try {
        const client = await pool.connect();
        const result = await client.query('SELECT NOW()');
        client.release();
        res.json({ status: 'success', time: result.rows[0].now });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database connection failed', details: err });
    }
});



app.post('/api/connect-server-key', async (req, res) => {
    const { serverKey } = req.body;
    if (!serverKey) {
        return res.status(400).json({ error: 'Server key is required', code: 'ERR_MISSING_SERVER_KEY', status: 400 });
    }
    const isValidKey = await validateServerKey(serverKey);
    if (!isValidKey) {
        return res.status(403).json({ error: 'Invalid server key', code: 'ERR_INVALID_SERVER_KEY', status: 403 });
    }
    currentServerKey = serverKey;
    isConnected = true;
    res.json({ message: `Connected to server key: ${serverKey}`, status: 200 });
});

app.post('/api/create-room', async (req, res) => {
    checkLoginStatus();
    const isValidKey = await validateServerKey(currentServerKey);
    if (!isValidKey) {
        return res.status(403).json({ error: 'Invalid server key', code: 'ERR_INVALID_SERVER_KEY', status: 403 });
    }
    const { code } = req.body;
    const roomCode = code || Math.floor(1000 + Math.random() * 9000).toString();
    await pool.query('INSERT INTO rooms (room_code, server_key) VALUES ($1, $2)', [roomCode, currentServerKey]);
    res.json({ message: `Room created: ${roomCode}`, status: 200 });
});

app.post('/api/join-room', async (req, res) => {
    checkLoginStatus();
    const { roomCode } = req.body;
    const roomResult = await pool.query('SELECT * FROM rooms WHERE room_code = $1', [roomCode]);
    if (roomResult.rows.length === 0) {
        return res.status(404).json({ error: 'Room does not exist.', code: 'ERR_ROOM_NOT_FOUND', status: 404 });
    }
    const room = roomResult.rows[0];
    if (room.server_key !== currentServerKey) {
        return res.status(500).json({ error: 'Error joining room', code: 'ERR_INCORRECT_SKEY', status: 500 });
    }
    res.json({ message: `Joined room: ${roomCode}`, status: 200 });
});

app.post('/api/leave-room', async (req, res) => {
    checkLoginStatus();
    const { roomCode } = req.body;
    const ownsRoom = await checkRoomOwnership(roomCode);
    if (!ownsRoom) {
        return res.status(403).json({ error: 'ERROR: Cannot leave a room that you are not in.', code: 'ERR_NOT_IN_ROOM', status: 403 });
    }
    await pool.query('DELETE FROM rooms WHERE room_code = $1 AND server_key = $2', [roomCode, currentServerKey]);
    res.json({ message: `Left room: ${roomCode}`, status: 200 });
});

app.get('/api/get-server-info', (req, res) => {
    checkLoginStatus();
    res.json({ serverKey: currentServerKey, status: 200 });
});

app.get('/api/get-room-info', async (req, res) => {
    checkLoginStatus();
    const roomResult = await pool.query('SELECT room_code FROM rooms WHERE server_key = $1', [currentServerKey]);
    res.json({ rooms: roomResult.rows.map(row => row.room_code), status: 200 });
});

app.post('/api/disconnect', (req, res) => {
    if (!isConnected) {
        return res.status(400).json({ error: 'Not currently connected.', code: 'ERR_NOT_CONNECTED', status: 400 });
    }
    isConnected = false;
    res.json({ message: 'Disconnected from server.', status: 200 });
});

app.post('/api/connect', (req, res) => {
    if (isConnected) {
        return res.status(400).json({ error: 'Already connected.', code: 'ERR_ALREADY_CONNECTED', status: 400 });
    }
    isConnected = true;
    res.json({ message: 'Connected to server.', status: 200 });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
