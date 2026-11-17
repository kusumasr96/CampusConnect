const express = require('express');
const profileController = require('../controllers/profileController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const { createUploadMiddleware } = require('../middleware/upload');

const router = express.Router();
const avatarUpload = createUploadMiddleware(
  'avatar',
  new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']),
  10 * 1024 * 1024
);

router.use(authenticateToken, authorizeRoles('Student', 'Teacher'));
router.get('/me', profileController.getMe);
router.post('/avatar', avatarUpload, profileController.updateAvatar);

module.exports = router;
