const express = require('express');
const router = express.Router();
const attendanceController = require('../controllers/attendanceController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

router.post('/mark', authenticateToken, authorizeRoles('Teacher'), attendanceController.markAttendance);
router.get('/subjects', authenticateToken, authorizeRoles('Teacher'), attendanceController.getTeacherSubjects);
router.get('/my-attendance', authenticateToken, attendanceController.getStudentAttendance);

module.exports = router;
