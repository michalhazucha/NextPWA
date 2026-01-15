# Firebase Push Notifications Setup Guide

## ✅ What's Been Set Up

1. **Firebase SDK** installed
2. **FCM Integration** in frontend (`lib/firebase.ts`)
3. **Service Worker** updated to handle push events
4. **Backend API example** created (`backend-example.js`)
5. **Frontend** updated to subscribe to FCM

## 🚀 Quick Start

### Step 1: Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project"
3. Follow the setup wizard
4. Enable **Cloud Messaging** in the project

### Step 2: Get Firebase Config

1. In Firebase Console, go to **Project Settings** (gear icon)
2. Scroll down to "Your apps"
3. Click the web icon (`</>`) to add a web app
4. Register your app and copy the config

### Step 3: Get VAPID Key

1. In Firebase Console, go to **Project Settings** > **Cloud Messaging**
2. Scroll to "Web Push certificates"
3. Click "Generate key pair"
4. Copy the key

### Step 4: Set Environment Variables

Create `.env.local` in your project root:

```env
# Firebase Config (from Step 2)
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key_here
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

# VAPID Key (from Step 3)
NEXT_PUBLIC_FIREBASE_VAPID_KEY=your_vapid_key_here

# Backend URL (update after deploying backend)
NEXT_PUBLIC_BACKEND_URL=http://localhost:3001/api
```

### Step 5: Set Up Backend

See `BACKEND_SETUP.md` for detailed backend setup instructions.

**Quick version:**
1. Install dependencies: `npm install express firebase-admin node-cron`
2. Get Firebase Admin SDK key from Firebase Console > Service Accounts
3. Save as `firebase-service-account.json`
4. Run: `node backend-example.js`

### Step 6: Update Firebase Config in Service Worker

Edit `public/firebase-messaging-sw.js` and replace the placeholder values with your Firebase config.

## 🎯 How It Works

1. **User enables notifications** → Frontend gets FCM token
2. **Frontend sends token + interval** → Backend stores subscription
3. **Backend schedules notifications** → Uses cron to send at intervals
4. **FCM sends push** → Service worker receives and shows notification
5. **Notifications work** → Even when app is closed or using other apps! 🎉

## 📱 Testing

1. Start backend: `node backend-example.js`
2. Start frontend: `pnpm dev`
3. Open app in browser
4. Enable notifications
5. Choose interval (e.g., "Every minute")
6. Switch to another app (Instagram, etc.)
7. Wait for notifications! ✅

## ⚠️ Important Notes

- **iOS Safari**: Push notifications work better when app is installed as PWA
- **Android**: Works great with Chrome
- **Desktop**: Works on Chrome, Firefox, Edge
- **Backend Required**: For true background notifications, backend is mandatory

## 🔧 Troubleshooting

### Notifications not working?

1. Check browser console for errors
2. Verify Firebase config is correct
3. Check backend is running and accessible
4. Verify VAPID key is correct
5. Check Firebase Console > Cloud Messaging for delivery status

### Backend connection failed?

1. Check `NEXT_PUBLIC_BACKEND_URL` is correct
2. Verify backend is running
3. Check CORS settings in backend
4. Check network tab in browser DevTools

## 📚 Next Steps

- Deploy backend to production (Railway, Render, Vercel, etc.)
- Update `NEXT_PUBLIC_BACKEND_URL` to production URL
- Add authentication to backend API
- Store subscriptions in database instead of memory
- Add error handling and retry logic







