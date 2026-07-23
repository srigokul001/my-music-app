const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');
dns.setServers(['8.8.8.8', '8.8.4.4']);
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
const allowedOrigins = new Set([
  'https://srigokul001.github.io',
  'http://localhost:5500',
  'http://127.0.0.1:5500'
]);

// Middleware
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) return callback(null, true);
    return callback(new Error('Origin is not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false
}));
app.use(express.json());

// Return a readable JSON error when a client sends malformed JSON.
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    console.error('Malformed JSON request:', err.message);
    return res.status(400).json({ success: false, message: 'Request body must be valid JSON' });
  }
  next(err);
});

// Routes
app.use('/api/auth', require('./routes/auth'));

// Health endpoint makes Render and manual checks show whether MongoDB is ready.
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'MySpotify Backend Running',
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  if (err.message === 'Origin is not allowed by CORS') {
    return res.status(403).json({ success: false, message: 'Origin is not allowed' });
  }
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ success: false, message: 'Request body must be valid JSON' });
  }
  return res.status(500).json({ success: false, message: 'Unexpected server error' });
});

const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT} 🚀`);
});

mongoose.connection.on('connected', () => console.log('MongoDB Connected'));
mongoose.connection.on('error', err => console.error('MongoDB error:', err.message));
mongoose.connection.on('disconnected', () => console.error('MongoDB disconnected'));

if (!process.env.MONGO_URI) console.error('Startup configuration error: MONGO_URI is missing');
if (!process.env.JWT_SECRET) console.error('Startup configuration error: JWT_SECRET is missing');

if (process.env.MONGO_URI) {
  mongoose.connect(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 10000,
    connectTimeoutMS: 10000,
    socketTimeoutMS: 20000
  }).catch(err => console.error('MongoDB connection failed:', err.message));
}

process.on('unhandledRejection', err => console.error('Unhandled promise rejection:', err));
process.on('uncaughtException', err => {
  console.error('Uncaught exception:', err);
  server.close(() => process.exit(1));
});