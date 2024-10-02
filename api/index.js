import express from 'express';
import { Postgres } from '@vercel/postgres'; // Make sure to install this package
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 3000;
const pool = new Postgres();

let currentUserId = null;
let currentServerKey = null;
let isConnected = false;

app.use(cors());
app.use(express.json());

const generateRandomString = (length) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
};

const generateServerKey = () => {
    return `${generateRandomString(32)}-${generateRandomString(32)}-${generateRandomString(32)}`;
};

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

app.get('/api/testing/server', (req, res) => {
    checkLoginStatus();
    res.json({ message: 'pong', status: 200 });
});

app.get('/api/testing/database', async (req, res) => {
    try {
        const { rows } = await pool.sql`SELECT NOW()`;
        res.json({ status: 'success', time: rows[0].now });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database connection failed', details: err });
    }
});

app.get('/api/login-custom-id', (req, res) => {
    const { id } = req.query;
    if (!id) {
        return res.status(400).json({ error: 'No ID provided', status: 400 });
    }
    currentUserId = id;
    res.json({ message: 'Logged in successfully', status: 200 });
});

app.get('/api/create-server-key', async (req, res) => {
    try {
        const serverKey = generateServerKey();
        await pool.sql`INSERT INTO servers (server_key) VALUES (${serverKey})`;
        currentServerKey = serverKey;
        res.json({ message: 'Server key created', serverKey, status: 200 });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to create server key', details: err });
    }
});

app.get('/api/connect', (req, res) => {
    checkLoginStatus();
    isConnected = true;
    res.json({ message: 'Connected to server', status: 200 });
});

app.get('/api/disconnect', (req, res) => {
    checkLoginStatus();
    isConnected = false;
    res.json({ message: 'Disconnected from server', status: 200 });
});

app.get('/api/join-room', async (req, res) => {
    const { roomCode } = req.query;
    checkLoginStatus();
    const { rows } = await pool.sql`SELECT * FROM rooms WHERE room_code = ${roomCode} AND server_key = ${currentServerKey}`;
    if (rows.length === 0) {
        return res.status(500).json({ error: 'Error joining room', code: 'ERR_INCORRECT_SKEY', status: 500 });
    }
    res.json({ message: 'Joined room successfully', room: rows[0], status: 200 });
});

app.get('/api/leave-room', async (req, res) => {
    checkLoginStatus();
    // Implement leave room logic
    res.json({ message: 'Left room successfully', status: 200 });
});

app.get('/api/create-room', async (req, res) => {
    checkLoginStatus();
    const { code } = req.query;
    const roomCode = code || generateRandomString(4);
    try {
        await pool.sql`INSERT INTO rooms (room_code, server_key) VALUES (${roomCode}, ${currentServerKey})`;
        res.json({ message: 'Room created', roomCode, status: 200 });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to create room', details: err });
    }
});

app.get('/api/get-server-info', async (req, res) => {
    checkLoginStatus();
    res.json({ serverKey: currentServerKey, status: 200 });
});

app.get('/api/get-room-info', async (req, res) => {
    checkLoginStatus();
    const { rows } = await pool.sql`SELECT room_code FROM rooms WHERE server_key = ${currentServerKey}`;
    res.json({ roomCode: rows.length ? rows[0].room_code : null, status: 200 });
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
