import { initializeApp, getApps, FirebaseApp } from "firebase/app"
import { getMessaging, getToken, Messaging, onMessage } from "firebase/messaging"

// Firebase configuration
// TODO: Replace with your Firebase project config
// Get this from Firebase Console > Project Settings > General > Your apps
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "YOUR_API_KEY",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "YOUR_AUTH_DOMAIN",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "YOUR_PROJECT_ID",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "YOUR_STORAGE_BUCKET",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "YOUR_SENDER_ID",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "YOUR_APP_ID",
}

// Initialize Firebase
let app: FirebaseApp
if (getApps().length === 0) {
  app = initializeApp(firebaseConfig)
} else {
  app = getApps()[0]
}

// Get FCM messaging instance (only in browser)
export const getMessagingInstance = (): Messaging | null => {
  if (typeof window === "undefined") return null
  try {
    return getMessaging(app)
  } catch (error) {
    console.error("Firebase messaging initialization error:", error)
    return null
  }
}

// Get FCM token for push notifications
export const getFCMToken = async (): Promise<string | null> => {
  if (typeof window === "undefined") return null
  
  const messaging = getMessagingInstance()
  if (!messaging) return null

  try {
    // VAPID key - get this from Firebase Console > Project Settings > Cloud Messaging > Web Push certificates
    const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY || "YOUR_VAPID_KEY"
    
    const token = await getToken(messaging, {
      vapidKey: vapidKey,
    })
    
    if (token) {
      console.log("FCM Token:", token)
      return token
    } else {
      console.log("No registration token available.")
      return null
    }
  } catch (error) {
    console.error("An error occurred while retrieving token:", error)
    return null
  }
}

// Listen for foreground messages
export const onMessageListener = () => {
  const messaging = getMessagingInstance()
  if (!messaging) return Promise.resolve(null)

  return new Promise((resolve) => {
    onMessage(messaging, (payload) => {
      console.log("Message received:", payload)
      resolve(payload)
    })
  })
}







