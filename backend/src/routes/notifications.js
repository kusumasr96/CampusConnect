const express = require('express');
const adminController = require('../controllers/adminController');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();
router.use(authenticateToken);

router.get('/', adminController.getNotifications);
router.patch('/:notificationId/read', adminController.markNotificationRead);

module.exports = router;
