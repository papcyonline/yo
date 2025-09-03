const winston = require('winston');
const path = require('path');
const fs = require('fs');

// Ensure logs directory exists
const logsDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Custom format for console output
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(({ timestamp, level, message, service, userId, ipAddress, ...meta }) => {
    let logMessage = `${timestamp} [${level}]`;
    
    if (service) {
      logMessage += ` [${service}]`;
    }
    
    if (userId) {
      logMessage += ` [User:${userId}]`;
    }
    
    if (ipAddress) {
      logMessage += ` [IP:${ipAddress}]`;
    }
    
    logMessage += `: ${message}`;
    
    // Add metadata if present
    const metaKeys = Object.keys(meta);
    if (metaKeys.length > 0) {
      const metaString = JSON.stringify(meta, null, 2);
      logMessage += `\n${metaString}`;
    }
    
    return logMessage;
  })
);

// Custom format for file output
const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  defaultMeta: {
    service: 'yo-family-api',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  },
  transports: [
    // Console transport
    new winston.transports.Console({
      format: consoleFormat,
      level: process.env.NODE_ENV === 'production' ? 'warn' : 'debug'
    }),

    // Combined log file (all logs)
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
      format: fileFormat,
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
      tailable: true
    }),

    // Error log file (errors only)
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      format: fileFormat,
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
      tailable: true
    }),

    // Security log file (security events)
    new winston.transports.File({
      filename: path.join(logsDir, 'security.log'),
      format: fileFormat,
      maxsize: 5 * 1024 * 1024, // 5MB
      maxFiles: 10,
      tailable: true,
      level: 'info'
    }),

    // Performance log file
    new winston.transports.File({
      filename: path.join(logsDir, 'performance.log'),
      format: fileFormat,
      maxsize: 5 * 1024 * 1024, // 5MB
      maxFiles: 3,
      tailable: true,
      level: 'info'
    })
  ],

  // Handle uncaught exceptions and rejections
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(logsDir, 'exceptions.log'),
      format: fileFormat
    })
  ],

  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(logsDir, 'rejections.log'),
      format: fileFormat
    })
  ]
});

// Create specialized loggers
const securityLogger = winston.createLogger({
  level: 'info',
  defaultMeta: {
    service: 'yo-family-security',
    logType: 'security'
  },
  transports: [
    new winston.transports.File({
      filename: path.join(logsDir, 'security.log'),
      format: fileFormat,
      maxsize: 5 * 1024 * 1024,
      maxFiles: 10
    })
  ]
});

const performanceLogger = winston.createLogger({
  level: 'info',
  defaultMeta: {
    service: 'yo-family-performance',
    logType: 'performance'
  },
  transports: [
    new winston.transports.File({
      filename: path.join(logsDir, 'performance.log'),
      format: fileFormat,
      maxsize: 5 * 1024 * 1024,
      maxFiles: 3
    })
  ]
});

// Helper functions for structured logging
const logWithContext = (level, message, context = {}) => {
  logger.log(level, message, context);
};

const logRequest = (req, res, responseTime) => {
  const logData = {
    method: req.method,
    url: req.originalUrl || req.url,
    userAgent: req.get('User-Agent'),
    ip: req.ip || req.connection.remoteAddress,
    userId: req.user?.id || req.userId,
    statusCode: res.statusCode,
    responseTime: `${responseTime}ms`,
    contentLength: res.get('Content-Length') || 0
  };

  if (res.statusCode >= 400) {
    logger.error('HTTP Request Error', logData);
  } else if (responseTime > 1000) {
    performanceLogger.warn('Slow Request', logData);
  } else {
    logger.info('HTTP Request', logData);
  }
};

const logSecurity = (event, details = {}, req = null) => {
  const logData = {
    event,
    timestamp: new Date().toISOString(),
    ...details
  };

  if (req) {
    logData.ip = req.ip || req.connection.remoteAddress;
    logData.userAgent = req.get('User-Agent');
    logData.userId = req.user?.id || req.userId;
  }

  securityLogger.warn(event, logData);
  
  // Also log to main logger for critical security events
  if (['failed_login_attempt', 'account_lockout', 'unauthorized_access'].includes(event)) {
    logger.warn(`Security Event: ${event}`, logData);
  }
};

const logAuth = (event, userId, details = {}, req = null) => {
  const logData = {
    event,
    userId,
    timestamp: new Date().toISOString(),
    ...details
  };

  if (req) {
    logData.ip = req.ip || req.connection.remoteAddress;
    logData.userAgent = req.get('User-Agent');
  }

  logger.info(`Auth Event: ${event}`, logData);
  securityLogger.info(event, logData);
};

const logError = (error, context = {}, req = null) => {
  const errorData = {
    message: error.message,
    stack: error.stack,
    name: error.name,
    ...context
  };

  if (req) {
    errorData.method = req.method;
    errorData.url = req.originalUrl || req.url;
    errorData.ip = req.ip || req.connection.remoteAddress;
    errorData.userId = req.user?.id || req.userId;
    errorData.userAgent = req.get('User-Agent');
    errorData.body = req.body;
    errorData.params = req.params;
    errorData.query = req.query;
  }

  logger.error('Application Error', errorData);
};

const logDatabase = (operation, collection, query = {}, result = {}, executionTime = 0) => {
  const logData = {
    operation,
    collection,
    query: JSON.stringify(query),
    resultCount: result.length || (result.modifiedCount !== undefined ? result.modifiedCount : 1),
    executionTime: `${executionTime}ms`
  };

  if (executionTime > 1000) {
    performanceLogger.warn('Slow Database Query', logData);
  } else {
    logger.debug('Database Operation', logData);
  }
};

const logAPIUsage = (endpoint, method, userId, responseTime, statusCode) => {
  const logData = {
    endpoint,
    method,
    userId,
    responseTime: `${responseTime}ms`,
    statusCode,
    timestamp: new Date().toISOString()
  };

  logger.info('API Usage', logData);
};

// Middleware for Express
const requestLogger = (req, res, next) => {
  const startTime = Date.now();
  
  // Log incoming request
  logger.debug('Incoming Request', {
    method: req.method,
    url: req.originalUrl || req.url,
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.get('User-Agent'),
    userId: req.user?.id || req.userId
  });

  // Override res.end to capture response details
  const originalEnd = res.end;
  res.end = function(...args) {
    const responseTime = Date.now() - startTime;
    logRequest(req, res, responseTime);
    originalEnd.apply(res, args);
  };

  next();
};

// Error handling middleware
const errorLogger = (error, req, res, next) => {
  logError(error, {}, req);
  next(error);
};

// Health check for logger
const healthCheck = () => {
  try {
    logger.info('Logger health check');
    return {
      status: 'healthy',
      transports: logger.transports.length,
      level: logger.level,
      logsDirectory: logsDir
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error.message
    };
  }
};

// Graceful shutdown
const gracefulShutdown = () => {
  logger.info('Shutting down logger...');
  logger.end();
  securityLogger.end();
  performanceLogger.end();
};

// Process event handlers
process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

module.exports = {
  logger,
  securityLogger,
  performanceLogger,
  logWithContext,
  logRequest,
  logSecurity,
  logAuth,
  logError,
  logDatabase,
  logAPIUsage,
  requestLogger,
  errorLogger,
  healthCheck,
  gracefulShutdown
};