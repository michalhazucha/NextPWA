/**
 * Backend API Example for Push Notifications
 * 
 * This is a simple Node.js/Express server that handles FCM push notifications.
 * 
 * Setup:
 * 1. Install dependencies: npm install express firebase-admin node-cron
 * 2. Get Firebase Admin SDK key from Firebase Console > Project Settings > Service Accounts
 * 3. Save the key as 'firebase-service-account.json' in this directory
 * 4. Update FIREBASE_PROJECT_ID with your project ID
 * 5. Run: node backend-example.js
 * 
 * Deploy to:
 * - Vercel (serverless functions)
 * - Railway
 * - Render
 * - AWS Lambda
 * - Any Node.js hosting
 */

const express = require('express')
const admin = require('firebase-admin')
const cron = require('node-cron')

const app = express()
app.use(express.json())

// Initialize Firebase Admin SDK
// Option 1: Using service account key file
const serviceAccount = require('./firebase-service-account.json')
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  // projectId: 'YOUR_PROJECT_ID' // Optional, can be inferred from service account
})

// Option 2: Using environment variables (for production)
// admin.initializeApp({
//   credential: admin.credential.cert({
//     projectId: process.env.FIREBASE_PROJECT_ID,
//     clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
//     privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
//   }),
// })

// Store active subscriptions
const subscriptions = new Map() // token -> { intervalMinutes, lastSent }

// Subscribe endpoint
app.post('/api/subscribe', async (req, res) => {
  try {
    const { token, intervalMinutes } = req.body
    
    if (!token || !intervalMinutes) {
      return res.status(400).json({ error: 'Token and intervalMinutes are required' })
    }
    
    // Store subscription
    subscriptions.set(token, {
      intervalMinutes: parseInt(intervalMinutes),
      lastSent: Date.now(),
    })
    
    // Schedule notifications using cron
    scheduleNotification(token, parseInt(intervalMinutes))
    
    console.log(`Subscribed token: ${token.substring(0, 20)}... with interval: ${intervalMinutes} minutes`)
    
    res.json({ success: true, message: 'Subscribed successfully' })
  } catch (error) {
    console.error('Subscribe error:', error)
    res.status(500).json({ error: 'Failed to subscribe' })
  }
})

// Unsubscribe endpoint
app.post('/api/unsubscribe', async (req, res) => {
  try {
    const { token } = req.body
    
    if (!token) {
      return res.status(400).json({ error: 'Token is required' })
    }
    
    // Remove subscription
    subscriptions.delete(token)
    
    console.log(`Unsubscribed token: ${token.substring(0, 20)}...`)
    
    res.json({ success: true, message: 'Unsubscribed successfully' })
  } catch (error) {
    console.error('Unsubscribe error:', error)
    res.status(500).json({ error: 'Failed to unsubscribe' })
  }
})

// Send notification function
async function sendNotification(token, intervalMinutes) {
  try {
    const message = {
      notification: {
        title: 'Reminder Notification',
        body: `This is your scheduled reminder! (Every ${intervalMinutes} minute${intervalMinutes > 1 ? 's' : ''})`,
      },
      data: {
        type: 'reminder',
        interval: intervalMinutes.toString(),
        timestamp: Date.now().toString(),
      },
      token: token,
      webpush: {
        notification: {
          icon: '/icon-192x192.jpg',
          badge: '/icon-192x192.jpg',
          vibrate: [200, 100, 200],
        },
      },
    }
    
    const response = await admin.messaging().send(message)
    console.log(`Notification sent successfully: ${response}`)
    
    // Update last sent time
    const subscription = subscriptions.get(token)
    if (subscription) {
      subscription.lastSent = Date.now()
    }
  } catch (error) {
    console.error('Error sending notification:', error)
    
    // If token is invalid, remove subscription
    if (error.code === 'messaging/invalid-registration-token' || 
        error.code === 'messaging/registration-token-not-registered') {
      subscriptions.delete(token)
      console.log(`Removed invalid token: ${token.substring(0, 20)}...`)
    }
  }
}

// Schedule notification using cron
function scheduleNotification(token, intervalMinutes) {
  // Convert minutes to cron expression
  // For every minute: '* * * * *'
  // For every N minutes: `*/${intervalMinutes} * * * *`
  
  let cronExpression
  if (intervalMinutes === 1) {
    cronExpression = '* * * * *' // Every minute
  } else {
    cronExpression = `*/${intervalMinutes} * * * *` // Every N minutes
  }
  
  // Cancel existing job if any
  const existingJob = cron.getTasks().get(token)
  if (existingJob) {
    existingJob.stop()
  }
  
  // Create new cron job
  const job = cron.schedule(cronExpression, () => {
    sendNotification(token, intervalMinutes)
  }, {
    scheduled: true,
    timezone: 'UTC',
  })
  
  // Store job reference
  cron.getTasks().set(token, job)
  
  console.log(`Scheduled notifications for token ${token.substring(0, 20)}... with cron: ${cronExpression}`)
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    subscriptions: subscriptions.size,
    timestamp: new Date().toISOString(),
  })
})

const PORT = process.env.PORT || 3001
app.listen(PORT, () => {
  console.log(`Backend API server running on port ${PORT}`)
  console.log(`Subscriptions endpoint: http://localhost:${PORT}/api/subscribe`)
  console.log(`Health check: http://localhost:${PORT}/health`)
})

// Cleanup on exit
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server')
  process.exit(0)
})







