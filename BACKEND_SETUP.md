# Backend Setup for Push Notifications

This guide explains how to set up a backend server to send push notifications at specified intervals.

## Overview

The backend server will:
1. Receive FCM tokens from the frontend
2. Store subscriptions with their notification intervals
3. Send push notifications at the specified intervals using Firebase Cloud Messaging (FCM)

## Option 1: Simple Node.js Server (Recommended for Development)

### Step 1: Install Dependencies

```bash
npm install express firebase-admin node-cron
```

### Step 2: Get Firebase Admin SDK Credentials

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Go to **Project Settings** > **Service Accounts**
4. Click **Generate New Private Key**
5. Save the JSON file as `firebase-service-account.json` in your backend directory

### Step 3: Update Backend Code

1. Copy `backend-example.js` to your backend directory
2. Update the Firebase initialization if needed
3. Update the port if needed (default: 3001)

### Step 4: Run the Server

```bash
node backend-example.js
```

### Step 5: Update Frontend Environment Variables

Create a `.env.local` file in your Next.js project:

```env
NEXT_PUBLIC_BACKEND_URL=http://localhost:3001/api
```

## Option 2: Vercel Serverless Functions

### Step 1: Create API Routes

Create `api/subscribe.ts` and `api/unsubscribe.ts` in your Next.js project (if not using static export).

### Step 2: Use Firebase Admin SDK

Install Firebase Admin SDK:
```bash
pnpm add firebase-admin
```

### Step 3: Set Environment Variables

In Vercel dashboard, add:
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`

## Option 3: Railway/Render Deployment

### Step 1: Deploy Backend

1. Create a new Node.js project
2. Copy `backend-example.js` and `package.json`
3. Set environment variables:
   - `FIREBASE_PROJECT_ID`
   - `FIREBASE_CLIENT_EMAIL`
   - `FIREBASE_PRIVATE_KEY`
   - `PORT` (optional, defaults to 3001)

### Step 2: Update Frontend

Update `.env.local`:
```env
NEXT_PUBLIC_BACKEND_URL=https://your-backend.railway.app/api
```

## Firebase Configuration

### Frontend (.env.local)

```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
NEXT_PUBLIC_FIREBASE_VAPID_KEY=your_vapid_key
NEXT_PUBLIC_BACKEND_URL=http://localhost:3001/api
```

### Get VAPID Key

1. Go to Firebase Console > Project Settings > Cloud Messaging
2. Under "Web Push certificates", click "Generate key pair"
3. Copy the key and add it to `.env.local`

## Testing

1. Start the backend server
2. Start your Next.js app
3. Enable notifications in the app
4. Check backend logs for subscription confirmation
5. Wait for notifications to arrive

## Production Considerations

1. **Security**: Add authentication to your API endpoints
2. **Rate Limiting**: Implement rate limiting to prevent abuse
3. **Database**: Store subscriptions in a database (PostgreSQL, MongoDB, etc.) instead of memory
4. **Error Handling**: Add better error handling and retry logic
5. **Monitoring**: Add logging and monitoring (Sentry, LogRocket, etc.)

## Troubleshooting

### Notifications not working?

1. Check Firebase configuration in both frontend and backend
2. Verify VAPID key is correct
3. Check browser console for errors
4. Verify backend is running and accessible
5. Check Firebase Console > Cloud Messaging for delivery status

### Backend not receiving subscriptions?

1. Check CORS settings
2. Verify backend URL is correct in frontend
3. Check network tab in browser DevTools
4. Verify backend is running on correct port







