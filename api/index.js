const express = require("express");
const cors = require("cors");
const sqlite3 = require("sqlite3").verbose();

const app = express();
app.use(cors());
app.use(express.json());

console.log("Starting server...");
console.log("Setting up CORS...");
console.log("Setting up database...");

const db = new sqlite3.Database("ServerDatabase1.db", (err) => {
  if (err) {
    console.error(err.message);
  } else {
    console.log("Connected to the ServerDatabase1 database.");
  }
});

app.post("/signal-movement", (req, res) => {
  const { customId, position } = req.body;
  if (!customId || !position) {
    return res.status(400).send("Invalid request");
  }
  db.run(
    `INSERT INTO player_positions (custom_id, position) VALUES (?, ?) ON CONFLICT(custom_id) DO UPDATE SET position = ?`,
    [customId, position, position],
    (err) => {
      if (err) {
        console.error(err.message);
        return res.status(500).send("Failed to update position");
      }
      res.send("Position updated successfully");
    }
  );
});

app.get("/get-positions-all", (req, res) => {
  db.all(`SELECT * FROM player_positions`, [], (err, rows) => {
    if (err) {
      console.error(err.message);
      return res.status(500).send("Failed to retrieve positions");
    }
    res.json(rows);
  });
});

app.get("/get-position", (req, res) => {
  const customId = req.query.customId;
  if (!customId) {
    return res.status(400).send("Custom ID is required");
  }
  db.get(`SELECT * FROM player_positions WHERE custom_id = ?`, [customId], (err, row) => {
    if (err) {
      console.error(err.message);
      return res.status(500).send("Failed to retrieve position");
    }
    if (!row) {
      return res.status(404).send("Position not found");
    }
    res.json(row);
  });
});

app.post("/login-custom-id", (req, res) => {
  const { customId } = req.body;
  if (!customId) {
    return res.status(400).send("Custom ID is required");
  }
  res.send("Logged in with custom ID");
});

app.post("/join-room", (req, res) => {
  const { roomCode } = req.body;
  if (!roomCode) {
    return res.status(400).send("Room code is required");
  }
  res.send("Joined room: " + roomCode);
});

app.post("/leave-room", (req, res) => {
  res.send("Left the room");
});

app.post("/create-room", (req, res) => {
  const { roomCode } = req.body;
  const newRoomCode = roomCode || Math.floor(Math.random() * 9000) + 1000;
  res.send("Room created with code: " + newRoomCode);
});

app.get("/ping", (req, res) => {
  res.send("Server status online");
});

app.post("/ping", (req, res) => {
  res.send("Server status online");
});

app.use((req, res) => {
  res.status(404).send("Cannot GET a Post request.");
});

module.exports = app;
