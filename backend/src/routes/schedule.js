const express = require('express');
const router = express.Router();
const scheduleController = require('../controllers/scheduleController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

router.post('/', authenticateToken, authorizeRoles('Admin'), scheduleController.createScheduleEntry);
router.post('/:scheduleId/seating', authenticateToken, authorizeRoles('Admin'), scheduleController.assignExamSeating);
router.get('/my-exams', authenticateToken, authorizeRoles('Student'), scheduleController.getMyExamSchedule);

module.exports = router;
