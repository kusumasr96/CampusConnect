const express = require('express');
const adminController = require('../controllers/adminController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const { createUploadMiddleware } = require('../middleware/upload');

const router = express.Router();
const timetableUpload = createUploadMiddleware(
  'file',
  new Set(['application/pdf', ...adminController.imageTypes]),
  20 * 1024 * 1024
);

router.use(authenticateToken, authorizeRoles('Admin'));
router.get('/users', adminController.getUsers);
router.post('/notifications/broadcast', adminController.broadcastNotification);
router.post('/timetables', timetableUpload, adminController.createTimetableUpload);

module.exports = router;
