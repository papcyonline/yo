# Yo Backend - AI Family Matching App

## 🚀 Complete API Implementation
This backend implements **120+ API endpoints** for the AI-powered family matching app.

## 📋 API Categories Implemented:
1. **Authentication & User Management** (25 endpoints)
2. **User Profile Management** (15 endpoints)  
3. **AI Matching Engine** (12 endpoints)
4. **Friends Management** (8 endpoints)
5. **Communities** (12 endpoints)
6. **Real-time Chat** (18 endpoints)
7. **Voice & Video Calls** (6 endpoints)
8. **Genealogy** (10 endpoints)
9. **Notifications** (8 endpoints)
10. **Privacy & Security** (15 endpoints)
11. **Location Services** (5 endpoints)
12. **Media & File Management** (8 endpoints)
13. **Analytics & Insights** (8 endpoints)
14. **Settings & Preferences** (10 endpoints)
15. **Support & Help** (8 endpoints)

## 🛠️ Setup
1. `npm install`
2. Configure your API keys in `.env`
3. Set up MongoDB database (localhost:27017/yofam-dev)
4. `npm start`

## 🌐 Base URL: `http://localhost:3010`

## 🗄️ Database: MongoDB
- **Primary Database**: MongoDB (localhost:27017/yofam-dev)
- **AI Service**: Python/TensorFlow (localhost:8000)
- **Full Migration**: Supabase → MongoDB completed ✅

## 🔑 Authentication
All protected endpoints require:
```
Authorization: Bearer <jwt_token>
```

## 📊 Health Check
GET `/health` - Server status and uptime
