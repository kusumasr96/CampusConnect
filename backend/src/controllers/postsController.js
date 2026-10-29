const { v2: cloudinary } = require('cloudinary');
const db = require('../db');

const categories = ['Dance', 'Singing', 'Painting', 'Technical', 'Photography', 'Others'];
const maximumImageSize = 10 * 1024 * 1024;
const maximumVideoSize = 50 * 1024 * 1024;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const isValidMedia = (file) => {
  const buffer = file.buffer;
  switch (file.mimetype) {
    case 'image/jpeg':
      return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    case 'image/png':
      return buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    case 'image/gif':
      return buffer.subarray(0, 6).toString('ascii').match(/^GIF8[79]a$/) !== null;
    case 'image/webp':
      return buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
        buffer.subarray(8, 12).toString('ascii') === 'WEBP';
    case 'video/mp4':
    case 'video/quicktime':
      return buffer.subarray(4, 8).toString('ascii') === 'ftyp';
    case 'video/webm':
      return buffer.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
    default:
      return false;
  }
};

const uploadToCloudinary = (file) => new Promise((resolve, reject) => {
  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    reject(new Error('Cloudinary upload is not configured'));
    return;
  }

  cloudinary.config({
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key: CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET
  });
  cloudinary.uploader.upload_stream({
    folder: 'campusconnect/posts',
    resource_type: file.mimetype.startsWith('video/') ? 'video' : 'image'
  }, (error, result) => {
    if (error) {
      reject(error);
      return;
    }
    if (!result || !result.secure_url || !result.public_id) {
      reject(new Error('Cloudinary returned an incomplete upload result'));
      return;
    }
    resolve(result);
  }).end(file.buffer);
});

const deleteCloudinaryAsset = (asset, resourceType) => new Promise((resolve, reject) => {
  cloudinary.uploader.destroy(asset.public_id, { resource_type: resourceType }, (error, result) => {
    if (error) {
      reject(error);
      return;
    }
    resolve(result);
  });
});

const buildFeedQuery = (userId, category, profileId, limit, offset) => {
  const values = [userId];
  const filters = [];
  if (profileId) {
    values.push(profileId);
    filters.push(`p.user_id = $${values.length}`);
  }
  if (category && category !== 'All') {
    values.push(category);
    filters.push(`p.category = $${values.length}`);
  }
  values.push(limit);
  const limitParameter = values.length;
  values.push(offset);
  const offsetParameter = values.length;

  return {
    text: `
      SELECT p.id, p.user_id, p.media_url, p.media_type, p.caption, p.category, p.created_at,
             u.username, u.role,
             (SELECT COUNT(*) FROM likes l WHERE l.post_id = p.id)::int AS likes_count,
             (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id)::int AS comments_count,
             EXISTS(SELECT 1 FROM likes l WHERE l.post_id = p.id AND l.user_id = $1) AS user_has_liked
      FROM posts p
      JOIN users u ON u.id = p.user_id
      ${filters.length ? `WHERE ${filters.join(' AND ')}` : ''}
      ORDER BY p.created_at DESC
      LIMIT $${limitParameter} OFFSET $${offsetParameter}`,
    values
  };
};

exports.createPost = async (req, res) => {
  const { category, caption } = req.body;
  const file = req.file;

  if (!file) {
    return res.status(400).json({ error: 'A photo or video file is required' });
  }
  if (!categories.includes(category)) {
    return res.status(400).json({ error: `Category is mandatory and must be one of: ${categories.join(', ')}` });
  }
  const isVideo = file.mimetype.startsWith('video/');
  if (file.size > (isVideo ? maximumVideoSize : maximumImageSize)) {
    return res.status(413).json({
      error: isVideo ? 'Videos must be 50 MB or smaller' : 'Images must be 10 MB or smaller'
    });
  }
  if (!isValidMedia(file)) {
    return res.status(400).json({ error: 'The uploaded file content does not match a supported image or video type' });
  }
  if (typeof caption === 'string' && caption.length > 2200) {
    return res.status(400).json({ error: 'Caption must be 2,200 characters or fewer' });
  }
  if (caption !== undefined && typeof caption !== 'string') {
    return res.status(400).json({ error: 'Caption must be text' });
  }

  let uploadedAsset;
  const resourceType = isVideo ? 'video' : 'image';
  try {
    uploadedAsset = await uploadToCloudinary(file);
    const result = await db.query(
      `INSERT INTO posts (user_id, media_url, media_type, caption, category)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, user_id, media_url, media_type, caption, category, created_at`,
      [req.user.id, uploadedAsset.secure_url, isVideo ? 'video' : 'image', caption ? caption.trim() : null, category]
    );

    return res.status(201).json({
      ...result.rows[0],
      username: req.user.username,
      role: req.user.role,
      likes_count: 0,
      comments_count: 0,
      user_has_liked: false
    });
  } catch (error) {
    console.error('Create Post Error:', error);
    if (uploadedAsset) {
      try {
        await deleteCloudinaryAsset(uploadedAsset, resourceType);
      } catch (cleanupError) {
        console.error('Failed to clean up uploaded post media:', cleanupError);
      }
    }
    return res.status(500).json({ error: 'Failed to upload media or create post' });
  }
};

exports.getFeed = async (req, res) => {
  const { category, limit: requestedLimit, offset: requestedOffset } = req.query;
  if (category && category !== 'All' && !categories.includes(category)) {
    return res.status(400).json({ error: 'Invalid category filter' });
  }
  const limit = Math.min(Math.max(Number.parseInt(requestedLimit, 10) || 20, 1), 50);
  const offset = Math.max(Number.parseInt(requestedOffset, 10) || 0, 0);

  try {
    const query = buildFeedQuery(req.user.id, category, null, limit, offset);
    const result = await db.query(query.text, query.values);
    return res.json(result.rows);
  } catch (error) {
    console.error('Get Feed Error:', error);
    return res.status(500).json({ error: 'Failed to fetch feed' });
  }
};

exports.getProfileFeed = async (req, res) => {
  const { userId } = req.params;
  const { category, limit: requestedLimit, offset: requestedOffset } = req.query;
  if (!uuidPattern.test(userId)) {
    return res.status(400).json({ error: 'Invalid user ID' });
  }
  if (category && category !== 'All' && !categories.includes(category)) {
    return res.status(400).json({ error: 'Invalid category filter' });
  }
  const limit = Math.min(Math.max(Number.parseInt(requestedLimit, 10) || 20, 1), 50);
  const offset = Math.max(Number.parseInt(requestedOffset, 10) || 0, 0);

  try {
    const query = buildFeedQuery(req.user.id, category, userId, limit, offset);
    const result = await db.query(query.text, query.values);
    return res.json(result.rows);
  } catch (error) {
    console.error('Get Profile Feed Error:', error);
    return res.status(500).json({ error: 'Failed to fetch profile feed' });
  }
};

exports.toggleLike = async (req, res) => {
  const { postId } = req.params;
  if (!uuidPattern.test(postId)) {
    return res.status(400).json({ error: 'Invalid post ID' });
  }

  let client;
  let transactionStarted = false;
  try {
    client = await db.pool.connect();
    await client.query('BEGIN');
    transactionStarted = true;

    const post = await client.query('SELECT id FROM posts WHERE id = $1 FOR UPDATE', [postId]);
    if (post.rowCount === 0) {
      await client.query('ROLLBACK');
      transactionStarted = false;
      return res.status(404).json({ error: 'Post not found' });
    }

    const existingLike = await client.query(
      'SELECT id FROM likes WHERE post_id = $1 AND user_id = $2',
      [postId, req.user.id]
    );
    let liked;
    if (existingLike.rowCount > 0) {
      await client.query('DELETE FROM likes WHERE post_id = $1 AND user_id = $2', [postId, req.user.id]);
      liked = false;
    } else {
      await client.query('INSERT INTO likes (post_id, user_id) VALUES ($1, $2)', [postId, req.user.id]);
      liked = true;
    }

    const countResult = await client.query('SELECT COUNT(*)::int AS likes_count FROM likes WHERE post_id = $1', [postId]);
    await client.query('COMMIT');
    transactionStarted = false;
    return res.json({ liked, likesCount: countResult.rows[0].likes_count });
  } catch (error) {
    if (transactionStarted) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        console.error('Toggle Like Rollback Error:', rollbackError);
      }
    }
    console.error('Toggle Like Error:', error);
    return res.status(500).json({ error: 'Failed to update like status' });
  } finally {
    if (client) client.release();
  }
};

exports.getComments = async (req, res) => {
  const { postId } = req.params;
  if (!uuidPattern.test(postId)) {
    return res.status(400).json({ error: 'Invalid post ID' });
  }

  try {
    const result = await db.query(
      `SELECT c.id, c.post_id, c.user_id, c.text, c.created_at, u.username
       FROM comments c
       JOIN users u ON u.id = c.user_id
       WHERE c.post_id = $1
       ORDER BY c.created_at ASC`,
      [postId]
    );
    return res.json(result.rows);
  } catch (error) {
    console.error('Get Comments Error:', error);
    return res.status(500).json({ error: 'Failed to fetch comments' });
  }
};

exports.createComment = async (req, res) => {
  const { postId } = req.params;
  const { text } = req.body;
  if (!uuidPattern.test(postId)) {
    return res.status(400).json({ error: 'Invalid post ID' });
  }
  if (typeof text !== 'string' || !text.trim() || text.trim().length > 1000) {
    return res.status(400).json({ error: 'Comment must contain 1 to 1,000 characters' });
  }

  try {
    const result = await db.query(
      `INSERT INTO comments (post_id, user_id, text)
       VALUES ($1, $2, $3)
       RETURNING id, post_id, user_id, text, created_at`,
      [postId, req.user.id, text.trim()]
    );
    return res.status(201).json({ ...result.rows[0], username: req.user.username });
  } catch (error) {
    console.error('Create Comment Error:', error);
    if (error.code === '23503') {
      return res.status(404).json({ error: 'Post not found' });
    }
    return res.status(500).json({ error: 'Failed to create comment' });
  }
};
