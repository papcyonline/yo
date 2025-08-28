const request = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const Status = require('../../models/Status');
const User = require('../../models/User');

// Mock the entire express app
const express = require('express');
const authMiddleware = require('../mocks/authMiddleware');
const statusRoutes = require('../mocks/statusRoutes');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Use mock auth middleware
app.use('/api/status', authMiddleware);
app.use('/api/status', statusRoutes);

describe('Status API Endpoints', () => {
  let testUser, testUser2;
  let userToken, user2Token;
  let testStatus;

  beforeEach(async () => {
    // Create test users
    testUser = new User({
      first_name: 'John',
      last_name: 'Doe',
      email: 'john@test.com',
      password_hash: 'password123',
      gender: 'male',
      date_of_birth: new Date('1990-01-01'),
      location: 'New York, NY'
    });
    await testUser.save();

    testUser2 = new User({
      first_name: 'Jane',
      last_name: 'Smith',
      email: 'jane@test.com',
      password_hash: 'password123',
      gender: 'female',
      date_of_birth: new Date('1992-05-15'),
      location: 'New York, NY'
    });
    await testUser2.save();

    // Create JWT tokens for testing
    userToken = jwt.sign(
      { userId: testUser._id.toString() },
      process.env.JWT_SECRET || 'test_secret',
      { expiresIn: '1h' }
    );

    user2Token = jwt.sign(
      { userId: testUser2._id.toString() },
      process.env.JWT_SECRET || 'test_secret',
      { expiresIn: '1h' }
    );

    // Create a test status
    testStatus = new Status({
      user_id: testUser._id,
      content: {
        text: 'Test status for API testing',
        type: 'text'
      },
      visibility: 'friends'
    });
    await testStatus.save();
  });

  describe('POST /api/status - Create Status', () => {
    test('should create a text-only status successfully', async () => {
      const statusData = {
        text: 'Hello, this is a new status!',
        visibility: 'friends'
      };

      const response = await request(app)
        .post('/api/status')
        .set('Authorization', `Bearer ${userToken}`)
        .send(statusData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.status).toBeDefined();
      expect(response.body.status.content.text).toBe('Hello, this is a new status!');
      expect(response.body.status.content.type).toBe('text');
      expect(response.body.status.visibility).toBe('friends');

      // Verify status was created in database
      const createdStatus = await Status.findById(response.body.status._id);
      expect(createdStatus).toBeTruthy();
    });

    test('should create status with location', async () => {
      const statusData = {
        text: 'At the coffee shop!',
        visibility: 'public',
        location_name: 'Starbucks Downtown',
        latitude: '40.7128',
        longitude: '-74.0060'
      };

      const response = await request(app)
        .post('/api/status')
        .set('Authorization', `Bearer ${userToken}`)
        .send(statusData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.status.location.name).toBe('Starbucks Downtown');
      expect(response.body.status.location.coordinates.latitude).toBe(40.7128);
      expect(response.body.status.location.coordinates.longitude).toBe(-74.0060);
    });

    test('should fail without authentication', async () => {
      const statusData = {
        text: 'This should fail',
        visibility: 'friends'
      };

      const response = await request(app)
        .post('/api/status')
        .send(statusData)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Access token required');
    });

    test('should fail with invalid token', async () => {
      const statusData = {
        text: 'This should fail',
        visibility: 'friends'
      };

      const response = await request(app)
        .post('/api/status')
        .set('Authorization', 'Bearer invalid_token')
        .send(statusData)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid token');
    });

    test('should fail with empty text and no image', async () => {
      const statusData = {
        text: '',
        visibility: 'friends'
      };

      const response = await request(app)
        .post('/api/status')
        .set('Authorization', `Bearer ${userToken}`)
        .send(statusData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('text or image');
    });

    test('should fail with invalid visibility', async () => {
      const statusData = {
        text: 'Test status',
        visibility: 'invalid_visibility'
      };

      const response = await request(app)
        .post('/api/status')
        .set('Authorization', `Bearer ${userToken}`)
        .send(statusData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/status/feed - Get Status Feed', () => {
    beforeEach(async () => {
      // Create multiple test statuses
      const statuses = [
        {
          user_id: testUser._id,
          content: { text: 'Public status 1', type: 'text' },
          visibility: 'public'
        },
        {
          user_id: testUser._id,
          content: { text: 'Friends status 1', type: 'text' },
          visibility: 'friends'
        },
        {
          user_id: testUser2._id,
          content: { text: 'Public status 2', type: 'text' },
          visibility: 'public'
        }
      ];

      await Status.insertMany(statuses);
    });

    test('should get status feed with default pagination', async () => {
      const response = await request(app)
        .get('/api/status/feed')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.statuses).toBeDefined();
      expect(Array.isArray(response.body.statuses)).toBe(true);
      expect(response.body.statuses.length).toBeGreaterThan(0);
      expect(response.body.pagination).toBeDefined();
    });

    test('should get status feed with custom pagination', async () => {
      const response = await request(app)
        .get('/api/status/feed?limit=2&offset=0')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.statuses).toHaveLength(2);
      expect(response.body.pagination.limit).toBe(2);
      expect(response.body.pagination.offset).toBe(0);
    });

    test('should fail without authentication', async () => {
      const response = await request(app)
        .get('/api/status/feed')
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    test('should return populated user data', async () => {
      const response = await request(app)
        .get('/api/status/feed')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.statuses[0].user_id).toBeDefined();
      expect(response.body.statuses[0].user_id.first_name).toBeDefined();
      expect(response.body.statuses[0].user_id.last_name).toBeDefined();
    });
  });

  describe('GET /api/status/my - Get My Statuses', () => {
    test('should get user\'s own statuses', async () => {
      const response = await request(app)
        .get('/api/status/my')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.statuses).toBeDefined();
      expect(Array.isArray(response.body.statuses)).toBe(true);
      
      // All statuses should belong to the authenticated user
      if (response.body.statuses.length > 0) {
        response.body.statuses.forEach(status => {
          expect(status.user_id._id || status.user_id).toBe(testUser._id.toString());
        });
      }
    });

    test('should fail without authentication', async () => {
      const response = await request(app)
        .get('/api/status/my')
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('DELETE /api/status/:id - Delete Status', () => {
    test('should delete own status successfully', async () => {
      const response = await request(app)
        .delete(`/api/status/${testStatus._id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('deleted');

      // Verify status was deleted from database
      const deletedStatus = await Status.findById(testStatus._id);
      expect(deletedStatus).toBeFalsy();
    });

    test('should fail to delete another user\'s status', async () => {
      const response = await request(app)
        .delete(`/api/status/${testStatus._id}`)
        .set('Authorization', `Bearer ${user2Token}`)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('authorized');

      // Verify status was not deleted
      const stillExists = await Status.findById(testStatus._id);
      expect(stillExists).toBeTruthy();
    });

    test('should fail with invalid status ID', async () => {
      const invalidId = new mongoose.Types.ObjectId();
      
      const response = await request(app)
        .delete(`/api/status/${invalidId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('not found');
    });

    test('should fail without authentication', async () => {
      const response = await request(app)
        .delete(`/api/status/${testStatus._id}`)
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/status/:id/like - Like Status', () => {
    test('should like status successfully', async () => {
      const response = await request(app)
        .post(`/api/status/${testStatus._id}/like`)
        .set('Authorization', `Bearer ${user2Token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('liked');

      // Verify like was added to database
      const updatedStatus = await Status.findById(testStatus._id);
      expect(updatedStatus.engagement.likes).toHaveLength(1);
      expect(updatedStatus.engagement.likes[0].user_id.toString()).toBe(testUser2._id.toString());
    });

    test('should not allow duplicate likes', async () => {
      // First like
      await request(app)
        .post(`/api/status/${testStatus._id}/like`)
        .set('Authorization', `Bearer ${user2Token}`)
        .expect(200);

      // Second like (should not add duplicate)
      const response = await request(app)
        .post(`/api/status/${testStatus._id}/like`)
        .set('Authorization', `Bearer ${user2Token}`)
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify only one like exists
      const updatedStatus = await Status.findById(testStatus._id);
      expect(updatedStatus.engagement.likes).toHaveLength(1);
    });

    test('should fail with invalid status ID', async () => {
      const invalidId = new mongoose.Types.ObjectId();
      
      const response = await request(app)
        .post(`/api/status/${invalidId}/like`)
        .set('Authorization', `Bearer ${user2Token}`)
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe('DELETE /api/status/:id/like - Unlike Status', () => {
    beforeEach(async () => {
      // Add a like first
      await testStatus.addLike(testUser2._id);
    });

    test('should unlike status successfully', async () => {
      const response = await request(app)
        .delete(`/api/status/${testStatus._id}/like`)
        .set('Authorization', `Bearer ${user2Token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('unliked');

      // Verify like was removed from database
      const updatedStatus = await Status.findById(testStatus._id);
      expect(updatedStatus.engagement.likes).toHaveLength(0);
    });

    test('should handle unliking when no like exists', async () => {
      // Unlike first
      await request(app)
        .delete(`/api/status/${testStatus._id}/like`)
        .set('Authorization', `Bearer ${user2Token}`)
        .expect(200);

      // Try to unlike again
      const response = await request(app)
        .delete(`/api/status/${testStatus._id}/like`)
        .set('Authorization', `Bearer ${user2Token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('POST /api/status/:id/view - View Status', () => {
    test('should increment view count successfully', async () => {
      const response = await request(app)
        .post(`/api/status/${testStatus._id}/view`)
        .set('Authorization', `Bearer ${user2Token}`)
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify view count was incremented
      const updatedStatus = await Status.findById(testStatus._id);
      expect(updatedStatus.engagement.views).toBe(1);
    });

    test('should increment view count multiple times', async () => {
      // First view
      await request(app)
        .post(`/api/status/${testStatus._id}/view`)
        .set('Authorization', `Bearer ${user2Token}`)
        .expect(200);

      // Second view
      await request(app)
        .post(`/api/status/${testStatus._id}/view`)
        .set('Authorization', `Bearer ${user2Token}`)
        .expect(200);

      // Verify view count
      const updatedStatus = await Status.findById(testStatus._id);
      expect(updatedStatus.engagement.views).toBe(2);
    });
  });

  describe('Error Handling', () => {
    test('should handle server errors gracefully', async () => {
      // Mock a database error
      const originalFind = Status.find;
      Status.find = jest.fn().mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/status/feed')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('error');

      // Restore original method
      Status.find = originalFind;
    });
  });
});