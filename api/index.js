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

app.get('/api/ping', (req, res) => {
    res.json({ message: 'pong', status: 200 });
});

app.post('/api/login-custom-id', (req, res) => {
    const { customId } = req.body;
    currentUserId = customId;
    res.json({ message: `Logged in as ${customId}`, status: 200 });
});

app.post('/api/create-server-key', async (req, res) => {
    const serverKey = generateServerKey();
    await pool.query('INSERT INTO servers (server_key) VALUES ($1)', [serverKey]);
    currentServerKey = serverKey;
    res.json({ message: `Server key created: ${serverKey}`, status: 200 });
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
    res.json({ message: `Connected to server key: ${serverKey}`, status: 200 });
});

app.post('/api/create-room', async (req, res) => {
    if (!currentServerKey) {
        return res.status(403).json({ error: 'ERROR: Not connected to a server.', code: 'ERR_NOT_CONNECTED', status: 403 });
    }
    const isValidKey = await validateServerKey(currentServerKey);
    if (!isValidKey) {
        return res.status(403).json({ error: 'Invalid server key', code: 'ERR_INVALID_SERVER_KEY', status: 403 });
    }
    const { code } = req.body;
    const roomCode = code || Math.floor(1000 + Math.random() * 9000).toString();
    try {
        const result = await pool.query('INSERT INTO rooms (code, server_id) VALUES ($1, $2) RETURNING *', [roomCode, currentServerKey]);
        res.status(201).json({ message: result.rows[0], status: 201 });
    } catch (err) {
        res.status(500).json({ error: 'Error creating room', code: 'ERR_CREATE_ROOM', status: 500 });
    }
});

app.post('/api/join-room', async (req, res) => {
    if (!currentUserId) {
        return res.status(403).json({ error: 'ERROR: Not logged in.', code: 'ERR_NOT_LOGGED_IN', status: 403 });
    }
    if (!currentServerKey) {
        return res.status(403).json({ error: 'ERROR: Not connected to a server.', code: 'ERR_NOT_CONNECTED', status: 403 });
    }
    const isValidKey = await validateServerKey(currentServerKey);
    if (!isValidKey) {
        return res.status(403).json({ error: 'Invalid server key', code: 'ERR_INVALID_SERVER_KEY', status: 403 });
    }
    const { roomCode } = req.body;
    try {
        const result = await pool.query('SELECT * FROM rooms WHERE code = $1', [roomCode]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Room not found', code: 'ERR_ROOM_NOT_FOUND', status: 404 });
        }
        if (result.rows[0].server_id !== currentServerKey) {
            return res.status(500).json({ error: 'Error joining room', code: 'ERR_INCORRECT_SKEY', status: 500 });
        }
        await pool.query('INSERT INTO room_users (room_id, user_name) VALUES ($1, $2)', [result.rows[0].id, currentUserId]);
        res.status(200).json({ message: `Joined room ${roomCode}`, status: 200 });
    } catch (err) {
        res.status(500).json({ error: 'Error joining room', code: 'ERR_JOIN_ROOM', status: 500 });
    }
});

app.post('/api/leave-room', async (req, res) => {
    if (!currentUserId) {
        return res.status(403).json({ error: 'ERROR: Not logged in.', code: 'ERR_NOT_LOGGED_IN', status: 403 });
    }
    if (!currentServerKey) {
        return res.status(403).json({ error: 'ERROR: Not connected to a server.', code: 'ERR_NOT_CONNECTED', status: 403 });
    }
    const isValidKey = await validateServerKey(currentServerKey);
    if (!isValidKey) {
        return res.status(403).json({ error: 'Invalid server key', code: 'ERR_INVALID_SERVER_KEY', status: 403 });
    }
    const { roomCode } = req.body;
    try {
        const result = await pool.query('SELECT * FROM rooms WHERE code = $1', [roomCode]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Room not found', code: 'ERR_ROOM_NOT_FOUND', status: 404 });
        }
        await pool.query('DELETE FROM room_users WHERE room_id = $1 AND user_name = $2', [result.rows[0].id, currentUserId]);
        res.status(200).json({ message: `Left room ${roomCode}`, status: 200 });
    } catch (err) {
        res.status(500).json({ error: 'Error leaving room', code: 'ERR_LEAVE_ROOM', status: 500 });
    }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
