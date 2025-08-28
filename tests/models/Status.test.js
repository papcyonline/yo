const mongoose = require('mongoose');
const Status = require('../../models/Status');
const User = require('../../models/User');

describe('Status Model Tests', () => {
  let testUser;
  let testUser2;

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
  });

  describe('Status Creation', () => {
    test('should create a text-only status successfully', async () => {
      const statusData = {
        user_id: testUser._id,
        content: {
          text: 'Hello, this is my first status!',
          type: 'text'
        },
        visibility: 'friends'
      };

      const status = new Status(statusData);
      const savedStatus = await status.save();

      expect(savedStatus).toBeDefined();
      expect(savedStatus.content.text).toBe('Hello, this is my first status!');
      expect(savedStatus.content.type).toBe('text');
      expect(savedStatus.visibility).toBe('friends');
      expect(savedStatus.user_id).toEqual(testUser._id);
      expect(savedStatus.engagement.likes).toHaveLength(0);
      expect(savedStatus.engagement.comments).toHaveLength(0);
      expect(savedStatus.engagement.views).toBe(0);
    });

    test('should create an image status successfully', async () => {
      const statusData = {
        user_id: testUser._id,
        content: {
          text: 'Check out this awesome photo!',
          type: 'text_with_image'
        },
        media: {
          image_url: 'https://example.com/image.jpg',
          thumbnail_url: 'https://example.com/thumbnail.jpg'
        },
        visibility: 'public'
      };

      const status = new Status(statusData);
      const savedStatus = await status.save();

      expect(savedStatus).toBeDefined();
      expect(savedStatus.content.type).toBe('text_with_image');
      expect(savedStatus.media.image_url).toBe('https://example.com/image.jpg');
      expect(savedStatus.media.thumbnail_url).toBe('https://example.com/thumbnail.jpg');
      expect(savedStatus.visibility).toBe('public');
    });

    test('should create status with location', async () => {
      const statusData = {
        user_id: testUser._id,
        content: {
          text: 'At the beautiful beach!',
          type: 'text'
        },
        location: {
          name: 'Miami Beach, FL',
          coordinates: {
            latitude: 25.7617,
            longitude: -80.1300
          }
        },
        visibility: 'friends'
      };

      const status = new Status(statusData);
      const savedStatus = await status.save();

      expect(savedStatus.location.name).toBe('Miami Beach, FL');
      expect(savedStatus.location.coordinates.latitude).toBe(25.7617);
      expect(savedStatus.location.coordinates.longitude).toBe(-80.1300);
    });

    test('should fail validation for missing required fields', async () => {
      const invalidStatusData = {
        content: {
          text: 'Missing user_id'
        }
      };

      const status = new Status(invalidStatusData);
      await expect(status.save()).rejects.toThrow();
    });

    test('should fail validation for text over 2000 characters', async () => {
      const longText = 'a'.repeat(2001);
      const statusData = {
        user_id: testUser._id,
        content: {
          text: longText,
          type: 'text'
        },
        visibility: 'friends'
      };

      const status = new Status(statusData);
      await expect(status.save()).rejects.toThrow();
    });
  });

  describe('Status Engagement', () => {
    let testStatus;

    beforeEach(async () => {
      testStatus = new Status({
        user_id: testUser._id,
        content: {
          text: 'Test status for engagement',
          type: 'text'
        },
        visibility: 'friends'
      });
      await testStatus.save();
    });

    test('should add like to status', async () => {
      await testStatus.addLike(testUser2._id);
      
      const updatedStatus = await Status.findById(testStatus._id);
      expect(updatedStatus.engagement.likes).toHaveLength(1);
      expect(updatedStatus.engagement.likes[0].user_id.toString()).toBe(testUser2._id.toString());
      expect(updatedStatus.likeCount).toBe(1);
    });

    test('should not allow duplicate likes from same user', async () => {
      await testStatus.addLike(testUser2._id);
      await testStatus.addLike(testUser2._id);
      
      const updatedStatus = await Status.findById(testStatus._id);
      expect(updatedStatus.engagement.likes).toHaveLength(1);
      expect(updatedStatus.likeCount).toBe(1);
    });

    test('should remove like from status', async () => {
      await testStatus.addLike(testUser2._id);
      await testStatus.removeLike(testUser2._id);
      
      const updatedStatus = await Status.findById(testStatus._id);
      expect(updatedStatus.engagement.likes).toHaveLength(0);
      expect(updatedStatus.likeCount).toBe(0);
    });

    test('should increment view count', async () => {
      await testStatus.incrementViews();
      await testStatus.incrementViews();
      
      const updatedStatus = await Status.findById(testStatus._id);
      expect(updatedStatus.engagement.views).toBe(2);
    });

    test('should add comment to status', async () => {
      await testStatus.addComment(testUser2._id, 'Great status!');
      
      const updatedStatus = await Status.findById(testStatus._id);
      expect(updatedStatus.engagement.comments).toHaveLength(1);
      expect(updatedStatus.engagement.comments[0].comment).toBe('Great status!');
      expect(updatedStatus.engagement.comments[0].user_id.toString()).toBe(testUser2._id.toString());
      expect(updatedStatus.commentCount).toBe(1);
    });
  });

  describe('Status Queries', () => {
    let publicStatus, friendsStatus, privateStatus;

    beforeEach(async () => {
      // Create statuses with different visibility levels
      publicStatus = new Status({
        user_id: testUser._id,
        content: { text: 'Public status', type: 'text' },
        visibility: 'public'
      });
      await publicStatus.save();

      friendsStatus = new Status({
        user_id: testUser._id,
        content: { text: 'Friends status', type: 'text' },
        visibility: 'friends'
      });
      await friendsStatus.save();

      privateStatus = new Status({
        user_id: testUser._id,
        content: { text: 'Private status', type: 'text' },
        visibility: 'private'
      });
      await privateStatus.save();
    });

    test('should find public statuses', async () => {
      const publicStatuses = await Status.findPublic();
      expect(publicStatuses).toHaveLength(1);
      expect(publicStatuses[0].content.text).toBe('Public status');
    });

    test('should find user statuses', async () => {
      const userStatuses = await Status.findByUser(testUser._id);
      expect(userStatuses).toHaveLength(3);
    });

    test('should find recent statuses', async () => {
      const recentStatuses = await Status.findRecent(10);
      expect(recentStatuses).toHaveLength(3);
      // Should be sorted by creation date (newest first)
      expect(recentStatuses[0].created_at.getTime()).toBeGreaterThanOrEqual(recentStatuses[1].created_at.getTime());
    });
  });

  describe('Status Expiration', () => {
    test('should create status with expiration', async () => {
      const expirationDate = new Date();
      expirationDate.setHours(expirationDate.getHours() + 24);

      const statusData = {
        user_id: testUser._id,
        content: { text: 'Expires in 24 hours', type: 'text' },
        visibility: 'friends',
        expires_at: expirationDate
      };

      const status = new Status(statusData);
      const savedStatus = await status.save();

      expect(savedStatus.expires_at).toEqual(expirationDate);
      expect(savedStatus.isExpired()).toBe(false);
    });

    test('should identify expired status', async () => {
      const pastDate = new Date();
      pastDate.setHours(pastDate.getHours() - 1);

      const statusData = {
        user_id: testUser._id,
        content: { text: 'Already expired', type: 'text' },
        visibility: 'friends',
        expires_at: pastDate
      };

      const status = new Status(statusData);
      const savedStatus = await status.save();

      expect(savedStatus.isExpired()).toBe(true);
    });
  });

  describe('Status Population', () => {
    test('should populate user data', async () => {
      const status = new Status({
        user_id: testUser._id,
        content: { text: 'Test population', type: 'text' },
        visibility: 'friends'
      });
      await status.save();

      const populatedStatus = await Status.findById(status._id).populate('user_id', 'first_name last_name profile_photo_url');
      
      expect(populatedStatus.user_id.first_name).toBe('John');
      expect(populatedStatus.user_id.last_name).toBe('Doe');
    });
  });
});