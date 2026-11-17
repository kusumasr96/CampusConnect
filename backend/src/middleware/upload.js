const multer = require('multer');

const createUploadMiddleware = (fieldName, allowedTypes, maxFileSize) => {
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: maxFileSize, files: 1 },
    fileFilter: (req, file, callback) => {
      if (!allowedTypes.has(file.mimetype)) {
        callback(new Error('Unsupported file type'));
        return;
      }
      callback(null, true);
    }
  });

  return (req, res, next) => {
    upload.single(fieldName)(req, res, (error) => {
      if (!error) {
        next();
        return;
      }
      if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: 'The uploaded file exceeds the size limit' });
      }
      return res.status(400).json({ error: error.message });
    });
  };
};

module.exports = { createUploadMiddleware };
