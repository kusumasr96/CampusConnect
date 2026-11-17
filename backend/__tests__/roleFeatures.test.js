jest.mock('../src/db', () => ({
  query: jest.fn()
}));

const db = require('../src/db');
const messagesController = require('../src/controllers/messagesController');
const postsController = require('../src/controllers/postsController');

const createResponse = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn().mockReturnThis()
});

describe('role-based feature controllers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('does not send a message when no teacher-created participant thread exists', async () => {
    db.query.mockResolvedValueOnce({ rowCount: 0, rows: [] });
    const req = {
      params: { conversationId: '11111111-1111-4111-8111-111111111111' },
      body: { text: 'Hello' },
      user: { id: '22222222-2222-4222-8222-222222222222', role: 'Student' }
    };
    const res = createResponse();

    await messagesController.createMessage(req, res);

    expect(db.query).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Teacher-initiated conversation not found'
    });
  });

  test('allows an admin to delete a post they do not own', async () => {
    const postId = '11111111-1111-4111-8111-111111111111';
    const adminId = '22222222-2222-4222-8222-222222222222';
    db.query.mockResolvedValueOnce({ rowCount: 1, rows: [{ id: postId }] });
    const req = { params: { postId }, user: { id: adminId, role: 'Admin' } };
    const res = createResponse();

    await postsController.deletePost(req, res);

    expect(db.query.mock.calls[0][1]).toEqual([postId, true, adminId]);
    expect(res.json).toHaveBeenCalledWith({ message: 'Post deleted' });
  });
});
