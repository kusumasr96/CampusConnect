const jwt = require('jsonwebtoken');

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const headerToken = authHeader && authHeader.startsWith('Bearer ')
    ? authHeader.slice('Bearer '.length)
    : null;
  const token = (req.cookies && req.cookies.accessToken) || headerToken;

  if (!token) {
    return res.status(401).json({ error: 'Access token missing or required' });
  }

  jwt.verify(token, process.env.JWT_ACCESS_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user; // { id, email, role, username }
    next();
  });
};

const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ 
        error: `Access denied. Role '${req.user ? req.user.role : 'Guest'}' is not authorized.` 
      });
    }
    next();
  };
};

module.exports = { authenticateToken, authorizeRoles };
