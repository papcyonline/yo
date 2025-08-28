const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');
const path = require('path');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

// Create storage configurations for different file types
const createCloudinaryStorage = (folder, allowedFormats) => {
  return new CloudinaryStorage({
    cloudinary: cloudinary,
    params: async (req, file) => {
      // Generate unique filename
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const fileExtension = path.extname(file.originalname).substring(1);
      
      return {
        folder: `yofam/${folder}`,
        format: fileExtension,
        public_id: `${file.fieldname}-${uniqueSuffix}`,
        resource_type: 'auto', // Automatically detect resource type
        transformation: folder === 'profile-photos' ? [
          { width: 500, height: 500, crop: 'limit' },
          { quality: 'auto:good' }
        ] : undefined
      };
    }
  });
};

// Profile photo upload configuration
const profilePhotoStorage = createCloudinaryStorage('profile-photos', ['jpg', 'jpeg', 'png', 'gif']);
const profilePhotoUpload = multer({
  storage: profilePhotoStorage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit for profile photos
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG and GIF are allowed'), false);
    }
  }
});

// Chat media upload configuration (images, videos, documents)
const chatMediaStorage = createCloudinaryStorage('chat-media', ['jpg', 'jpeg', 'png', 'gif', 'mp4', 'mov', 'avi', 'pdf', 'doc', 'docx']);
const chatMediaUpload = multer({
  storage: chatMediaStorage,
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB limit for chat media
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'image/jpeg', 'image/jpg', 'image/png', 'image/gif',
      'video/mp4', 'video/quicktime', 'video/x-msvideo',
      'application/pdf', 'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      // Add audio support for voice messages
      'audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/m4a', 'audio/x-m4a', 'audio/ogg'
    ];
    console.log('🎤 CLOUDINARY: File filter checking:', file.mimetype);
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type: ${file.mimetype}`), false);
    }
  }
});

// Community post media upload
const communityMediaStorage = createCloudinaryStorage('community-posts', ['jpg', 'jpeg', 'png', 'gif', 'mp4']);
const communityMediaUpload = multer({
  storage: communityMediaStorage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit for community posts
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'image/jpeg', 'image/jpg', 'image/png', 'image/gif',
      'video/mp4'
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'), false);
    }
  }
});

// Voice message upload
const voiceMessageStorage = createCloudinaryStorage('voice-messages', ['mp3', 'wav', 'm4a', 'ogg']);
const voiceMessageUpload = multer({
  storage: voiceMessageStorage,
  limits: {
    fileSize: 20 * 1024 * 1024 // 20MB limit for voice messages
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/m4a', 'audio/x-m4a', 'audio/ogg'
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid audio format'), false);
    }
  }
});

// Helper functions for Cloudinary operations

// Delete file from Cloudinary
const deleteFromCloudinary = async (publicId, resourceType = 'image') => {
  try {
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType
    });
    return result;
  } catch (error) {
    console.error('Error deleting from Cloudinary:', error);
    throw error;
  }
};

// Get optimized URL for an image
const getOptimizedImageUrl = (publicId, options = {}) => {
  const defaultOptions = {
    quality: 'auto',
    fetch_format: 'auto',
    width: options.width || 800,
    crop: options.crop || 'limit'
  };
  
  return cloudinary.url(publicId, defaultOptions);
};

// Upload base64 image directly
const uploadBase64Image = async (base64String, folder = 'misc') => {
  try {
    const result = await cloudinary.uploader.upload(base64String, {
      folder: `yofam/${folder}`,
      resource_type: 'auto'
    });
    return {
      url: result.secure_url,
      publicId: result.public_id,
      format: result.format,
      width: result.width,
      height: result.height,
      size: result.bytes
    };
  } catch (error) {
    console.error('Error uploading base64 image:', error);
    throw error;
  }
};

// Upload from URL
const uploadFromUrl = async (imageUrl, folder = 'misc') => {
  try {
    const result = await cloudinary.uploader.upload(imageUrl, {
      folder: `yofam/${folder}`,
      resource_type: 'auto'
    });
    return {
      url: result.secure_url,
      publicId: result.public_id,
      format: result.format,
      width: result.width,
      height: result.height,
      size: result.bytes
    };
  } catch (error) {
    console.error('Error uploading from URL:', error);
    throw error;
  }
};

// Generate thumbnail for video
const generateVideoThumbnail = (publicId) => {
  return cloudinary.url(publicId, {
    resource_type: 'video',
    transformation: [
      { width: 300, height: 300, crop: 'fill' },
      { format: 'jpg' }
    ]
  });
};

module.exports = {
  cloudinary,
  profilePhotoUpload,
  chatMediaUpload,
  communityMediaUpload,
  voiceMessageUpload,
  deleteFromCloudinary,
  getOptimizedImageUrl,
  uploadBase64Image,
  uploadFromUrl,
  generateVideoThumbnail
};