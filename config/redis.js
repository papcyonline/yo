const redis = require('redis');
const { logger } = require('./logger');

class RedisClient {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
  }

  async connect() {
    try {
      const redisConfig = {
        url: process.env.REDIS_URL || 'redis://localhost:6379',
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 3,
        lazyConnect: true,
        keepAlive: 30000,
        retryDelayOnClusterDown: 300,
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: null,
        retryDelayStep: 100,
        retryDelayMax: 2000,
        maxConnections: 5,
        minConnections: 1
      };

      this.client = redis.createClient(redisConfig);

      // Event handlers
      this.client.on('connect', () => {
        logger.info('Redis client connecting...');
      });

      this.client.on('ready', () => {
        logger.info('✅ Redis client connected and ready');
        this.isConnected = true;
        this.reconnectAttempts = 0;
      });

      this.client.on('error', (error) => {
        logger.error('❌ Redis connection error', { error: error.message });
        this.isConnected = false;
      });

      this.client.on('end', () => {
        logger.warn('⚠️ Redis connection ended');
        this.isConnected = false;
      });

      this.client.on('reconnecting', () => {
        this.reconnectAttempts++;
        logger.info(`🔄 Redis reconnecting... (attempt ${this.reconnectAttempts})`);
      });

      await this.client.connect();
      return true;

    } catch (error) {
      logger.error('Failed to connect to Redis', { error: error.message });
      return false;
    }
  }

  async disconnect() {
    try {
      if (this.client) {
        await this.client.quit();
        logger.info('Redis client disconnected');
      }
    } catch (error) {
      logger.error('Error disconnecting Redis', { error: error.message });
    }
  }

  // Basic Redis operations with error handling
  async get(key) {
    try {
      if (!this.isConnected) return null;
      const value = await this.client.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      logger.error('Redis GET error', { key, error: error.message });
      return null;
    }
  }

  async set(key, value, ttl = 3600) {
    try {
      if (!this.isConnected) return false;
      const stringValue = JSON.stringify(value);
      await this.client.setEx(key, ttl, stringValue);
      return true;
    } catch (error) {
      logger.error('Redis SET error', { key, error: error.message });
      return false;
    }
  }

  async del(key) {
    try {
      if (!this.isConnected) return false;
      await this.client.del(key);
      return true;
    } catch (error) {
      logger.error('Redis DEL error', { key, error: error.message });
      return false;
    }
  }

  async exists(key) {
    try {
      if (!this.isConnected) return false;
      const exists = await this.client.exists(key);
      return exists === 1;
    } catch (error) {
      logger.error('Redis EXISTS error', { key, error: error.message });
      return false;
    }
  }

  async expire(key, ttl) {
    try {
      if (!this.isConnected) return false;
      await this.client.expire(key, ttl);
      return true;
    } catch (error) {
      logger.error('Redis EXPIRE error', { key, ttl, error: error.message });
      return false;
    }
  }

  // Hash operations
  async hSet(key, field, value) {
    try {
      if (!this.isConnected) return false;
      await this.client.hSet(key, field, JSON.stringify(value));
      return true;
    } catch (error) {
      logger.error('Redis HSET error', { key, field, error: error.message });
      return false;
    }
  }

  async hGet(key, field) {
    try {
      if (!this.isConnected) return null;
      const value = await this.client.hGet(key, field);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      logger.error('Redis HGET error', { key, field, error: error.message });
      return null;
    }
  }

  async hGetAll(key) {
    try {
      if (!this.isConnected) return null;
      const hash = await this.client.hGetAll(key);
      const result = {};
      for (const [field, value] of Object.entries(hash)) {
        result[field] = JSON.parse(value);
      }
      return result;
    } catch (error) {
      logger.error('Redis HGETALL error', { key, error: error.message });
      return null;
    }
  }

  // List operations
  async lPush(key, ...values) {
    try {
      if (!this.isConnected) return false;
      const stringValues = values.map(v => JSON.stringify(v));
      await this.client.lPush(key, ...stringValues);
      return true;
    } catch (error) {
      logger.error('Redis LPUSH error', { key, error: error.message });
      return false;
    }
  }

  async rPop(key) {
    try {
      if (!this.isConnected) return null;
      const value = await this.client.rPop(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      logger.error('Redis RPOP error', { key, error: error.message });
      return null;
    }
  }

  // Set operations
  async sAdd(key, ...members) {
    try {
      if (!this.isConnected) return false;
      const stringMembers = members.map(m => JSON.stringify(m));
      await this.client.sAdd(key, ...stringMembers);
      return true;
    } catch (error) {
      logger.error('Redis SADD error', { key, error: error.message });
      return false;
    }
  }

  async sMembers(key) {
    try {
      if (!this.isConnected) return [];
      const members = await this.client.sMembers(key);
      return members.map(m => JSON.parse(m));
    } catch (error) {
      logger.error('Redis SMEMBERS error', { key, error: error.message });
      return [];
    }
  }

  // Cache patterns
  async cacheUserData(userId, userData, ttl = 1800) { // 30 minutes
    return await this.set(`user:${userId}`, userData, ttl);
  }

  async getUserFromCache(userId) {
    return await this.get(`user:${userId}`);
  }

  async cacheMatchResults(userId, matches, ttl = 3600) { // 1 hour
    return await this.set(`matches:${userId}`, matches, ttl);
  }

  async getMatchesFromCache(userId) {
    return await this.get(`matches:${userId}`);
  }

  async cacheApiResponse(endpoint, params, response, ttl = 300) { // 5 minutes
    const key = `api:${endpoint}:${JSON.stringify(params)}`;
    return await this.set(key, response, ttl);
  }

  async getApiResponseFromCache(endpoint, params) {
    const key = `api:${endpoint}:${JSON.stringify(params)}`;
    return await this.get(key);
  }

  // Session management
  async setUserSession(userId, sessionData, ttl = 86400) { // 24 hours
    return await this.set(`session:${userId}`, sessionData, ttl);
  }

  async getUserSession(userId) {
    return await this.get(`session:${userId}`);
  }

  async deleteUserSession(userId) {
    return await this.del(`session:${userId}`);
  }

  // Rate limiting
  async incrementRateLimit(key, ttl = 3600) {
    try {
      if (!this.isConnected) return { count: 0, ttl: 0 };
      
      const multi = this.client.multi();
      multi.incr(key);
      multi.expire(key, ttl);
      const results = await multi.exec();
      
      const count = results[0];
      return { count, ttl };
    } catch (error) {
      logger.error('Redis rate limit error', { key, error: error.message });
      return { count: 0, ttl: 0 };
    }
  }

  // Real-time features
  async setUserOnline(userId) {
    const key = 'online_users';
    const timestamp = Date.now();
    return await this.hSet(key, userId, timestamp);
  }

  async setUserOffline(userId) {
    try {
      if (!this.isConnected) return false;
      await this.client.hDel('online_users', userId);
      return true;
    } catch (error) {
      logger.error('Redis set user offline error', { userId, error: error.message });
      return false;
    }
  }

  async getOnlineUsers() {
    const onlineUsers = await this.hGetAll('online_users');
    const now = Date.now();
    const fiveMinutesAgo = now - 5 * 60 * 1000;

    // Filter out users who haven't been active in the last 5 minutes
    const activeUsers = {};
    for (const [userId, timestamp] of Object.entries(onlineUsers)) {
      if (timestamp > fiveMinutesAgo) {
        activeUsers[userId] = timestamp;
      } else {
        // Remove inactive user
        this.setUserOffline(userId);
      }
    }

    return activeUsers;
  }

  // Pub/Sub for real-time features
  async publish(channel, message) {
    try {
      if (!this.isConnected) return false;
      await this.client.publish(channel, JSON.stringify(message));
      return true;
    } catch (error) {
      logger.error('Redis publish error', { channel, error: error.message });
      return false;
    }
  }

  async subscribe(channel, callback) {
    try {
      if (!this.isConnected) return false;
      
      const subscriber = this.client.duplicate();
      await subscriber.connect();
      
      await subscriber.subscribe(channel, (message) => {
        try {
          const parsedMessage = JSON.parse(message);
          callback(parsedMessage);
        } catch (error) {
          logger.error('Redis message parse error', { message, error: error.message });
        }
      });
      
      return subscriber;
    } catch (error) {
      logger.error('Redis subscribe error', { channel, error: error.message });
      return false;
    }
  }

  // Health check
  async healthCheck() {
    try {
      if (!this.isConnected) {
        return { status: 'disconnected', connected: false };
      }
      
      const start = Date.now();
      await this.client.ping();
      const responseTime = Date.now() - start;
      
      return {
        status: 'connected',
        connected: true,
        responseTime: `${responseTime}ms`
      };
    } catch (error) {
      return {
        status: 'error',
        connected: false,
        error: error.message
      };
    }
  }

  // Statistics
  async getStats() {
    try {
      if (!this.isConnected) return null;
      
      const info = await this.client.info();
      const dbSize = await this.client.dbSize();
      
      return {
        connected: this.isConnected,
        dbSize,
        info: info.split('\n').reduce((acc, line) => {
          const [key, value] = line.split(':');
          if (key && value) {
            acc[key] = value.trim();
          }
          return acc;
        }, {})
      };
    } catch (error) {
      logger.error('Redis stats error', { error: error.message });
      return null;
    }
  }
}

// Create singleton instance
const redisClient = new RedisClient();

// Graceful shutdown
process.on('SIGINT', async () => {
  await redisClient.disconnect();
});

process.on('SIGTERM', async () => {
  await redisClient.disconnect();
});

module.exports = redisClient;