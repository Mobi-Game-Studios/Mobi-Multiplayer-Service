const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const app = express();
const port = 3456;

console.log('Starting server setup...');

console.log('Setting up CORS...');
app.use(cors());

console.log('Parsing incoming requests...');
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

let db;
console.log('Connecting to SQLite database asynchronously...');
(async () => {
    try {
        db = await open({
            filename: './databases/ServerDatabase1.db',
            driver: sqlite3.Database
        });

        console.log('Connected to SQLite database: ServerDatabase1.db');

        await db.run(`CREATE TABLE IF NOT EXISTS player_positions (
            player_id TEXT PRIMARY KEY,
            x REAL,
            y REAL,
            z REAL,
            room_code TEXT
        )`);

        await db.run(`CREATE TABLE IF NOT EXISTS rooms (
            room_code TEXT PRIMARY KEY,
            players TEXT
        )`);

        console.log('Database tables set up successfully.');
    } catch (err) {
        console.error('Failed to set up database:', err.message);
        process.exit(1); // Exit server if database cannot be set up
    }
})();

const checkLoggedIn = (req, res, next) => {
    if (!req.body.player_id) {
        return res.status(403).send('Not logged in.');
    }
    next();
};

const checkMethod = (expectedMethod) => {
    return (req, res, next) => {
        if (req.method !== expectedMethod) {
            return res.status(405).send(`Cannot ${req.method} a ${expectedMethod} request.`);
        }
        next();
    };
};

// Centralized Error Handler Middleware
const errorHandler = (err, req, res, next) => {
    console.error('Unhandled error:', err.message);
    res.status(500).send('Internal server error. Please try again later.');
};

// Ping route for both GET and POST
app.all('/ping', (req, res) => {
    res.send('Server status online');
});

// Login custom ID
app.post('/login-custom-id', checkMethod('POST'), async (req, res, next) => {
    try {
        const { player_id } = req.body;
        if (!player_id) {
            return res.status(400).send('Custom ID is required.');
        }
        res.send(`Logged in as ${player_id}`);
    } catch (err) {
        next(err); // Pass the error to the centralized handler
    }
});

// Create room
app.post('/create-room', checkMethod('POST'), async (req, res, next) => {
    try {
        const { code } = req.body;
        const roomCode = code || Math.floor(1000 + Math.random() * 9000).toString();

        await db.run(`INSERT INTO rooms (room_code, players) VALUES (?, ?)`, [roomCode, '']);
        res.send(`Room created with code: ${roomCode}`);
    } catch (err) {
        next(err);
    }
});

// Join room
app.post('/join-room', checkMethod('POST'), checkLoggedIn, async (req, res, next) => {
    try {
        const { player_id, room_code } = req.body;
        if (!room_code) {
            return res.status(400).send('Room code is required.');
        }

        const room = await db.get(`SELECT * FROM rooms WHERE room_code = ?`, [room_code]);
        if (!room) {
            return res.status(404).send('Room not found.');
        }

        let players = room.players ? room.players.split(',') : [];
        if (!players.includes(player_id)) {
            players.push(player_id);
            await db.run(`UPDATE rooms SET players = ? WHERE room_code = ?`, [players.join(','), room_code]);
            res.send(`Player ${player_id} joined room ${room_code}`);
        } else {
            res.send(`Player ${player_id} is already in room ${room_code}`);
        }
    } catch (err) {
        next(err);
    }
});

// Leave room
app.post('/leave-room', checkMethod('POST'), checkLoggedIn, async (req, res, next) => {
    try {
        const { player_id } = req.body;
        const player = await db.get(`SELECT * FROM player_positions WHERE player_id = ?`, [player_id]);
        if (!player || !player.room_code) {
            return res.status(400).send('Cannot leave a room that you are not in.');
        }

        const roomCode = player.room_code;
        const room = await db.get(`SELECT * FROM rooms WHERE room_code = ?`, [roomCode]);
        if (!room) {
            return res.status(404).send('Room not found.');
        }

        let players = room.players.split(',');
        players = players.filter(p => p !== player_id);
        await db.run(`UPDATE rooms SET players = ? WHERE room_code = ?`, [players.join(','), roomCode]);
        await db.run(`UPDATE player_positions SET room_code = NULL WHERE player_id = ?`, [player_id]);

        res.send(`Player ${player_id} left room ${roomCode}`);
    } catch (err) {
        next(err);
    }
});

// Signal movement
app.post('/signal-movement', checkMethod('POST'), checkLoggedIn, async (req, res, next) => {
    try {
        const { player_id, x, y, z } = req.body;

        await db.run(`INSERT INTO player_positions (player_id, x, y, z) VALUES (?, ?, ?, ?)
            ON CONFLICT(player_id) DO UPDATE SET x = excluded.x, y = excluded.y, z = excluded.z`, [player_id, x, y, z]);

        res.send('Position updated');
    } catch (err) {
        next(err);
    }
});

// Get all player positions
app.get('/get-positions-all', async (req, res, next) => {
    try {
        const rows = await db.all(`SELECT * FROM player_positions`);
        res.json(rows);
    } catch (err) {
        next(err);
    }
});

// Get position of a specific player by custom ID
app.get('/get-position', checkLoggedIn, async (req, res, next) => {
    try {
        const { player_id } = req.body; // Assuming player_id is sent in the request body

        const player = await db.get(`SELECT * FROM player_positions WHERE player_id = ?`, [player_id]);
        if (!player) {
            return res.status(404).send('Player not found.');
        }

        res.json(player);
    } catch (err) {
        next(err);
    }
});


// 404 Handler
app.use((req, res) => {
    res.status(404).send('Endpoint not found.');
});

// Centralized Error Handling
app.use(errorHandler);

app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
