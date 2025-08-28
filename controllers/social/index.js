const { supabase } = require('../../config/database');

/**
 * Get Social Connections - Retrieve user's connected social accounts
 */
const getSocialConnections = async (req, res) => {
  try {
    const userId = req.user.id;

    const { data: connections, error } = await supabase
      .from('social_connections')
      .select('*')
      .eq('user_id', userId);

    if (error) {
      console.error('Social connections fetch error:', error);
      return res.status(400).json({
        success: false,
        error: 'Failed to fetch social connections'
      });
    }

    // Format response to hide sensitive data
    const formattedConnections = connections.map(conn => ({
      platform: conn.platform,
      connected: true,
      username: conn.username,
      connected_at: conn.connected_at,
      status: conn.status,
      permissions: conn.permissions || []
    }));

    res.json({
      success: true,
      data: {
        connections: formattedConnections,
        availablePlatforms: ['facebook', 'tiktok', 'instagram', 'twitter'],
        syncStatus: {
          lastSync: connections.length > 0 ? 
            Math.max(...connections.map(c => new Date(c.last_sync || c.connected_at).getTime())) : null,
          nextSync: null // Will be calculated based on platform policies
        }
      }
    });

  } catch (error) {
    console.error('Get social connections error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error fetching social connections'
    });
  }
};

/**
 * Connect Facebook - Initiate Facebook connection
 */
const connectFacebook = async (req, res) => {
  try {
    const userId = req.user.id;
    const { accessToken, permissions = [] } = req.body;

    if (!accessToken) {
      return res.status(400).json({
        success: false,
        error: 'Facebook access token is required'
      });
    }

    // Mock Facebook API call - TODO: Replace with actual Facebook SDK
    const mockFacebookProfile = {
      id: 'fb_' + Date.now(),
      username: 'john.doe',
      email: 'john.doe@facebook.com',
      name: 'John Doe',
      profile_pic: 'https://facebook.com/profile/pic.jpg'
    };

    // Store Facebook connection
    const { data: connection, error } = await supabase
      .from('social_connections')
      .upsert({
        user_id: userId,
        platform: 'facebook',
        platform_user_id: mockFacebookProfile.id,
        username: mockFacebookProfile.username,
        email: mockFacebookProfile.email,
        display_name: mockFacebookProfile.name,
        profile_data: mockFacebookProfile,
        permissions: permissions,
        status: 'active',
        connected_at: new Date().toISOString(),
        last_sync: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Facebook connection error:', error);
      return res.status(400).json({
        success: false,
        error: 'Failed to connect Facebook account'
      });
    }

    res.json({
      success: true,
      data: {
        platform: 'facebook',
        connected: true,
        username: mockFacebookProfile.username,
        displayName: mockFacebookProfile.name,
        permissions: permissions,
        message: 'Facebook account connected successfully'
      }
    });

  } catch (error) {
    console.error('Facebook connection error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error connecting Facebook'
    });
  }
};

/**
 * Connect TikTok - Initiate TikTok connection
 */
const connectTikTok = async (req, res) => {
  try {
    const userId = req.user.id;
    const { accessToken, permissions = [] } = req.body;

    if (!accessToken) {
      return res.status(400).json({
        success: false,
        error: 'TikTok access token is required'
      });
    }

    // Mock TikTok API call - TODO: Replace with actual TikTok API
    const mockTikTokProfile = {
      id: 'tt_' + Date.now(),
      username: 'johndoe',
      display_name: 'John Doe',
      avatar_url: 'https://tiktok.com/avatar.jpg',
      follower_count: 1250,
      following_count: 890
    };

    // Store TikTok connection
    const { data: connection, error } = await supabase
      .from('social_connections')
      .upsert({
        user_id: userId,
        platform: 'tiktok',
        platform_user_id: mockTikTokProfile.id,
        username: mockTikTokProfile.username,
        display_name: mockTikTokProfile.display_name,
        profile_data: mockTikTokProfile,
        permissions: permissions,
        status: 'active',
        connected_at: new Date().toISOString(),
        last_sync: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('TikTok connection error:', error);
      return res.status(400).json({
        success: false,
        error: 'Failed to connect TikTok account'
      });
    }

    res.json({
      success: true,
      data: {
        platform: 'tiktok',
        connected: true,
        username: mockTikTokProfile.username,
        displayName: mockTikTokProfile.display_name,
        permissions: permissions,
        message: 'TikTok account connected successfully'
      }
    });

  } catch (error) {
    console.error('TikTok connection error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error connecting TikTok'
    });
  }
};

/**
 * Sync Social Data - Synchronize data from connected social platforms
 */
const syncSocialData = async (req, res) => {
  try {
    const userId = req.user.id;
    const { platforms = [], forceSync = false } = req.body;

    // Get user's connected platforms
    const { data: connections, error } = await supabase
      .from('social_connections')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active');

    if (error) {
      console.error('Social connections fetch error:', error);
      return res.status(400).json({
        success: false,
        error: 'Failed to fetch social connections'
      });
    }

    if (connections.length === 0) {
      return res.json({
        success: true,
        data: {
          syncResults: [],
          message: 'No connected social accounts to sync'
        }
      });
    }

    const syncResults = [];

    for (const connection of connections) {
      // Skip if specific platforms requested and this isn't one of them
      if (platforms.length > 0 && !platforms.includes(connection.platform)) {
        continue;
      }

      // Check if sync is needed (don't sync more than once per hour unless forced)
      const lastSync = new Date(connection.last_sync);
      const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
      
      if (!forceSync && lastSync > hourAgo) {
        syncResults.push({
          platform: connection.platform,
          status: 'skipped',
          message: 'Recent sync found, skipping',
          lastSync: connection.last_sync
        });
        continue;
      }

      // Mock sync process - TODO: Replace with actual social API calls
      const syncedData = {
        contacts: Math.floor(Math.random() * 50) + 10,
        mutualConnections: Math.floor(Math.random() * 20),
        interests: ['technology', 'family', 'travel'],
        locations: ['New York', 'Boston']
      };

      // Update sync timestamp
      await supabase
        .from('social_connections')
        .update({
          last_sync: new Date().toISOString(),
          sync_data: syncedData
        })
        .eq('id', connection.id);

      syncResults.push({
        platform: connection.platform,
        status: 'success',
        data: syncedData,
        message: `Synced ${syncedData.contacts} contacts and ${syncedData.mutualConnections} mutual connections`
      });
    }

    res.json({
      success: true,
      data: {
        syncResults,
        nextSyncAvailable: new Date(Date.now() + 60 * 60 * 1000).toISOString()
      }
    });

  } catch (error) {
    console.error('Social sync error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error during social sync'
    });
  }
};

/**
 * Disconnect Social Platform
 */
const disconnectPlatform = async (req, res) => {
  try {
    const userId = req.user.id;
    const { platform } = req.params;

    const { data: connection, error } = await supabase
      .from('social_connections')
      .update({ status: 'disconnected', disconnected_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('platform', platform)
      .select()
      .single();

    if (error) {
      console.error('Social disconnect error:', error);
      return res.status(400).json({
        success: false,
        error: 'Failed to disconnect social platform'
      });
    }

    res.json({
      success: true,
      data: {
        platform,
        disconnected: true,
        message: `${platform} account disconnected successfully`
      }
    });

  } catch (error) {
    console.error('Social disconnect error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error disconnecting social platform'
    });
  }
};

module.exports = {
  getSocialConnections,
  connectFacebook,
  connectTikTok,
  syncSocialData,
  disconnectPlatform
};