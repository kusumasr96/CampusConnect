const db = require('../db');
const { uploadBuffer, deleteAsset } = require('../utils/cloudinary');

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const timetableTypes = new Set(['exam', 'test', 'class']);
const imageTypes = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);

const validUploadContent = (file) => {
  const buffer = file.buffer;
  if (file.mimetype === 'application/pdf') {
    return buffer.subarray(0, 5).toString('ascii') === '%PDF-';
  }
  if (file.mimetype === 'image/jpeg') {
    return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (file.mimetype === 'image/png') {
    return buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  }
  if (file.mimetype === 'image/gif') {
    return /^GIF8[79]a$/.test(buffer.subarray(0, 6).toString('ascii'));
  }
  if (file.mimetype === 'image/webp') {
    return buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buffer.subarray(8, 12).toString('ascii') === 'WEBP';
  }
  return false;
};

exports.getUsers = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, username, college_email, role, avatar_url, is_active, created_at
       FROM users
       ORDER BY created_at DESC, username`
    );
    return res.json(result.rows);
  } catch (error) {
    console.error('Admin User Directory Error:', error);
    return res.status(500).json({ error: 'Failed to fetch user directory' });
  }
};

exports.broadcastNotification = async (req, res) => {
  const { message } = req.body;
  if (typeof message !== 'string' || !message.trim() || message.trim().length > 2000) {
    return res.status(400).json({ error: 'Notification must contain 1 to 2,000 characters' });
  }

  try {
    const result = await db.query(
      `INSERT INTO notifications (user_id, type, message)
       SELECT id, 'COLLEGE_BROADCAST', $1
       FROM users
       WHERE role IN ('Student', 'Teacher') AND is_active = TRUE
       RETURNING id, user_id, type, message, is_read, created_at`,
      [message.trim()]
    );
    const io = req.app && req.app.get('socketio');
    if (io) {
      for (const notification of result.rows) {
        io.to(`user_${notification.user_id}`).emit('new_notification', notification);
      }
    }
    return res.status(201).json({ deliveredCount: result.rowCount });
  } catch (error) {
    console.error('Broadcast Notification Error:', error);
    return res.status(500).json({ error: 'Failed to broadcast notification' });
  }
};

exports.createTimetableUpload = async (req, res) => {
  const { title, type, semester } = req.body;
  const parsedSemester = Number(semester);
  if (typeof title !== 'string' || !title.trim() || title.trim().length > 150) {
    return res.status(400).json({ error: 'Title must contain 1 to 150 characters' });
  }
  if (!timetableTypes.has(type)) {
    return res.status(400).json({ error: 'Type must be exam, test, or class' });
  }
  if (!Number.isInteger(parsedSemester) || parsedSemester < 1) {
    return res.status(400).json({ error: 'Semester must be a positive whole number' });
  }
  if (!req.file || !validUploadContent(req.file)) {
    return res.status(400).json({ error: 'Upload a valid PDF or image timetable' });
  }

  const resourceType = req.file.mimetype.startsWith('image/') ? 'image' : 'raw';
  let uploadedAsset;
  try {
    uploadedAsset = await uploadBuffer(req.file, 'campusconnect/timetables', resourceType);
    const result = await db.query(
      `INSERT INTO timetable_uploads
         (title, type, batch_year, semester, file_url, file_type, uploaded_by)
       VALUES ($1, $2, 2024, $3, $4, $5, $6)
       RETURNING id, title, type, batch_year, semester, file_url, file_type, created_at`,
      [
        title.trim(),
        type,
        parsedSemester,
        uploadedAsset.secure_url,
        req.file.mimetype,
        req.user.id
      ]
    );
    return res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Timetable Upload Error:', error);
    if (uploadedAsset) {
      try {
        await deleteAsset(uploadedAsset, resourceType);
      } catch (cleanupError) {
        console.error('Failed to clean up uploaded timetable:', cleanupError);
      }
    }
    return res.status(500).json({ error: 'Failed to upload timetable' });
  }
};

exports.getTimetableUploads = async (req, res) => {
  const { type, semester } = req.query;
  if (type && !timetableTypes.has(type)) {
    return res.status(400).json({ error: 'Type must be exam, test, or class' });
  }
  if (semester !== undefined && (!/^\d+$/.test(semester) || Number(semester) < 1)) {
    return res.status(400).json({ error: 'Semester must be a positive whole number' });
  }

  const values = [2024];
  const filters = ['batch_year = $1'];
  if (type) {
    values.push(type);
    filters.push(`type = $${values.length}`);
  }
  if (semester !== undefined) {
    values.push(Number(semester));
    filters.push(`semester = $${values.length}`);
  }

  try {
    const result = await db.query(
      `SELECT id, title, type, batch_year, semester, file_url, file_type, created_at
       FROM timetable_uploads
       WHERE ${filters.join(' AND ')}
       ORDER BY semester, created_at DESC`,
      values
    );
    return res.json(result.rows);
  } catch (error) {
    console.error('Timetable List Error:', error);
    return res.status(500).json({ error: 'Failed to fetch timetable uploads' });
  }
};

exports.getNotifications = async (req, res) => {
  try {
    const [notifications, count] = await Promise.all([
      db.query(
        `SELECT id, type, message, is_read, created_at
         FROM notifications
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT 50`,
        [req.user.id]
      ),
      db.query(
        'SELECT COUNT(*)::int AS unread_count FROM notifications WHERE user_id = $1 AND is_read = FALSE',
        [req.user.id]
      )
    ]);
    return res.json({ notifications: notifications.rows, unreadCount: count.rows[0].unread_count });
  } catch (error) {
    console.error('Notification List Error:', error);
    return res.status(500).json({ error: 'Failed to fetch notifications' });
  }
};

exports.markNotificationRead = async (req, res) => {
  const { notificationId } = req.params;
  if (!uuidPattern.test(notificationId)) {
    return res.status(400).json({ error: 'Invalid notification ID' });
  }

  try {
    const result = await db.query(
      `UPDATE notifications
       SET is_read = TRUE
       WHERE id = $1 AND user_id = $2
       RETURNING id`,
      [notificationId, req.user.id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    return res.json({ message: 'Notification marked as read' });
  } catch (error) {
    console.error('Mark Notification Read Error:', error);
    return res.status(500).json({ error: 'Failed to update notification' });
  }
};

exports.imageTypes = imageTypes;
