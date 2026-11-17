const db = require('../db');

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

exports.getStudents = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, username, college_email
       FROM users
       WHERE role = 'Student' AND is_active = TRUE
       ORDER BY username`
    );
    return res.json(result.rows);
  } catch (error) {
    console.error('Messaging Student List Error:', error);
    return res.status(500).json({ error: 'Failed to fetch students' });
  }
};

exports.getConversations = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT c.id, c.student_id, c.teacher_id, c.created_at,
              s.username AS student_username, t.username AS teacher_username,
              latest.text AS latest_message, latest.sent_at AS latest_message_at
       FROM conversations c
       JOIN users s ON s.id = c.student_id
       JOIN users t ON t.id = c.teacher_id
       LEFT JOIN LATERAL (
         SELECT text, sent_at
         FROM messages
         WHERE conversation_id = c.id
         ORDER BY sent_at DESC
         LIMIT 1
       ) latest ON TRUE
       WHERE c.student_id = $1 OR c.teacher_id = $1
       ORDER BY COALESCE(latest.sent_at, c.created_at) DESC`,
      [req.user.id]
    );
    return res.json(result.rows);
  } catch (error) {
    console.error('Conversation List Error:', error);
    return res.status(500).json({ error: 'Failed to fetch conversations' });
  }
};

exports.createConversation = async (req, res) => {
  const { studentId } = req.body;
  if (!uuidPattern.test(studentId || '') || studentId === req.user.id) {
    return res.status(400).json({ error: 'Select a valid student' });
  }

  try {
    const student = await db.query(
      `SELECT id
       FROM users
       WHERE id = $1 AND role = 'Student' AND is_active = TRUE`,
      [studentId]
    );
    if (student.rowCount === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }

    await db.query(
      `INSERT INTO conversations (student_id, teacher_id)
       VALUES ($1, $2)
       ON CONFLICT (student_id, teacher_id) DO NOTHING`,
      [studentId, req.user.id]
    );
    const conversation = await db.query(
      `SELECT id, student_id, teacher_id, created_at
       FROM conversations
       WHERE student_id = $1 AND teacher_id = $2`,
      [studentId, req.user.id]
    );
    return res.status(201).json(conversation.rows[0]);
  } catch (error) {
    console.error('Create Conversation Error:', error);
    return res.status(500).json({ error: 'Failed to start conversation' });
  }
};

exports.getMessages = async (req, res) => {
  const { conversationId } = req.params;
  if (!uuidPattern.test(conversationId || '')) {
    return res.status(400).json({ error: 'Invalid conversation ID' });
  }

  try {
    const conversation = await db.query(
      `SELECT id
       FROM conversations
       WHERE id = $1 AND (student_id = $2 OR teacher_id = $2)`,
      [conversationId, req.user.id]
    );
    if (conversation.rowCount === 0) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const result = await db.query(
      `SELECT m.id, m.conversation_id, m.sender_id, m.text, m.sent_at, u.username AS sender_username
       FROM messages m
       JOIN users u ON u.id = m.sender_id
       WHERE m.conversation_id = $1
       ORDER BY m.sent_at, m.id`,
      [conversationId]
    );
    return res.json(result.rows);
  } catch (error) {
    console.error('Message List Error:', error);
    return res.status(500).json({ error: 'Failed to fetch messages' });
  }
};

exports.createMessage = async (req, res) => {
  const { conversationId } = req.params;
  const { text } = req.body;
  if (!uuidPattern.test(conversationId || '')) {
    return res.status(400).json({ error: 'Invalid conversation ID' });
  }
  if (typeof text !== 'string' || !text.trim() || text.trim().length > 4000) {
    return res.status(400).json({ error: 'Message must contain 1 to 4,000 characters' });
  }

  try {
    const conversation = await db.query(
      `SELECT c.id, c.student_id, c.teacher_id
       FROM conversations c
       JOIN users t ON t.id = c.teacher_id AND t.role = 'Teacher'
       JOIN users s ON s.id = c.student_id AND s.role = 'Student'
       WHERE c.id = $1 AND (c.teacher_id = $2 OR c.student_id = $2)`,
      [conversationId, req.user.id]
    );
    if (conversation.rowCount === 0) {
      return res.status(404).json({ error: 'Teacher-initiated conversation not found' });
    }

    const result = await db.query(
      `INSERT INTO messages (conversation_id, sender_id, text)
       VALUES ($1, $2, $3)
       RETURNING id, conversation_id, sender_id, text, sent_at`,
      [conversationId, req.user.id, text.trim()]
    );
    const message = { ...result.rows[0], sender_username: req.user.username };
    const recipientId = conversation.rows[0].teacher_id === req.user.id
      ? conversation.rows[0].student_id
      : conversation.rows[0].teacher_id;
    const io = req.app && req.app.get('socketio');
    if (io) io.to(`user_${recipientId}`).emit('receive_message', message);
    return res.status(201).json(message);
  } catch (error) {
    console.error('Create Message Error:', error);
    return res.status(500).json({ error: 'Failed to send message' });
  }
};
