const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../db');

const allowedRoles = ['Student', 'Teacher', 'Admin'];
const accessCookieName = 'accessToken';
const refreshCookieName = 'refreshToken';

const getCookieOptions = (token, path) => {
  const decoded = jwt.decode(token);
  if (!decoded || typeof decoded === 'string' || typeof decoded.exp !== 'number') {
    throw new Error('Generated token is missing an expiration time');
  }

  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    path,
    maxAge: Math.max(0, decoded.exp * 1000 - Date.now())
  };
};

const setSessionCookies = (res, accessToken, refreshToken) => {
  res.cookie(accessCookieName, accessToken, getCookieOptions(accessToken, '/'));
  res.cookie(refreshCookieName, refreshToken, getCookieOptions(refreshToken, '/api/auth'));
};

const clearSessionCookies = (res) => {
  const secure = process.env.NODE_ENV === 'production';
  const sameSite = secure ? 'none' : 'lax';
  res.clearCookie(accessCookieName, { httpOnly: true, secure, sameSite, path: '/' });
  res.clearCookie(refreshCookieName, { httpOnly: true, secure, sameSite, path: '/api/auth' });
};

const createTokens = (user) => {
  const accessSecret = process.env.JWT_ACCESS_SECRET;
  const refreshSecret = process.env.JWT_REFRESH_SECRET;
  if (!accessSecret || !refreshSecret) {
    throw new Error('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be configured');
  }

  const payload = {
    id: user.id,
    email: user.college_email,
    username: user.username,
    role: user.role
  };

  return {
    payload,
    accessToken: jwt.sign(payload, accessSecret, {
      expiresIn: process.env.JWT_ACCESS_EXPIRY || '15m'
    }),
    refreshToken: jwt.sign(payload, refreshSecret, {
      expiresIn: process.env.JWT_REFRESH_EXPIRY || '7d'
    })
  };
};

exports.register = async (req, res) => {
  try {
    const { accountType, username, collegeEmail, password } = req.body;

    if (
      typeof accountType !== 'string' ||
      typeof username !== 'string' ||
      typeof collegeEmail !== 'string' ||
      typeof password !== 'string' ||
      !accountType.trim() ||
      !username.trim() ||
      !collegeEmail.trim() ||
      !password
    ) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const normalizedRole = accountType.trim();
    const normalizedUsername = username.trim();
    const normalizedEmail = collegeEmail.trim().toLowerCase();
    if (!allowedRoles.includes(normalizedRole)) {
      return res.status(400).json({ error: 'Invalid account role' });
    }
    if (
      normalizedUsername.length > 50 ||
      normalizedEmail.length > 150 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)
    ) {
      return res.status(400).json({ error: 'Enter a valid college email and username' });
    }
    if (Buffer.byteLength(password, 'utf8') < 8 || Buffer.byteLength(password, 'utf8') > 72) {
      return res.status(400).json({ error: 'Password must be between 8 and 72 bytes' });
    }

    const recordResult = await db.query(
      `SELECT id
       FROM authorized_records
       WHERE LOWER(college_email) = $1 AND role = $2 AND is_active = TRUE`,
      [normalizedEmail, normalizedRole]
    );

    if (recordResult.rows.length === 0) {
      return res.status(403).json({ error: 'Email not found in authorized college records for the selected role.' });
    }

    const existingUser = await db.query(
      'SELECT id FROM users WHERE LOWER(college_email) = LOWER($1) OR LOWER(username) = LOWER($2)',
      [normalizedEmail, normalizedUsername]
    );
    if (existingUser.rows.length > 0) {
      return res.status(409).json({ error: 'Username or College Email is already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const newUser = await db.query(
      `INSERT INTO users (username, college_email, password_hash, role, record_id, is_verified, is_active)
       VALUES ($1, $2, $3, $4, $5, TRUE, TRUE)
       RETURNING id, username, college_email, role, created_at`,
      [normalizedUsername, normalizedEmail, passwordHash, normalizedRole, recordResult.rows[0].id]
    );

    res.status(201).json({
      message: 'Registration successful. You may now log in.',
      user: newUser.rows[0]
    });
  } catch (error) {
    console.error('Registration Error:', error);
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Username or College Email is already registered' });
    }
    res.status(500).json({ error: 'Server error during registration' });
  }
};

exports.login = async (req, res) => {
  try {
    const { collegeEmail, password } = req.body;
    if (typeof collegeEmail !== 'string' || typeof password !== 'string' || !collegeEmail.trim() || !password) {
      return res.status(400).json({ error: 'College email and password are required' });
    }

    const userResult = await db.query(
      'SELECT * FROM users WHERE LOWER(college_email) = LOWER($1)',
      [collegeEmail.trim().toLowerCase()]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = userResult.rows[0];
    if (!user.is_active) {
      return res.status(403).json({ error: 'Account has been deactivated. Contact administration.' });
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const { payload, accessToken, refreshToken } = createTokens(user);
    setSessionCookies(res, accessToken, refreshToken);
    return res.json({
      message: 'Login successful',
      user: payload
    });
  } catch (error) {
    console.error('Login Error:', error);
    res.status(500).json({ error: 'Server error during login' });
  }
};

exports.refresh = async (req, res) => {
  const refreshToken = req.cookies && req.cookies[refreshCookieName];
  const refreshSecret = process.env.JWT_REFRESH_SECRET;
  if (!refreshToken) {
    return res.status(401).json({ error: 'Refresh token is required' });
  }
  if (!refreshSecret) {
    console.error('JWT_REFRESH_SECRET must be configured');
    return res.status(500).json({ error: 'Server authentication is not configured' });
  }

  let decoded;
  try {
    decoded = jwt.verify(refreshToken, refreshSecret);
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired refresh token' });
  }
  if (!decoded || typeof decoded === 'string' || !decoded.id) {
    return res.status(401).json({ error: 'Invalid refresh token' });
  }

  try {
    const userResult = await db.query(
      'SELECT id, username, college_email, role FROM users WHERE id = $1 AND is_active = TRUE',
      [decoded.id]
    );
    if (userResult.rows.length === 0) {
      clearSessionCookies(res);
      return res.status(401).json({ error: 'Account is unavailable' });
    }

    const { payload, accessToken, refreshToken: nextRefreshToken } = createTokens(userResult.rows[0]);
    setSessionCookies(res, accessToken, nextRefreshToken);
    return res.json({ message: 'Session refreshed', user: payload });
  } catch (error) {
    console.error('Token Refresh Error:', error);
    return res.status(500).json({ error: 'Server error while refreshing session' });
  }
};

exports.logout = (req, res) => {
  clearSessionCookies(res);
  res.json({ message: 'Logout successful' });
};
