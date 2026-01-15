const CACHE_NAME = "notify-me-v1"
const urlsToCache = ["/", "/icon-192x192.jpg", "/icon-512x512.jpg"]

// Store notification schedule state
let notificationInterval = null
let nextNotificationTime = null
let checkInterval = null

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(urlsToCache)
    }),
  )
  // Force activation of new service worker
  self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName)
          }
        }),
      )
    }),
  )
  // Take control of all pages immediately
  return self.clients.claim()
})

self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request)
    }),
  )
})

// Handle messages from the main app to start/stop notifications
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "START_NOTIFICATIONS") {
    const intervalMinutes = event.data.intervalMinutes
    startNotificationSchedule(intervalMinutes)
  } else if (event.data && event.data.type === "STOP_NOTIFICATIONS") {
    stopNotificationSchedule()
  } else if (event.data && event.data.type === "CHECK_SCHEDULE") {
    // Respond with current schedule status
    event.ports[0].postMessage({
      interval: notificationInterval,
      nextTime: nextNotificationTime,
    })
  }
})

// Start notification schedule using timestamp-based approach
const startNotificationSchedule = (intervalMinutes) => {
  stopNotificationSchedule() // Clear any existing schedule
  
  notificationInterval = intervalMinutes
  const intervalMs = intervalMinutes * 60 * 1000
  
  // Set next notification time (immediately)
  nextNotificationTime = Date.now()
  
  // Send first notification immediately
  showNotification()
  
  // Update next notification time
  nextNotificationTime = Date.now() + intervalMs
  
  // Check every 10 seconds if it's time for a notification
  // This approach works better in background than setInterval
  checkInterval = setInterval(() => {
    checkAndSendNotification(intervalMs)
  }, 10000) // Check every 10 seconds
}

// Check if it's time to send a notification
const checkAndSendNotification = (intervalMs) => {
  if (!nextNotificationTime || !notificationInterval) return
  
  const now = Date.now()
  
  // If we've passed the scheduled time, send notification
  if (now >= nextNotificationTime) {
    showNotification()
    // Schedule next notification
    nextNotificationTime = now + intervalMs
  }
}

// Stop notification schedule
const stopNotificationSchedule = () => {
  if (checkInterval) {
    clearInterval(checkInterval)
    checkInterval = null
  }
  notificationInterval = null
  nextNotificationTime = null
}

// Show notification
const showNotification = () => {
  const title = "Reminder Notification"
  const options = {
    body: "This is your scheduled reminder!",
    icon: "/icon-192x192.jpg",
    badge: "/icon-192x192.jpg",
    tag: "reminder",
    requireInteraction: false,
    vibrate: [200, 100, 200],
  }
  
  return self.registration.showNotification(title, options)
}

// Handle notification clicks
self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // If app is already open, focus it
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i]
        if (client.url === "/" && "focus" in client) {
          return client.focus()
        }
      }
      // Otherwise, open the app
      if (clients.openWindow) {
        return clients.openWindow("/")
      }
    }),
  )
})

// Handle push notifications from FCM (Firebase Cloud Messaging)
self.addEventListener("push", (event) => {
  console.log("Push event received:", event)
  
  let notificationData = {
    title: "Reminder Notification",
    body: "This is your scheduled reminder!",
    icon: "/icon-192x192.jpg",
    badge: "/icon-192x192.jpg",
    tag: "reminder",
    requireInteraction: false,
    vibrate: [200, 100, 200],
  }
  
  // Parse push data if available
  if (event.data) {
    try {
      const data = event.data.json()
      if (data.notification) {
        notificationData = {
          ...notificationData,
          ...data.notification,
        }
      }
    } catch (e) {
      // If not JSON, try text
      const text = event.data.text()
      if (text) {
        notificationData.body = text
      }
    }
  }
  
  event.waitUntil(
    self.registration.showNotification(notificationData.title, notificationData)
  )
})

// Periodic Background Sync (if supported) - for better background notifications
if ("periodicSync" in self.registration) {
  self.addEventListener("periodicsync", (event) => {
    if (event.tag === "reminder-sync" && notificationInterval) {
      event.waitUntil(showNotification())
    }
  })
}
