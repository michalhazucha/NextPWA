"use client"

import { useState, useEffect, useRef } from "react"
import { Bell, BellOff, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { Toaster } from "@/components/ui/toaster"

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

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt)
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (isSubscribed && permission === "granted") {
      scheduleNotifications(Number.parseInt(interval))
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
          }
        })
      }
      
      localStorage.removeItem("isSubscribed")
      setIsSubscribed(false)
      toast({
        title: "Notifications disabled",
        description: "You will no longer receive notifications",
      })
    } else {
      // Subscribe
      localStorage.setItem("isSubscribed", "true")
      localStorage.setItem("notificationInterval", interval)
      setIsSubscribed(true)

      // Schedule notifications
      scheduleNotifications(Number.parseInt(interval))

      toast({
        title: "Notifications enabled",
        description: `You will receive notifications every ${INTERVALS.find((i) => i.value === interval)?.label.toLowerCase()}`,
      })
    }
  }

  const scheduleNotifications = async (intervalMinutes: number) => {
    // Clear any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }

    // Try to use service worker for better background support
    if ("serviceWorker" in navigator) {
      try {
        const registration = await navigator.serviceWorker.ready
        
        // Send message to service worker to start notifications
        if (registration.active) {
          registration.active.postMessage({
            type: "START_NOTIFICATIONS",
            intervalMinutes: intervalMinutes,
          })
        }
      } catch (error) {
        console.error("Failed to communicate with service worker:", error)
      }
    }

    // Fallback: Use setInterval if service worker communication fails
    // Note: This only works when the app is open
    const intervalMs = intervalMinutes * 60 * 1000
    
    // Send first notification immediately
    sendNotification()

    intervalRef.current = setInterval(() => {
      sendNotification()
    }, intervalMs)
  }

  const sendNotification = () => {
    if (Notification.permission === "granted") {
      // Try to use service worker notification first (works better in background)
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.ready.then((registration) => {
          registration.showNotification("Reminder Notification", {
            body: `This is your scheduled reminder!`,
            icon: "/icon-192x192.jpg",
            badge: "/icon-192x192.jpg",
            tag: "reminder",
            requireInteraction: false,
            ...(("vibrate" in navigator) && { vibrate: [200, 100, 200] }),
          } as NotificationOptions)
        }).catch(() => {
          // Fallback to regular notification
          showDirectNotification()
        })
      } else {
        showDirectNotification()
      }
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
                Install this app to enable notifications: Tap the share button (square with arrow) and select &quot;Add to Home Screen&quot;
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
                    ⚠️ Important: Notifications work best when the app is open or in the background. 
                    For true background notifications (when app is closed), a backend server with Push API is required.
                    {isIOS && !isStandalone && " On iOS, install the app to your home screen for better reliability."}
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
