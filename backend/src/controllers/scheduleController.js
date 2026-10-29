const db = require('../db');

const scheduleTypes = ['exam', 'internal_test', 'class', 'event'];
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,6})?)?$/;

const validDate = (date) => {
  if (typeof date !== 'string' || !datePattern.test(date)) return false;
  const parsedDate = new Date(`${date}T00:00:00.000Z`);
  return !Number.isNaN(parsedDate.getTime()) && parsedDate.toISOString().slice(0, 10) === date;
};

const validTimeRange = (startTime, endTime) => {
  if (typeof startTime !== 'string' || typeof endTime !== 'string' ||
      !timePattern.test(startTime) || !timePattern.test(endTime)) return false;
  const toSeconds = (time) => {
    const [hours, minutes, seconds = '0'] = time.split(':');
    return Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds);
  };
  return toSeconds(startTime) < toSeconds(endTime);
};

exports.checkVenueClash = async (roomId, date, startTime, endTime, queryable = db) => {
  const result = await queryable.query(
    `SELECT id
     FROM schedule
     WHERE room_id = $1
       AND date = $2
       AND start_time < $4
       AND end_time > $3
     LIMIT 1`,
    [roomId, date, startTime, endTime]
  );
  return result.rowCount > 0;
};

exports.createScheduleEntry = async (req, res) => {
  const { type, title, date, startTime, endTime, roomId, branch, semester, section } = req.body;
  if (!scheduleTypes.includes(type)) {
    return res.status(400).json({ error: `Type must be one of: ${scheduleTypes.join(', ')}` });
  }
  if (typeof title !== 'string' || !title.trim() || title.trim().length > 150) {
    return res.status(400).json({ error: 'Title must contain 1 to 150 characters' });
  }
  if (!validDate(date) || !validTimeRange(startTime, endTime)) {
    return res.status(400).json({ error: 'Provide a valid date and a time range where end time is after start time' });
  }
  if (!uuidPattern.test(roomId || '')) {
    return res.status(400).json({ error: 'A valid room ID is required' });
  }
  if (semester !== undefined && semester !== null && (!Number.isInteger(semester) || semester < 1)) {
    return res.status(400).json({ error: 'Semester must be a positive whole number' });
  }
  if (branch !== undefined && branch !== null && (typeof branch !== 'string' || branch.length > 50)) {
    return res.status(400).json({ error: 'Branch must be 50 characters or fewer' });
  }
  if (section !== undefined && section !== null && (typeof section !== 'string' || section.length > 10)) {
    return res.status(400).json({ error: 'Section must be 10 characters or fewer' });
  }

  let client;
  let transactionStarted = false;
  try {
    client = await db.pool.connect();
    await client.query('BEGIN');
    transactionStarted = true;
    await client.query(
      'SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))',
      [roomId, date]
    );

    const room = await client.query(
      'SELECT id FROM rooms WHERE id = $1 FOR SHARE',
      [roomId]
    );
    if (room.rowCount === 0) {
      await client.query('ROLLBACK');
      transactionStarted = false;
      return res.status(404).json({ error: 'Room not found' });
    }

    if (await exports.checkVenueClash(roomId, date, startTime, endTime, client)) {
      await client.query('ROLLBACK');
      transactionStarted = false;
      return res.status(409).json({ error: 'Venue clash detected: the selected room is already booked during this time.' });
    }

    const result = await client.query(
      `INSERT INTO schedule (type, title, date, start_time, end_time, room_id, branch, semester, section)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, type, title, date, start_time, end_time, room_id, branch, semester, section, created_at`,
      [
        type,
        title.trim(),
        date,
        startTime,
        endTime,
        roomId,
        branch || null,
        semester || null,
        section || null
      ]
    );
    await client.query('COMMIT');
    transactionStarted = false;
    return res.status(201).json(result.rows[0]);
  } catch (error) {
    if (transactionStarted && client) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        console.error('Create Schedule Rollback Error:', rollbackError);
      }
    }
    console.error('Create Schedule Error:', error);
    return res.status(500).json({ error: 'Failed to create schedule entry' });
  } finally {
    if (client) client.release();
  }
};

exports.assignExamSeating = async (req, res) => {
  const { scheduleId } = req.params;
  const { seats } = req.body;
  if (!uuidPattern.test(scheduleId || '')) {
    return res.status(400).json({ error: 'Invalid schedule ID' });
  }
  if (!Array.isArray(seats) || seats.length === 0 || seats.length > 500) {
    return res.status(400).json({ error: 'Provide between 1 and 500 seat assignments' });
  }
  const assignedStudents = new Set();
  const assignedSeats = new Set();
  for (const assignment of seats) {
    if (!assignment || !uuidPattern.test(assignment.studentId || '') ||
        typeof assignment.seatNo !== 'string' || !assignment.seatNo.trim() ||
        assignment.seatNo.trim().length > 20) {
      return res.status(400).json({ error: 'Each seat assignment needs a valid student ID and seat number' });
    }
    const normalizedSeat = assignment.seatNo.trim().toLowerCase();
    if (assignedStudents.has(assignment.studentId) || assignedSeats.has(normalizedSeat)) {
      return res.status(400).json({ error: 'A student and seat number may only appear once per request' });
    }
    assignedStudents.add(assignment.studentId);
    assignedSeats.add(normalizedSeat);
  }

  let client;
  let transactionStarted = false;
  try {
    client = await db.pool.connect();
    await client.query('BEGIN');
    transactionStarted = true;

    const scheduleResult = await client.query(
      `SELECT s.id, s.type, s.branch, s.semester, s.section, r.capacity
       FROM schedule s
       JOIN rooms r ON r.id = s.room_id
       WHERE s.id = $1
       FOR UPDATE OF s`,
      [scheduleId]
    );
    if (scheduleResult.rowCount === 0) {
      await client.query('ROLLBACK');
      transactionStarted = false;
      return res.status(404).json({ error: 'Schedule or room not found' });
    }
    const schedule = scheduleResult.rows[0];
    if (schedule.type !== 'exam' && schedule.type !== 'internal_test') {
      await client.query('ROLLBACK');
      transactionStarted = false;
      return res.status(400).json({ error: 'Seat assignments are only supported for exams and internal tests' });
    }
    if (seats.length > schedule.capacity) {
      await client.query('ROLLBACK');
      transactionStarted = false;
      return res.status(400).json({ error: 'Seat assignments exceed the room capacity' });
    }

    const studentIds = [...assignedStudents];
    const studentsResult = await client.query(
      `SELECT u.id
       FROM users u
       JOIN authorized_records ar ON ar.id = u.record_id
       WHERE u.id = ANY($1::uuid[])
         AND u.role = 'Student'
         AND u.is_active = TRUE
         AND ar.role = 'Student'
         AND ar.is_active = TRUE
         AND ($2::varchar IS NULL OR ar.branch = $2)
         AND ($3::integer IS NULL OR ar.semester = $3)
         AND ($4::varchar IS NULL OR ar.section = $4)`,
      [studentIds, schedule.branch, schedule.semester, schedule.section]
    );
    if (studentsResult.rowCount !== studentIds.length) {
      await client.query('ROLLBACK');
      transactionStarted = false;
      return res.status(400).json({ error: 'Every assigned student must be active and match the schedule cohort' });
    }

    const insertedSeats = [];
    for (const assignment of seats) {
      const result = await client.query(
        `INSERT INTO exam_seating (schedule_id, student_id, seat_no)
         VALUES ($1, $2, $3)
         ON CONFLICT (schedule_id, student_id)
         DO UPDATE SET seat_no = EXCLUDED.seat_no
         RETURNING student_id, seat_no`,
        [scheduleId, assignment.studentId, assignment.seatNo.trim()]
      );
      insertedSeats.push(result.rows[0]);
    }

    await client.query('COMMIT');
    transactionStarted = false;
    return res.status(201).json({
      message: 'Exam seating assigned successfully',
      assignedCount: insertedSeats.length
    });
  } catch (error) {
    if (transactionStarted && client) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        console.error('Assign Seating Rollback Error:', rollbackError);
      }
    }
    if (error.code === '23505') {
      return res.status(409).json({ error: 'A seat is already assigned to another student for this schedule' });
    }
    console.error('Assign Exam Seating Error:', error);
    return res.status(500).json({ error: 'Failed to assign exam seating' });
  } finally {
    if (client) client.release();
  }
};

exports.getMyExamSchedule = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT s.id AS schedule_id,
              s.title AS subject_or_exam,
              s.date,
              s.start_time,
              s.end_time,
              r.room_no,
              r.building,
              es.seat_no
       FROM exam_seating es
       JOIN schedule s ON s.id = es.schedule_id
       JOIN rooms r ON r.id = s.room_id
       WHERE es.student_id = $1
         AND s.type IN ('exam', 'internal_test')
       ORDER BY s.date, s.start_time`,
      [req.user.id]
    );
    return res.json(result.rows);
  } catch (error) {
    console.error('Exam Schedule Error:', error);
    return res.status(500).json({ error: 'Failed to fetch personal exam schedule' });
  }
};
