const path = require('path');

// Supported MIME types and extensions according to ARCHITECTURE.md & PRD.md
const SUPPORTED_MIME_TYPES = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/msword': 'docx',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'application/vnd.ms-powerpoint': 'pptx',
  'text/plain': 'txt',
};

const SUPPORTED_EXTENSIONS = ['.pdf', '.docx', '.pptx', '.txt'];

const DANGEROUS_MIMES = [
  'application/x-msdownload',
  'application/x-executable',
  'application/x-sh',
  'application/x-php',
  'application/javascript',
  'text/javascript',
  'text/html',
];

/**
 * Validate file extension and MIME type
 * @param {string} originalname
 * @param {string} mimetype
 * @returns {{ valid: boolean, fileType: string, error?: string }}
 */
function validateFileType(originalname, mimetype) {
  const ext = path.extname(originalname || '').toLowerCase();

  if (!SUPPORTED_EXTENSIONS.includes(ext)) {
    return {
      valid: false,
      error: `Unsupported file extension "${ext}". Supported formats are: ${SUPPORTED_EXTENSIONS.join(', ')}`,
    };
  }

  // Reject explicitly dangerous MIME types spoofing allowed extensions
  if (mimetype && DANGEROUS_MIMES.includes(mimetype.toLowerCase())) {
    return {
      valid: false,
      error: `File MIME type "${mimetype}" is forbidden for security reasons.`,
    };
  }

  // Check matching MIME type or extension fallback
  let fileType = ext.replace('.', '');
  if (fileType === 'doc') fileType = 'docx';
  if (fileType === 'ppt') fileType = 'pptx';

  return {
    valid: true,
    fileType,
  };
}

module.exports = {
  SUPPORTED_MIME_TYPES,
  SUPPORTED_EXTENSIONS,
  validateFileType,
};
