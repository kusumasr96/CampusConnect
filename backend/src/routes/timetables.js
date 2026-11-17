const express = require('express');
const adminController = require('../controllers/adminController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

const router = express.Router();
router.get('/', authenticateToken, authorizeRoles('Student'), adminController.getTimetableUploads);

module.exports = router;
