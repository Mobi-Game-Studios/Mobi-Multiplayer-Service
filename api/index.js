const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const app = express();
const db = new sqlite3.Database('MainDatabase1.db');

app.use(cors());
app.use(express.json());

console.log('Starting the server...');
console.log('Setting up CORS...');
console.log('Setting up the database...');

app.get('/api/ping', (req, res) => {
    res.send('Server status online');
});

app.post('/api/ping', (req, res) => {
    res.send('Server status online');
});

app.post('/api/signal-movement', (req, res) => {
    const { customId, position } = req.body;
    if (!customId || !position) {
        return res.status(400).send('Invalid request');
    }
    db.run('INSERT OR REPLACE INTO players (id, position) VALUES (?, ?)', [customId, JSON.stringify(position)], function (err) {
        if (err) {
            return res.status(500).send(err.message);
        }
        res.send('Position updated');
    });
});

app.get('/api/get-positions-all', (req, res) => {
    db.all('SELECT * FROM players', [], (err, rows) => {
        if (err) {
            return res.status(500).send(err.message);
        }
        res.json(rows);
    });
});

app.get('/api/get-position', (req, res) => {
    const customId = req.query.customId;
    if (!customId) {
        return res.status(400).send('Custom ID is required');
    }
    db.get('SELECT * FROM players WHERE id = ?', [customId], (err, row) => {
        if (err) {
            return res.status(500).send(err.message);
        }
        if (!row) {
            return res.status(404).send('Player not found');
        }
        res.json(row);
    });
});

app.use((req, res) => {
    res.status(404).send('Not found');
});

// Global error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Internal server error: ' + err.message);
});

console.log('Server is running.');

module.exports = app;
