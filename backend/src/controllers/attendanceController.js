const db = require('../db');

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const attendanceThreshold = 75;

const calculatePercentage = (attended, total) => (
  total === 0 ? 100 : Number(((attended / total) * 100).toFixed(2))
);

exports.getTeacherSubjects = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT s.id AS subject_id, s.code AS subject_code, s.name AS subject_name,
              s.branch, s.semester,
              COALESCE(
                json_agg(
                  json_build_object(
                    'id', u.id,
                    'username', u.username,
                    'full_name', ar.full_name,
                    'college_email', u.college_email
                  ) ORDER BY ar.full_name
                ) FILTER (WHERE u.id IS NOT NULL),
                '[]'::json
              ) AS students
       FROM subjects s
       LEFT JOIN authorized_records ar
         ON ar.role = 'Student'
        AND ar.branch = s.branch
        AND ar.semester = s.semester
        AND ar.is_active = TRUE
       LEFT JOIN users u
         ON u.record_id = ar.id
        AND u.role = 'Student'
        AND u.is_active = TRUE
       WHERE s.teacher_id = $1
       GROUP BY s.id
       ORDER BY s.semester, s.code`,
      [req.user.id]
    );
    return res.json(result.rows);
  } catch (error) {
    console.error('Fetch Teacher Subjects Error:', error);
    return res.status(500).json({ error: 'Failed to fetch assigned subjects' });
  }
};

exports.markAttendance = async (req, res) => {
  const { studentId, subjectId, date, status } = req.body;
  if (!uuidPattern.test(studentId || '') || !uuidPattern.test(subjectId || '')) {
    return res.status(400).json({ error: 'Valid student and subject IDs are required' });
  }
  if (!['Present', 'Absent'].includes(status)) {
    return res.status(400).json({ error: 'Status must be Present or Absent' });
  }
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: 'A valid attendance date is required (YYYY-MM-DD)' });
  }
  const parsedDate = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== date) {
    return res.status(400).json({ error: 'Attendance date is invalid' });
  }

  let client;
  let transactionStarted = false;
  let notification;
  let responseBody;
  try {
    client = await db.pool.connect();
    await client.query('BEGIN');
    transactionStarted = true;

    await client.query(
      'SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))',
      [studentId, subjectId]
    );

    const subjectResult = await client.query(
      'SELECT id, name, branch, semester FROM subjects WHERE id = $1 AND teacher_id = $2 FOR SHARE',
      [subjectId, req.user.id]
    );
    if (subjectResult.rowCount === 0) {
      await client.query('ROLLBACK');
      transactionStarted = false;
      return res.status(403).json({ error: 'You are not assigned to this subject' });
    }

    const studentResult = await client.query(
      `SELECT u.id
       FROM users u
       JOIN authorized_records ar ON ar.id = u.record_id
       WHERE u.id = $1
         AND u.role = 'Student'
         AND u.is_active = TRUE
         AND ar.role = 'Student'
         AND ar.is_active = TRUE
         AND ar.branch = $2
         AND ar.semester = $3`,
      [studentId, subjectResult.rows[0].branch, subjectResult.rows[0].semester]
    );
    if (studentResult.rowCount === 0) {
      await client.query('ROLLBACK');
      transactionStarted = false;
      return res.status(404).json({ error: 'Student is not enrolled in this subject cohort' });
    }

    const priorStats = await client.query(
      `SELECT COUNT(*)::int AS total_classes,
              COUNT(*) FILTER (WHERE status = 'Present')::int AS attended_classes
       FROM attendance
       WHERE student_id = $1 AND subject_id = $2`,
      [studentId, subjectId]
    );
    const previousPercentage = calculatePercentage(
      priorStats.rows[0].attended_classes,
      priorStats.rows[0].total_classes
    );

    const attendanceResult = await client.query(
      `INSERT INTO attendance (student_id, subject_id, date, status, marked_by)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (student_id, subject_id, date)
       DO UPDATE SET status = EXCLUDED.status, marked_by = EXCLUDED.marked_by
       RETURNING id, student_id, subject_id, date, status, marked_by, created_at`,
      [studentId, subjectId, date, status, req.user.id]
    );

    const currentStats = await client.query(
      `SELECT COUNT(*)::int AS total_classes,
              COUNT(*) FILTER (WHERE status = 'Present')::int AS attended_classes
       FROM attendance
       WHERE student_id = $1 AND subject_id = $2`,
      [studentId, subjectId]
    );
    const totalClasses = currentStats.rows[0].total_classes;
    const attendedClasses = currentStats.rows[0].attended_classes;
    const currentPercentage = calculatePercentage(attendedClasses, totalClasses);
    const warningTriggered = previousPercentage >= attendanceThreshold &&
      currentPercentage < attendanceThreshold;

    if (warningTriggered) {
      const message = `Your attendance in ${subjectResult.rows[0].name} is ${currentPercentage}%, below the required 75%. Contact your instructor.`;
      const notificationResult = await client.query(
        `INSERT INTO notifications (user_id, type, message)
         VALUES ($1, 'ATTENDANCE_WARNING', $2)
         RETURNING id, user_id, type, message, is_read, created_at`,
        [studentId, message]
      );
      notification = notificationResult.rows[0];
    }

    await client.query('COMMIT');
    transactionStarted = false;
    responseBody = {
      message: 'Attendance recorded successfully',
      record: attendanceResult.rows[0],
      totalClasses,
      attendedClasses,
      currentPercentage,
      warningTriggered
    };
  } catch (error) {
    if (transactionStarted && client) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        console.error('Attendance Rollback Error:', rollbackError);
      }
    }
    console.error('Attendance Mark Error:', error);
    return res.status(500).json({ error: 'Failed to record attendance' });
  } finally {
    if (client) client.release();
  }

  if (notification) {
    const io = req.app && req.app.get('socketio');
    if (io) {
      io.to(`user_${studentId}`).emit('new_notification', notification);
    }
  }
  return res.json(responseBody);
};

exports.getStudentAttendance = async (req, res) => {
  const studentId = req.user.role === 'Student' ? req.user.id : req.query.studentId;
  if (!studentId || !uuidPattern.test(studentId)) {
    return res.status(400).json({ error: 'A valid student ID is required' });
  }
  if (req.user.role !== 'Student' && !['Teacher', 'Admin'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Access denied' });
  }
  if (req.user.role === 'Teacher') {
    try {
      const assignment = await db.query(
        `SELECT 1
         FROM users u
         JOIN authorized_records ar ON ar.id = u.record_id
         JOIN subjects s
           ON s.branch = ar.branch
          AND s.semester = ar.semester
         WHERE u.id = $1
           AND u.role = 'Student'
           AND u.is_active = TRUE
           AND ar.is_active = TRUE
           AND s.teacher_id = $2
         LIMIT 1`,
        [studentId, req.user.id]
      );
      if (assignment.rowCount === 0) {
        return res.status(403).json({ error: 'You are not assigned to this student’s attendance' });
      }
    } catch (error) {
      console.error('Validate Attendance Access Error:', error);
      return res.status(500).json({ error: 'Failed to validate attendance access' });
    }
  }

  try {
    const summary = await db.query(
      `SELECT s.id AS subject_id,
              s.code AS subject_code,
              s.name AS subject_name,
              COUNT(a.id)::int AS total_classes,
              COUNT(a.id) FILTER (WHERE a.status = 'Present')::int AS attended_classes,
              CASE
                WHEN COUNT(a.id) = 0 THEN 100.00
                ELSE ROUND(
                  COUNT(a.id) FILTER (WHERE a.status = 'Present')::numeric
                  / COUNT(a.id) * 100,
                  2
                )
              END AS percentage
       FROM subjects s
       LEFT JOIN attendance a ON a.subject_id = s.id AND a.student_id = $1
       ${req.user.role === 'Student' ? '' : 'WHERE s.teacher_id = $2'}
       GROUP BY s.id, s.code, s.name
       ORDER BY s.code`,
      req.user.role === 'Student' ? [studentId] : [studentId, req.user.id]
    );
    return res.json(summary.rows);
  } catch (error) {
    console.error('Fetch Attendance Error:', error);
    return res.status(500).json({ error: 'Failed to fetch attendance data' });
  }
};
