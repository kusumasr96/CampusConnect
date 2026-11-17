const db = require('../db');
const { uploadBuffer, deleteAsset } = require('../utils/cloudinary');

const isValidImage = (file) => {
  const buffer = file.buffer;
  if (file.mimetype === 'image/jpeg') {
    return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (file.mimetype === 'image/png') {
    return buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  }
  if (file.mimetype === 'image/gif') {
    return /^GIF8[79]a$/.test(buffer.subarray(0, 6).toString('ascii'));
  }
  return file.mimetype === 'image/webp' &&
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP';
};

exports.getMe = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, username, college_email, role, avatar_url, bio, created_at
       FROM users
       WHERE id = $1 AND is_active = TRUE`,
      [req.user.id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Profile not found' });
    }
    return res.json(result.rows[0]);
  } catch (error) {
    console.error('Profile Fetch Error:', error);
    return res.status(500).json({ error: 'Failed to fetch profile' });
  }
};

exports.updateAvatar = async (req, res) => {
  if (!req.file || !isValidImage(req.file)) {
    return res.status(400).json({ error: 'Upload a valid JPEG, PNG, GIF, or WebP image' });
  }

  let uploadedAsset;
  try {
    uploadedAsset = await uploadBuffer(req.file, 'campusconnect/profiles', 'image');
    const result = await db.query(
      `UPDATE users
       SET avatar_url = $1
       WHERE id = $2 AND is_active = TRUE
       RETURNING id, username, role, avatar_url`,
      [uploadedAsset.secure_url, req.user.id]
    );
    if (result.rowCount === 0) {
      await deleteAsset(uploadedAsset, 'image');
      return res.status(404).json({ error: 'Profile not found' });
    }
    return res.json(result.rows[0]);
  } catch (error) {
    console.error('Profile Picture Update Error:', error);
    if (uploadedAsset) {
      try {
        await deleteAsset(uploadedAsset, 'image');
      } catch (cleanupError) {
        console.error('Failed to clean up uploaded profile picture:', cleanupError);
      }
    }
    return res.status(500).json({ error: 'Failed to update profile picture' });
  }
};
