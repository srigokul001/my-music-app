const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

function cleanUsername(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function validateCredentials(body) {
  const username = cleanUsername(body && body.username);
  const password = typeof (body && body.password) === 'string' ? body.password : '';
  if (!username || !password) return { message: 'Username and password are required' };
  if (username.length < 3 || username.length > 50) return { message: 'Username must be between 3 and 50 characters' };
  if (password.length < 6) return { message: 'Password must be at least 6 characters' };
  return { username, password };
}

function checkServiceConfiguration() {
  if (!process.env.MONGO_URI) return 'MONGO_URI is not configured on the server';
  if (!process.env.JWT_SECRET) return 'JWT_SECRET is not configured on the server';
  return null;
}

function checkDatabaseConnection() {
  return User.db.readyState === 1;
}

// Register a new account using a hashed password only; plaintext passwords are never stored or returned.
router.post('/register', async (req, res) => {
  const configurationError = checkServiceConfiguration();
  if (configurationError) return res.status(503).json({ success: false, message: configurationError });
  if (!checkDatabaseConnection()) return res.status(503).json({ success: false, message: 'Database is unavailable. Please try again shortly.' });

  const credentials = validateCredentials(req.body || {});
  if (credentials.message) return res.status(400).json({ success: false, message: credentials.message });

  try {
    const existing = await User.findOne({ username: credentials.username }).maxTimeMS(8000);
    if (existing) return res.status(409).json({ success: false, message: 'Username is already registered' });

    const hashedPassword = await bcrypt.hash(credentials.password, 12);
    await new User({ username: credentials.username, password: hashedPassword }).save();
    return res.status(201).json({ success: true, message: 'Registered successfully' });
  } catch (err) {
    console.error('Registration error:', err);
    if (err.code === 11000) return res.status(409).json({ success: false, message: 'Username is already registered' });
    return res.status(500).json({ success: false, message: 'Registration could not be completed' });
  }
});

// Authenticate an account and issue a JWT that expires after seven days.
router.post('/login', async (req, res) => {
  const configurationError = checkServiceConfiguration();
  if (configurationError) return res.status(503).json({ success: false, message: configurationError });
  if (!checkDatabaseConnection()) return res.status(503).json({ success: false, message: 'Database is unavailable. Please try again shortly.' });

  const credentials = validateCredentials(req.body || {});
  if (credentials.message) return res.status(400).json({ success: false, message: credentials.message });

  try {
    const user = await User.findOne({ username: credentials.username }).maxTimeMS(8000);
    if (!user) return res.status(401).json({ success: false, message: 'Invalid username or password' });

    const passwordMatches = await bcrypt.compare(credentials.password, user.password);
    if (!passwordMatches) return res.status(401).json({ success: false, message: 'Invalid username or password' });

    const token = jwt.sign(
      { id: user._id.toString(), username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    return res.json({ success: true, token, username: user.username });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ success: false, message: 'Login could not be completed' });
  }
});

module.exports = router;