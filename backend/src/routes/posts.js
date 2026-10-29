const express = require('express');
const multer = require('multer');
const postController = require('../controllers/postsController');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();
const supportedMediaTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'video/mp4',
  'video/quicktime',
  'video/webm'
]);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, callback) => {
    if (!supportedMediaTypes.has(file.mimetype)) {
      callback(new Error('Only JPEG, PNG, GIF, WebP, MP4, MOV, and WebM files are supported'));
      return;
    }
    callback(null, true);
  }
});

const uploadMedia = (req, res, next) => {
  upload.single('media')(req, res, (error) => {
    if (!error) {
      next();
      return;
    }
    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
      res.status(413).json({ error: 'Media must be 50 MB or smaller' });
      return;
    }
    if (error instanceof multer.MulterError) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.status(400).json({ error: error.message });
  });
};

router.post('/', authenticateToken, uploadMedia, postController.createPost);
router.get('/', authenticateToken, postController.getFeed);
router.get('/profile/:userId', authenticateToken, postController.getProfileFeed);
router.get('/:postId/comments', authenticateToken, postController.getComments);
router.post('/:postId/comments', authenticateToken, postController.createComment);
router.post('/:postId/like', authenticateToken, postController.toggleLike);

module.exports = router;
