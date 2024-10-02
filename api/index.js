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

app.get('/api/ping', (req, res) => {
    res.json({ message: 'pong' });
});

app.post('/api/login-custom-id', (req, res) => {
    const { customId } = req.body;
    currentUserId = customId;
    res.json({ message: `Logged in as ${customId}` });
});

app.post('/api/create-room', async (req, res) => {
    const { code } = req.body;
    const roomCode = code || Math.floor(1000 + Math.random() * 9000).toString();
    try {
        const result = await pool.query('INSERT INTO rooms (code) VALUES ($1) RETURNING *', [roomCode]);
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Error creating room' });
    }
});

app.post('/api/join-room', async (req, res) => {
    if (!currentUserId) {
        return res.status(403).json({ error: 'ERROR: Not logged in.' });
    }
    const { roomCode } = req.body;
    try {
        const result = await pool.query('SELECT * FROM rooms WHERE code = $1', [roomCode]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Room not found' });
        }
        await pool.query('INSERT INTO room_users (room_id, user_name) VALUES ($1, $2)', [result.rows[0].id, currentUserId]);
        res.status(200).json({ message: `Joined room ${roomCode}` });
    } catch (err) {
        res.status(500).json({ error: 'Error joining room' });
    }
});

app.post('/api/leave-room', async (req, res) => {
    if (!currentUserId) {
        return res.status(403).json({ error: 'ERROR: Not logged in.' });
    }
    const { roomCode } = req.body;
    try {
        const roomResult = await pool.query('SELECT * FROM rooms WHERE code = $1', [roomCode]);
        if (roomResult.rows.length === 0) {
            return res.status(404).json({ error: 'Room not found' });
        }
        const leaveResult = await pool.query('DELETE FROM room_users WHERE room_id = $1 AND user_name = $2', [roomResult.rows[0].id, currentUserId]);
        if (leaveResult.rowCount === 0) {
            return res.status(400).json({ error: 'ERROR: Cannot leave a room that you are not in.' });
        }
        res.status(200).json({ message: `Left room ${roomCode}` });
    } catch (err) {
        res.status(500).json({ error: 'Error leaving room' });
    }
});

app.get('/api/rooms', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM rooms');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Error retrieving rooms' });
    }
});

app.get('/api/room/:id', async (req, res) => {
    const roomId = req.params.id;
    try {
        const result = await pool.query('SELECT * FROM rooms WHERE id = $1', [roomId]);
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Error retrieving room' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
