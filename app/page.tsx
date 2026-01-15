"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { Bell, BellOff, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { Toaster } from "@/components/ui/toaster"
import { getFCMToken, onMessageListener } from "@/lib/firebase"

const INTERVALS = [
  { value: "1", label: "Every minute" },
  { value: "5", label: "Every 5 minutes" },
  { value: "15", label: "Every 15 minutes" },
  { value: "30", label: "Every 30 minutes" },
  { value: "60", label: "Every hour" },
]

export default function HomePage() {
  const [isSupported, setIsSupported] = useState(false)
  const [permission, setPermission] = useState<NotificationPermission>("default")
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [interval, setNotificationInterval] = useState("15")
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [isInstallable, setIsInstallable] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [isStandalone, setIsStandalone] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    // Detect iOS
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
    setIsIOS(isIOSDevice)

    // Check if app is running as standalone PWA
    const standalone = (window.navigator as any).standalone || 
      window.matchMedia('(display-mode: standalone)').matches
    setIsStandalone(standalone)

    // Check for service worker support (PWA)
    const hasServiceWorker = "serviceWorker" in navigator
    
    // Check for Notification API support
    const hasNotification = "Notification" in window

    // On iOS, notifications only work when installed as PWA
    // On other platforms, both service worker and notification are needed
    if (isIOSDevice) {
      // iOS: Service worker is supported, but notifications need PWA installation
      if (hasServiceWorker) {
        setIsSupported(true)
        if (hasNotification && standalone) {
          setPermission(Notification.permission)
        } else if (hasNotification) {
          // Notification API exists but app not installed - set to default
          setPermission("default")
        }
      }
    } else {
      // Other platforms: Need both service worker and notification
      if (hasServiceWorker && hasNotification) {
        setIsSupported(true)
        setPermission(Notification.permission)
      }
    }

    // Check if already subscribed
    const savedInterval = localStorage.getItem("notificationInterval")
    const subscribed = localStorage.getItem("isSubscribed") === "true"
    if (savedInterval) setNotificationInterval(savedInterval)
    if (subscribed) setIsSubscribed(true)

    // Listen for install prompt (Android/Chrome)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setIsInstallable(true)
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt)

    // Restore notification schedule when app comes back to foreground
    const handleVisibilityChange = () => {
      if (!document.hidden && isSubscribed && interval) {
        // App came back to foreground - restore schedule in service worker
        if ("serviceWorker" in navigator) {
          navigator.serviceWorker.ready.then((registration) => {
            if (registration.active) {
              registration.active.postMessage({
                type: "START_NOTIFICATIONS",
                intervalMinutes: Number.parseInt(interval),
              })
            }
          })
        }
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)
    window.addEventListener("focus", handleVisibilityChange)

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      window.removeEventListener("focus", handleVisibilityChange)
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [isSubscribed, interval])

  useEffect(() => {
    if (isSubscribed && permission === "granted") {
      scheduleNotifications(Number.parseInt(interval))
      
      // Listen for foreground FCM messages
      onMessageListener().then((payload: any) => {
        if (payload) {
          console.log("Foreground message received:", payload)
          toast({
            title: payload?.notification?.title || "Notification",
            description: payload?.notification?.body || "You have a new notification",
          })
        }
      })
    }
  }, [isSubscribed, permission, interval])

  const requestPermission = async () => {
    if (!isSupported) {
      if (isIOS && !isStandalone) {
        toast({
          title: "Install Required",
          description: "Please install this app to your home screen to enable notifications. Tap the share button and select 'Add to Home Screen'.",
          variant: "destructive",
        })
      } else {
        toast({
          title: "Not supported",
          description: "Push notifications are not supported in your browser",
          variant: "destructive",
        })
      }
      return
    }

    // On iOS, notifications only work when installed as PWA
    if (isIOS && !isStandalone) {
      toast({
        title: "Install Required",
        description: "Please install this app to your home screen to enable notifications. Tap the share button and select 'Add to Home Screen'.",
        variant: "destructive",
      })
      return
    }

    try {
      const perm = await Notification.requestPermission()
      setPermission(perm)

      if (perm === "granted") {
        toast({
          title: "Permission granted",
          description: "You will now receive notifications",
        })
      } else {
        toast({
          title: "Permission denied",
          description: "Please enable notifications in your browser settings",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("[v0] Error requesting notification permission:", error)
      toast({
        title: "Error",
        description: "Failed to request notification permission",
        variant: "destructive",
      })
    }
  }

  const subscribeToBackend = async (fcmToken: string, intervalMinutes: number) => {
    // TODO: Replace with your backend API endpoint
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001/api/subscribe"
    
    try {
      const response = await fetch(backendUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token: fcmToken,
          intervalMinutes: intervalMinutes,
        }),
      })
      
      if (!response.ok) {
        throw new Error("Failed to subscribe to backend")
      }
      
      console.log("Successfully subscribed to backend")
      return true
    } catch (error) {
      console.error("Error subscribing to backend:", error)
      return false
    }
  }

  const unsubscribeFromBackend = async (fcmToken: string) => {
    // TODO: Replace with your backend API endpoint
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001/api/unsubscribe"
    
    try {
      const response = await fetch(backendUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token: fcmToken,
        }),
      })
      
      if (!response.ok) {
        throw new Error("Failed to unsubscribe from backend")
      }
      
      console.log("Successfully unsubscribed from backend")
      return true
    } catch (error) {
      console.error("Error unsubscribing from backend:", error)
      return false
    }
  }

  const toggleNotifications = async () => {
    if (permission !== "granted") {
      await requestPermission()
      return
    }

    if (isSubscribed) {
      // Unsubscribe
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      
      // Stop service worker notifications
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.ready.then((registration) => {
          if (registration.active) {
            registration.active.postMessage({
              type: "STOP_NOTIFICATIONS",
            })
            console.log("Notifications stopped")
          }
        }).catch((error) => {
          console.error("Failed to stop notifications:", error)
        })
      }
      
      // Unsubscribe from backend (FCM)
      const fcmToken = localStorage.getItem("fcmToken")
      if (fcmToken) {
        await unsubscribeFromBackend(fcmToken)
        localStorage.removeItem("fcmToken")
      }
      
      localStorage.removeItem("isSubscribed")
      setIsSubscribed(false)
      toast({
        title: "Notifications disabled",
        description: "You will no longer receive notifications",
      })
    } else {
      // Subscribe
      try {
        // Get FCM token
        const fcmToken = await getFCMToken()
        
        if (!fcmToken) {
          toast({
            title: "Error",
            description: "Failed to get push notification token. Please check Firebase configuration.",
            variant: "destructive",
          })
          return
        }
        
        // Store FCM token
        localStorage.setItem("fcmToken", fcmToken)
        
        // Subscribe to backend
        const intervalMinutes = Number.parseInt(interval)
        const subscribed = await subscribeToBackend(fcmToken, intervalMinutes)
        
        if (!subscribed) {
          toast({
            title: "Warning",
            description: "Failed to connect to backend. Notifications may not work while using other apps.",
            variant: "destructive",
          })
        }
        
        localStorage.setItem("isSubscribed", "true")
        localStorage.setItem("notificationInterval", interval)
        setIsSubscribed(true)

        // Also schedule local notifications as fallback
        scheduleNotifications(intervalMinutes)

        toast({
          title: "Notifications enabled",
          description: `You will receive notifications every ${INTERVALS.find((i) => i.value === interval)?.label.toLowerCase()}`,
        })
      } catch (error) {
        console.error("Error enabling notifications:", error)
        toast({
          title: "Error",
          description: "Failed to enable notifications. Please try again.",
          variant: "destructive",
        })
      }
    }
  }

  const scheduleNotifications = async (intervalMinutes: number) => {
    // Clear any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }

    // Use service worker for notifications (works better in background)
    if ("serviceWorker" in navigator) {
      try {
        const registration = await navigator.serviceWorker.ready
        
        // Send message to service worker to start notifications
        if (registration.active) {
          registration.active.postMessage({
            type: "START_NOTIFICATIONS",
            intervalMinutes: intervalMinutes,
          })
          console.log(`Notifications scheduled: every ${intervalMinutes} minute(s)`)
        } else {
          // Wait for service worker to activate
          await navigator.serviceWorker.register("/sw.js")
          const newRegistration = await navigator.serviceWorker.ready
          if (newRegistration.active) {
            newRegistration.active.postMessage({
              type: "START_NOTIFICATIONS",
              intervalMinutes: intervalMinutes,
            })
          }
        }
      } catch (error) {
        console.error("Failed to communicate with service worker:", error)
        // Fallback only if service worker completely fails
        const intervalMs = intervalMinutes * 60 * 1000
        sendNotification()
        intervalRef.current = setInterval(() => {
          sendNotification()
        }, intervalMs)
      }
    } else {
      // Fallback: Use setInterval if service worker not supported
      const intervalMs = intervalMinutes * 60 * 1000
      sendNotification()
      intervalRef.current = setInterval(() => {
        sendNotification()
      }, intervalMs)
    }
  }

  const sendNotification = () => {
    // Don't send notifications directly from the page
    // Let the service worker handle all notifications to avoid duplicates
    // This function is only used as a fallback if service worker fails
    if (Notification.permission === "granted") {
      showDirectNotification()
    }
  }

  const showDirectNotification = () => {
    const notification = new Notification("Reminder Notification", {
      body: `This is your scheduled reminder!`,
      icon: "/icon-192x192.jpg",
      badge: "/icon-192x192.jpg",
      tag: "reminder",
      requireInteraction: false,
    })

    notification.onclick = () => {
      window.focus()
      notification.close()
    }
  }

  const handleIntervalChange = (value: string) => {
    setNotificationInterval(value)
    if (isSubscribed) {
      localStorage.setItem("notificationInterval", value)
      scheduleNotifications(Number.parseInt(value))
      toast({
        title: "Interval updated",
        description: `Notifications will now be sent every ${INTERVALS.find((i) => i.value === value)?.label.toLowerCase()}`,
      })
    }
  }

  const handleInstallClick = async () => {
    if (!deferredPrompt) return

    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice

    if (outcome === "accepted") {
      toast({
        title: "App installed",
        description: "The app has been installed successfully",
      })
    }

    setDeferredPrompt(null)
    setIsInstallable(false)
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-3xl font-bold bg-red-600 text-white">Notify Me</CardTitle>
            {isInstallable && (
              <Button onClick={handleInstallClick} size="sm" variant="outline" className="gap-2 bg-transparent">
                <Download className="h-4 w-4" />
                Install
              </Button>
            )}
          </div>
          <CardDescription>Get push notifications at your chosen interval</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-wrap gap-3">
            <Button asChild variant="outline">
              <Link href="/sign">Podpísať PDF</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/scan">Skenovať QR kód</Link>
            </Button>
          </div>
          {!isSupported ? (
            <div className="p-4 bg-destructive/10 text-destructive rounded-lg">
              <p className="text-sm font-medium">
                {isIOS 
                  ? "Please install this app to your home screen to enable notifications. Tap the share button and select 'Add to Home Screen'."
                  : "Your browser doesn't support push notifications"}
              </p>
            </div>
          ) : isIOS && !isStandalone ? (
            <div className="p-4 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 rounded-lg">
              <p className="text-sm font-medium">
                <strong>📱 Install Required for iOS:</strong>
                <br />To enable push notifications that work while using other apps:
                <br />1. Tap the Share button (square with arrow) at the bottom
                <br />2. Scroll down and select &quot;Add to Home Screen&quot;
                <br />3. Tap &quot;Add&quot;
                <br />4. Open the app from your home screen
                <br /><br />
                <strong>With backend API:</strong> Once installed, notifications will work even when using Instagram or other apps! ✅
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="interval">Notification Interval</Label>
                <Select value={interval} onValueChange={handleIntervalChange}>
                  <SelectTrigger id="interval">
                    <SelectValue placeholder="Select interval" />
                  </SelectTrigger>
                  <SelectContent>
                    {INTERVALS.map((int) => (
                      <SelectItem key={int.value} value={int.value}>
                        {int.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                  <div className="flex items-center gap-3">
                    {isSubscribed ? (
                      <Bell className="h-5 w-5 text-primary" />
                    ) : (
                      <BellOff className="h-5 w-5 text-muted-foreground" />
                    )}
                    <div>
                      <p className="font-medium">Notifications</p>
                      <p className="text-sm text-muted-foreground">{isSubscribed ? "Active" : "Inactive"}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Status</p>
                    <p className="text-sm font-medium capitalize">{permission}</p>
                  </div>
                </div>

                <Button
                  onClick={toggleNotifications}
                  className="w-full"
                  size="lg"
                  variant={isSubscribed ? "destructive" : "default"}
                >
                  {isSubscribed ? (
                    <>
                      <BellOff className="mr-2 h-5 w-5" />
                      Disable Notifications
                    </>
                  ) : (
                    <>
                      <Bell className="mr-2 h-5 w-5" />
                      Enable Notifications
                    </>
                  )}
                </Button>
              </div>

              {permission === "denied" && (
                <div className="p-4 bg-destructive/10 text-destructive rounded-lg">
                  <p className="text-sm font-medium">
                    Notifications are blocked. Please enable them in your browser settings.
                  </p>
                </div>
              )}

              {isSubscribed && (
                <div className="p-4 bg-blue-500/10 text-blue-700 dark:text-blue-400 rounded-lg">
                  <p className="text-sm font-medium">
                    {isIOS && !isStandalone ? (
                      <>
                        📱 <strong>iOS Installation Required:</strong> For notifications to work while using other apps, please install this app:
                        <br />1. Tap the Share button (square with arrow)
                        <br />2. Select &quot;Add to Home Screen&quot;
                        <br />3. Open the app from your home screen
                        <br /><br />
                        <strong>With backend API:</strong> Once installed, notifications will work even when using other apps! ✅
                      </>
                    ) : isIOS && isStandalone ? (
                      <>
                        ✅ <strong>iOS PWA Installed:</strong> With backend API configured, notifications will work:
                        <br />• While using other apps (Instagram, etc.) ✅
                        <br />• When app is closed ✅
                        <br />• When device is locked ✅
                        <br /><br />
                        <strong>Note:</strong> Make sure your backend API is running and configured correctly.
                      </>
                    ) : (
                      <>
                        ✅ <strong>Android/Desktop:</strong> With backend API configured, notifications will work:
                        <br />• While using other apps ✅
                        <br />• When app is closed ✅
                        <br />• When device is locked ✅
                        <br /><br />
                        <strong>Note:</strong> Make sure your backend API is running and configured correctly.
                      </>
                    )}
                  </p>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
      <Toaster />
    </div>
  )
}
