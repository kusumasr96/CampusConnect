const express = require('express');
const eventsController = require('../controllers/eventsController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const { createUploadMiddleware } = require('../middleware/upload');

const router = express.Router();
const brochureUpload = createUploadMiddleware(
  'brochure',
  new Set(['application/pdf']),
  15 * 1024 * 1024
);

router.get('/', authenticateToken, eventsController.getEvents);
router.post(
  '/',
  authenticateToken,
  authorizeRoles('Teacher'),
  brochureUpload,
  eventsController.createEvent
);

module.exports = router;
