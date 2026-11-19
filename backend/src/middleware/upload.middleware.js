const multer = require('multer');
const path = require('path');
const fs = require('fs');
const config = require('../config/environment');
const { validateFileType } = require('../utils/file-validation');

// Ensure upload directory exists
const uploadDir = path.resolve(config.upload.dir || './uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Generate safe unique filename
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const sanitized = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, `${uniqueSuffix}-${sanitized}`);
  },
});

const fileFilter = (req, file, cb) => {
  const validation = validateFileType(file.originalname, file.mimetype);
  if (!validation.valid) {
    const error = new Error(validation.error);
    error.statusCode = 400;
    return cb(error, false);
  }
  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: config.upload.maxSizeMb * 1024 * 1024, // in bytes
  },
});

module.exports = upload;
