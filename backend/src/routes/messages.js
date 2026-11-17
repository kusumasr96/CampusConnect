const express = require('express');
const messagesController = require('../controllers/messagesController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

const router = express.Router();
router.use(authenticateToken);

router.get('/students', authorizeRoles('Teacher'), messagesController.getStudents);
router.get('/conversations', authorizeRoles('Teacher', 'Student'), messagesController.getConversations);
router.post('/conversations', authorizeRoles('Teacher'), messagesController.createConversation);
router.get(
  '/conversations/:conversationId/messages',
  authorizeRoles('Teacher', 'Student'),
  messagesController.getMessages
);
router.post(
  '/conversations/:conversationId/messages',
  authorizeRoles('Teacher', 'Student'),
  messagesController.createMessage
);

module.exports = router;
