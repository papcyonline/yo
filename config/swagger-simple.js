const swaggerUi = require('swagger-ui-express');

// Simple Swagger documentation without swagger-jsdoc auto-parsing
const swaggerDocument = {
  openapi: '3.0.0',
  info: {
    title: 'Yo! Family API Documentation',
    version: '1.0.0',
    description: 'AI-powered family and social matching app backend with 120+ API endpoints',
    contact: {
      name: 'Yo! Family Team',
      email: 'support@yofamapp.com'
    },
    license: {
      name: 'ISC'
    }
  },
  servers: [
    {
      url: 'http://localhost:9002',
      description: 'Development server'
    },
    {
      url: 'https://yo-3xay.onrender.com',
      description: 'Production server'
    }
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT token obtained from login endpoint'
      }
    },
    schemas: {
      User: {
        type: 'object',
        properties: {
          _id: {
            type: 'string',
            description: 'User ID',
            example: '507f1f77bcf86cd799439011'
          },
          email: {
            type: 'string',
            format: 'email',
            example: 'user@example.com'
          },
          first_name: {
            type: 'string',
            example: 'John'
          },
          last_name: {
            type: 'string',
            example: 'Doe'
          },
          profile_picture_url: {
            type: 'string',
            format: 'url'
          }
        }
      },
      LoginRequest: {
        type: 'object',
        required: ['password'],
        properties: {
          email: {
            type: 'string',
            format: 'email',
            description: 'User email (required if phone not provided)'
          },
          phone: {
            type: 'string',
            description: 'User phone (required if email not provided)'
          },
          password: {
            type: 'string',
            minLength: 8
          }
        }
      },
      AuthResponse: {
        type: 'object',
        properties: {
          success: {
            type: 'boolean'
          },
          message: {
            type: 'string'
          },
          data: {
            type: 'object',
            properties: {
              token: {
                type: 'string',
                description: 'JWT access token'
              },
              access_token: {
                type: 'string'
              },
              refresh_token: {
                type: 'string'
              },
              expires_in: {
                type: 'number'
              },
              user: {
                $ref: '#/components/schemas/User'
              }
            }
          }
        }
      },
      ApiResponse: {
        type: 'object',
        properties: {
          success: {
            type: 'boolean'
          },
          message: {
            type: 'string'
          },
          data: {
            type: 'object'
          }
        }
      },
      ValidationError: {
        type: 'object',
        properties: {
          success: {
            type: 'boolean',
            example: false
          },
          message: {
            type: 'string',
            example: 'Validation failed'
          },
          errors: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                field: {
                  type: 'string'
                },
                message: {
                  type: 'string'
                }
              }
            }
          }
        }
      }
    }
  },
  security: [
    {
      bearerAuth: []
    }
  ],
  paths: {
    '/health': {
      get: {
        tags: ['System'],
        summary: 'Health check endpoint',
        description: 'Returns server health status and basic information',
        responses: {
          '200': {
            description: 'Server is healthy',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: {
                      type: 'string',
                      example: 'OK'
                    },
                    timestamp: {
                      type: 'string',
                      format: 'date-time'
                    },
                    uptime: {
                      type: 'number',
                      description: 'Server uptime in seconds'
                    },
                    version: {
                      type: 'string',
                      example: '1.0.0'
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/api/auth/login': {
      post: {
        tags: ['Authentication'],
        summary: 'User login',
        description: 'Authenticate user with email/phone and password',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/LoginRequest'
              },
              examples: {
                emailLogin: {
                  summary: 'Login with email',
                  value: {
                    email: 'user@example.com',
                    password: 'securePassword123'
                  }
                },
                phoneLogin: {
                  summary: 'Login with phone',
                  value: {
                    phone: '+1234567890',
                    password: 'securePassword123'
                  }
                }
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Login successful',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/AuthResponse'
                }
              }
            }
          },
          '401': {
            description: 'Invalid credentials',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: false
                    },
                    message: {
                      type: 'string',
                      example: 'Invalid credentials'
                    }
                  }
                }
              }
            }
          },
          '400': {
            description: 'Validation error',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ValidationError'
                }
              }
            }
          }
        }
      }
    },
    '/api/auth/refresh': {
      post: {
        tags: ['Authentication'],
        summary: 'Refresh access token',
        description: 'Get a new access token using a valid refresh token',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['refresh_token'],
                properties: {
                  refresh_token: {
                    type: 'string',
                    description: 'Valid refresh token'
                  }
                }
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Token refreshed successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean'
                    },
                    message: {
                      type: 'string'
                    },
                    data: {
                      type: 'object',
                      properties: {
                        access_token: {
                          type: 'string'
                        },
                        token_type: {
                          type: 'string',
                          example: 'Bearer'
                        },
                        expires_in: {
                          type: 'number',
                          example: 900
                        }
                      }
                    }
                  }
                }
              }
            }
          },
          '401': {
            description: 'Invalid or expired refresh token'
          }
        }
      }
    },
    '/api/auth/logout': {
      post: {
        tags: ['Authentication'],
        summary: 'Logout user',
        description: 'Invalidate user session',
        security: [
          {
            bearerAuth: []
          }
        ],
        responses: {
          '200': {
            description: 'Logout successful',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ApiResponse'
                }
              }
            }
          }
        }
      }
    },
    '/api/users/profile': {
      get: {
        tags: ['Users'],
        summary: 'Get user profile',
        description: 'Get current user profile information',
        security: [
          {
            bearerAuth: []
          }
        ],
        responses: {
          '200': {
            description: 'Profile retrieved successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean'
                    },
                    data: {
                      $ref: '#/components/schemas/User'
                    }
                  }
                }
              }
            }
          },
          '401': {
            description: 'Unauthorized'
          }
        }
      }
    },
    '/api/matching': {
      get: {
        tags: ['Matching'],
        summary: 'Get matches',
        description: 'Get AI-generated family and friend matches',
        security: [
          {
            bearerAuth: []
          }
        ],
        parameters: [
          {
            name: 'type',
            in: 'query',
            description: 'Match type filter',
            schema: {
              type: 'string',
              enum: ['family', 'friends', 'all'],
              default: 'all'
            }
          },
          {
            name: 'limit',
            in: 'query',
            description: 'Number of matches to return',
            schema: {
              type: 'integer',
              minimum: 1,
              maximum: 100,
              default: 20
            }
          }
        ],
        responses: {
          '200': {
            description: 'Matches retrieved successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean'
                    },
                    data: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          user: {
                            $ref: '#/components/schemas/User'
                          },
                          compatibility_score: {
                            type: 'number',
                            minimum: 0,
                            maximum: 100
                          },
                          match_type: {
                            type: 'string',
                            enum: ['family', 'friend']
                          },
                          common_traits: {
                            type: 'array',
                            items: {
                              type: 'string'
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          },
          '401': {
            description: 'Unauthorized'
          }
        }
      }
    }
  },
  tags: [
    {
      name: 'System',
      description: 'System health and status endpoints'
    },
    {
      name: 'Authentication',
      description: 'User authentication and session management'
    },
    {
      name: 'Users',
      description: 'User profile management'
    },
    {
      name: 'Matching',
      description: 'AI-powered matching system'
    }
  ]
};

// Custom CSS for better styling
const customCss = `
  .swagger-ui .topbar { display: none; }
  .swagger-ui .info { margin: 50px 0; }
  .swagger-ui .info .title { 
    color: #667eea; 
    font-size: 36px;
    font-weight: bold;
  }
  .swagger-ui .info .description {
    font-size: 16px;
    color: #4a5568;
  }
  .swagger-ui .scheme-container { 
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
    padding: 20px; 
    border-radius: 8px;
    margin: 20px 0;
  }
  .swagger-ui .auth-wrapper { margin-top: 20px; }
  .swagger-ui .btn.authorize { 
    background: #667eea; 
    border-color: #667eea; 
  }
  .swagger-ui .btn.authorize:hover { 
    background: #5a67d8; 
    border-color: #5a67d8; 
  }
  .swagger-ui .opblock .opblock-summary-method {
    min-width: 80px;
  }
  .swagger-ui .opblock.opblock-post {
    border-color: #667eea;
  }
  .swagger-ui .opblock.opblock-post .opblock-summary {
    border-color: #667eea;
  }
  .swagger-ui .opblock.opblock-get {
    border-color: #38a169;
  }
  .swagger-ui .opblock.opblock-get .opblock-summary {
    border-color: #38a169;
  }
`;

const swaggerOptions = {
  customCss,
  customSiteTitle: 'Yo! Family API Documentation',
  customfavIcon: '/favicon.ico',
  swaggerOptions: {
    persistAuthorization: true,
    docExpansion: 'list',
    defaultModelsExpandDepth: 2,
    defaultModelExpandDepth: 2,
    displayRequestDuration: true,
    tryItOutEnabled: true,
    filter: true,
    showExtensions: true,
    showCommonExtensions: true
  }
};

module.exports = {
  swaggerDocument,
  swaggerUi,
  swaggerOptions
};