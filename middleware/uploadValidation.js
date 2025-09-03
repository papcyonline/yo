const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const { logger } = require('../config/logger');

// Ensure uploads directory exists
const ensureUploadDir = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

// File type configurations
const fileTypeConfigs = {
  image: {
    allowedExtensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
    allowedMimeTypes: [
      'image/jpeg',
      'image/png', 
      'image/gif',
      'image/webp'
    ],
    maxSize: 10 * 1024 * 1024, // 10MB
    destination: 'uploads/images'
  },
  avatar: {
    allowedExtensions: ['.jpg', '.jpeg', '.png', '.webp'],
    allowedMimeTypes: [
      'image/jpeg',
      'image/png',
      'image/webp'
    ],
    maxSize: 5 * 1024 * 1024, // 5MB
    destination: 'uploads/avatars'
  },
  cover_photo: {
    allowedExtensions: ['.jpg', '.jpeg', '.png', '.webp'],
    allowedMimeTypes: [
      'image/jpeg',
      'image/png',
      'image/webp'
    ],
    maxSize: 10 * 1024 * 1024, // 10MB
    destination: 'uploads/covers'
  },
  document: {
    allowedExtensions: ['.pdf', '.doc', '.docx', '.txt'],
    allowedMimeTypes: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain'
    ],
    maxSize: 25 * 1024 * 1024, // 25MB
    destination: 'uploads/documents'
  },
  voice: {
    allowedExtensions: ['.mp3', '.wav', '.m4a', '.ogg'],
    allowedMimeTypes: [
      'audio/mpeg',
      'audio/wav',
      'audio/mp4',
      'audio/ogg'
    ],
    maxSize: 15 * 1024 * 1024, // 15MB
    destination: 'uploads/voice'
  },
  video: {
    allowedExtensions: ['.mp4', '.mov', '.avi', '.webm'],
    allowedMimeTypes: [
      'video/mp4',
      'video/quicktime',
      'video/x-msvideo',
      'video/webm'
    ],
    maxSize: 100 * 1024 * 1024, // 100MB
    destination: 'uploads/videos'
  }
};

// Security checks
const securityChecks = {
  // Check file signature (magic numbers) to verify actual file type
  verifyFileSignature: (buffer, mimeType) => {
    const signatures = {
      'image/jpeg': [0xFF, 0xD8, 0xFF],
      'image/png': [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A],
      'image/gif': [0x47, 0x49, 0x46, 0x38],
      'image/webp': [0x52, 0x49, 0x46, 0x46], // First 4 bytes of WEBP
      'application/pdf': [0x25, 0x50, 0x44, 0x46],
      'audio/mpeg': [0xFF, 0xFB], // MP3
      'video/mp4': [0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70] // MP4
    };

    const signature = signatures[mimeType];
    if (!signature) return true; // Skip check if signature not defined

    for (let i = 0; i < signature.length; i++) {
      if (buffer[i] !== signature[i]) {
        return false;
      }
    }
    return true;
  },

  // Check for potentially dangerous content
  scanForMalicious: (filename, buffer) => {
    const maliciousPatterns = [
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      /javascript:/gi,
      /vbscript:/gi,
      /onload\s*=/gi,
      /onerror\s*=/gi
    ];

    const fileContent = buffer.toString('utf8', 0, Math.min(buffer.length, 1024));
    
    for (const pattern of maliciousPatterns) {
      if (pattern.test(fileContent)) {
        return false;
      }
    }

    return true;
  },

  // Check filename for dangerous characters
  validateFilename: (filename) => {
    const dangerousChars = /[<>:"/\\|?*\x00-\x1f]/g;
    const reservedNames = ['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9', 'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'];
    
    if (dangerousChars.test(filename)) {
      return false;
    }

    const nameWithoutExt = path.parse(filename).name.toUpperCase();
    if (reservedNames.includes(nameWithoutExt)) {
      return false;
    }

    return true;
  }
};

// Generate secure filename
const generateSecureFilename = (originalName) => {
  const ext = path.extname(originalName).toLowerCase();
  const timestamp = Date.now();
  const randomBytes = crypto.randomBytes(16).toString('hex');
  return `${timestamp}_${randomBytes}${ext}`;
};

// Create multer storage configuration
const createStorage = (fileType) => {
  const config = fileTypeConfigs[fileType];
  
  return multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadPath = path.join(__dirname, '..', config.destination);
      ensureUploadDir(uploadPath);
      cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
      const secureFilename = generateSecureFilename(file.originalname);
      cb(null, secureFilename);
    }
  });
};

// File filter function
const createFileFilter = (fileType) => {
  const config = fileTypeConfigs[fileType];
  
  return (req, file, cb) => {
    try {
      // Check filename security
      if (!securityChecks.validateFilename(file.originalname)) {
        logger.warn('Dangerous filename detected', {
          filename: file.originalname,
          ip: req.ip,
          userId: req.user?.id
        });
        return cb(new Error('Invalid filename'), false);
      }

      // Check file extension
      const fileExt = path.extname(file.originalname).toLowerCase();
      if (!config.allowedExtensions.includes(fileExt)) {
        return cb(new Error(`File type ${fileExt} not allowed. Allowed types: ${config.allowedExtensions.join(', ')}`), false);
      }

      // Check MIME type
      if (!config.allowedMimeTypes.includes(file.mimetype)) {
        return cb(new Error(`MIME type ${file.mimetype} not allowed`), false);
      }

      cb(null, true);
    } catch (error) {
      logger.error('File filter error', { error: error.message, file: file.originalname });
      cb(error, false);
    }
  };
};

// Post-upload validation
const postUploadValidation = (fileType) => {
  return async (req, res, next) => {
    if (!req.file && !req.files) {
      return next();
    }

    const files = req.files ? req.files : [req.file];
    const config = fileTypeConfigs[fileType];

    try {
      for (const file of files) {
        // Read file buffer for security checks
        const filePath = file.path;
        const buffer = fs.readFileSync(filePath);

        // Verify file signature
        if (!securityChecks.verifyFileSignature(buffer, file.mimetype)) {
          fs.unlinkSync(filePath); // Delete malicious file
          logger.warn('File signature mismatch', {
            originalName: file.originalname,
            mimeType: file.mimetype,
            ip: req.ip,
            userId: req.user?.id
          });
          return res.status(400).json({
            success: false,
            message: 'File type validation failed'
          });
        }

        // Scan for malicious content
        if (!securityChecks.scanForMalicious(file.originalname, buffer)) {
          fs.unlinkSync(filePath); // Delete malicious file
          logger.warn('Malicious content detected', {
            originalName: file.originalname,
            ip: req.ip,
            userId: req.user?.id
          });
          return res.status(400).json({
            success: false,
            message: 'File contains potentially dangerous content'
          });
        }

        // Additional size check (multer should handle this, but double-check)
        if (file.size > config.maxSize) {
          fs.unlinkSync(filePath);
          return res.status(400).json({
            success: false,
            message: `File size exceeds maximum limit of ${config.maxSize / (1024 * 1024)}MB`
          });
        }

        // Log successful upload
        logger.info('File uploaded successfully', {
          originalName: file.originalname,
          filename: file.filename,
          size: file.size,
          mimeType: file.mimetype,
          fileType: fileType,
          userId: req.user?.id,
          ip: req.ip
        });
      }

      next();
    } catch (error) {
      logger.error('Post-upload validation error', { error: error.message });
      
      // Clean up files on error
      files.forEach(file => {
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      });

      res.status(500).json({
        success: false,
        message: 'File validation failed'
      });
    }
  };
};

// Create upload middleware for different file types
const createUploadMiddleware = (fileType, fieldName = 'file', multiple = false) => {
  const config = fileTypeConfigs[fileType];
  
  if (!config) {
    throw new Error(`Unsupported file type: ${fileType}`);
  }

  const upload = multer({
    storage: createStorage(fileType),
    fileFilter: createFileFilter(fileType),
    limits: {
      fileSize: config.maxSize,
      files: multiple ? 10 : 1
    }
  });

  const uploadMiddleware = multiple ? upload.array(fieldName, 10) : upload.single(fieldName);
  const validationMiddleware = postUploadValidation(fileType);

  return [uploadMiddleware, validationMiddleware];
};

// Predefined upload middlewares
const uploadMiddlewares = {
  image: createUploadMiddleware('image'),
  images: createUploadMiddleware('image', 'images', true),
  avatar: createUploadMiddleware('avatar', 'avatar'),
  coverPhoto: createUploadMiddleware('cover_photo', 'cover_photo'),
  document: createUploadMiddleware('document'),
  documents: createUploadMiddleware('document', 'documents', true),
  voice: createUploadMiddleware('voice', 'voice'),
  video: createUploadMiddleware('video', 'video')
};

// Cleanup old files (run periodically)
const cleanupOldFiles = (maxAge = 7 * 24 * 60 * 60 * 1000) => { // 7 days by default
  Object.values(fileTypeConfigs).forEach(config => {
    const uploadDir = path.join(__dirname, '..', config.destination);
    
    if (!fs.existsSync(uploadDir)) return;

    fs.readdir(uploadDir, (err, files) => {
      if (err) {
        logger.error('Error reading upload directory', { directory: uploadDir, error: err.message });
        return;
      }

      files.forEach(file => {
        const filePath = path.join(uploadDir, file);
        
        fs.stat(filePath, (err, stats) => {
          if (err) return;

          const now = Date.now();
          const fileAge = now - stats.mtime.getTime();

          if (fileAge > maxAge) {
            fs.unlink(filePath, (err) => {
              if (!err) {
                logger.info('Cleaned up old file', { file: filePath, age: fileAge });
              }
            });
          }
        });
      });
    });
  });
};

// Error handler specifically for multer errors
const handleUploadError = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    let message = 'File upload error';
    let statusCode = 400;

    switch (error.code) {
      case 'LIMIT_FILE_SIZE':
        message = 'File too large';
        break;
      case 'LIMIT_FILE_COUNT':
        message = 'Too many files';
        break;
      case 'LIMIT_UNEXPECTED_FILE':
        message = 'Unexpected file field';
        break;
      case 'LIMIT_FIELD_KEY':
        message = 'Field name too long';
        break;
      case 'LIMIT_FIELD_VALUE':
        message = 'Field value too long';
        break;
      case 'LIMIT_FIELD_COUNT':
        message = 'Too many fields';
        break;
    }

    logger.warn('Multer upload error', {
      code: error.code,
      message: error.message,
      ip: req.ip,
      userId: req.user?.id
    });

    return res.status(statusCode).json({
      success: false,
      message: message,
      error: error.message
    });
  }

  next(error);
};

// Schedule cleanup to run daily
setInterval(cleanupOldFiles, 24 * 60 * 60 * 1000);

module.exports = {
  uploadMiddlewares,
  createUploadMiddleware,
  fileTypeConfigs,
  handleUploadError,
  cleanupOldFiles,
  securityChecks
};