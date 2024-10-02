const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

// Use environment variables for Supabase configuration
const supabaseUrl = process.env.CLIENT_URI;
const supabaseAnonKey = process.env.CLIENT_ANON;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

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

app.post('/api/signup', async (req, res) => {
    const { email, password } = req.body;

    // Create a new user
    const { user, error } = await supabase.auth.signUp({
        email,
        password,
    });

    if (error) {
        return res.status(400).json({ message: 'Signup failed', code: 'ERR_SIGNUP_FAILED', details: error });
    }

    currentUserId = user.id; // Set the current user ID
    res.json({ message: 'Signup successful', status: 200 });
});

app.post('/api/login-custom-id', async (req, res) => {
    const { email, password } = req.body;
    const { user, error } = await supabase.auth.signIn({ email, password });
    
    if (error) {
        return res.status(401).json({ message: 'Login failed', code: 'ERR_LOGIN_FAILED' });
    }
    currentUserId = user.id;
    res.json({ message: 'Login successful', status: 200 });
});

app.post('/api/logout', async (req, res) => {
    const { error } = await supabase.auth.signOut();
    
    if (error) {
        return res.status(400).json({ message: 'Logout failed', code: 'ERR_LOGOUT_FAILED' });
    }
    currentUserId = null;
    isConnected = false;
    res.json({ message: 'Logout successful', status: 200 });
});

app.post('/api/create-server-key', async (req, res) => {
    const serverKey = generateServerKey();
    const { error } = await supabase
        .from('servers')
        .insert([{ key: serverKey }]);
    
    if (error) {
        return res.status(500).json({ message: 'Error creating server key', code: 'ERR_CREATE_SERVER_KEY' });
    }
    currentServerKey = serverKey;
    res.json({ message: 'Server key created', serverKey, status: 200 });
});

app.post('/api/connect-server-key', async (req, res) => {
    const { serverKey } = req.body;
    const { data, error } = await supabase
        .from('servers')
        .select('*')
        .eq('key', serverKey)
        .single();
    
    if (error || !data) {
        return res.status(403).json({ message: 'Invalid server key', code: 'ERR_INVALID_SERVER_KEY' });
    }
    currentServerKey = serverKey;
    isConnected = true;
    res.json({ message: 'Connected to server', status: 200 });
});

app.post('/api/create-room', async (req, res) => {
    checkLoginStatus();
    const { code } = req.body;
    const roomCode = code || generateRoomCode();
    
    const { error } = await supabase
        .from('rooms')
        .insert([{ code: roomCode, server_key: currentServerKey }]);
    
    if (error) {
        return res.status(500).json({ message: 'Error creating room', code: 'ERR_CREATE_ROOM' });
    }
    res.json({ message: 'Room created', roomCode, status: 200 });
});

app.post('/api/join-room', async (req, res) => {
    checkLoginStatus();
    const { roomCode } = req.body;
    
    const { data, error } = await supabase
        .from('rooms')
        .select('*')
        .eq('code', roomCode)
        .eq('server_key', currentServerKey)
        .single();
    
    if (error || !data) {
        return res.status(500).json({ error: 'Error joining room', code: 'ERR_INCORRECT_SKEY', status: 500 });
    }
    res.json({ message: 'Joined room', status: 200 });
});

app.post('/api/leave-room', async (req, res) => {
    checkLoginStatus();
    // Implement leave room logic here
    res.json({ message: 'Left room', status: 200 });
});

app.get('/api/get-server-info', (req, res) => {
    checkLoginStatus();
    res.json({ serverKey: currentServerKey, status: 200 });
});

app.get('/api/get-room-info', async (req, res) => {
    checkLoginStatus();
    const { data, error } = await supabase
        .from('rooms')
        .select('code')
        .eq('server_key', currentServerKey);
    
    if (error) {
        return res.status(500).json({ message: 'Error fetching room info', code: 'ERR_FETCH_ROOM_INFO' });
    }
    res.json({ rooms: data, status: 200 });
});

app.get('/api/testing/server', (req, res) => {
    checkLoginStatus();
    res.json({ message: 'pong', status: 200 });
});

app.get('/api/testing/database', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('some_table')
            .select('*');
        
        if (error) {
            throw new Error(error.message);
        }
        res.json({ status: 'success', data });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database connection failed', details: err });
    }
});

const generateRoomCode = () => {
    return Math.floor(1000 + Math.random() * 9000).toString(); // Generates a 4-digit random room code
};

const generateServerKey = () => {
    return `${generateRandomString(32)}-${generateRandomString(32)}-${generateRandomString(32)}`;
};

const generateRandomString = (length) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
};

app.listen(3000, () => {
    console.log('Server running on port 3000');
});
