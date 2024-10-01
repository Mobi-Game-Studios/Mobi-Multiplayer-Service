const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

// Initialize the express app
const app = express();
const port = 3000; // Set your desired port

// Middleware
app.use(cors());
app.use(express.json()); // Parse JSON bodies

// PostgreSQL connection setup
const pool = new Pool({
    user: process.env.POSTGRES_USER, // Use environment variable
    host: process.env.POSTGRES_HOST, // Use environment variable
    database: process.env.POSTGRES_DATABASE, // Use environment variable
    password: process.env.POSTGRES_PASSWORD, // Use environment variable
    port: process.env.DB_PORT || 5432, // Default to 5432 if not set
});

// Test the database connection
pool.connect()
    .then(() => console.log('Connected to the database'))
    .catch(err => console.error('Database connection error', err));

// Create a table if it doesn't exist
const createTable = async () => {
    const query = `
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            data_column VARCHAR(255) NOT NULL
        );
    `;
    try {
        await pool.query(query);
        console.log('Table created successfully');
    } catch (err) {
        console.error('Error creating table', err);
    }
};

// Call the function to create the table
createTable();

// Example route to insert data
app.post('/data', async (req, res) => {
    const { data_column } = req.body;
    try {
        const result = await pool.query('INSERT INTO users (data_column) VALUES ($1) RETURNING *', [data_column]);
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Error inserting data', err);
        res.status(500).json({ error: 'Error inserting data' });
    }
});

// Example route to get all data
app.get('/data', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM users');
        res.status(200).json(result.rows);
    } catch (err) {
        console.error('Error fetching data', err);
        res.status(500).json({ error: 'Error fetching data' });
    }
});

// Start the server
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
