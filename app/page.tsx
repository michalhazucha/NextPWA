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
  const [interval, setInterval] = useState("15")
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [isInstallable, setIsInstallable] = useState(false)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    if ("Notification" in window && "serviceWorker" in navigator) {
      setIsSupported(true)
      setPermission(Notification.permission)
    }

    // Check if already subscribed
    const savedInterval = localStorage.getItem("notificationInterval")
    const subscribed = localStorage.getItem("isSubscribed") === "true"
    if (savedInterval) setInterval(savedInterval)
    if (subscribed) setIsSubscribed(true)

    // Listen for install prompt
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
      toast({
        title: "Not supported",
        description: "Push notifications are not supported in your browser",
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

  const scheduleNotifications = (intervalMinutes: number) => {
    const intervalMs = intervalMinutes * 60 * 1000

    if (intervalRef.current) {
      clearInterval(intervalRef.current)
    }

    // Send first notification immediately
    sendNotification()

    intervalRef.current = setInterval(() => {
      sendNotification()
    }, intervalMs)
  }

  const sendNotification = () => {
    if (Notification.permission === "granted") {
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
  }

  const handleIntervalChange = (value: string) => {
    setInterval(value)
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
            <CardTitle className="text-3xl font-bold">Notify Me</CardTitle>
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
              <p className="text-sm font-medium">Your browser doesn&apos;t support push notifications</p>
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
            </>
          )}
        </CardContent>
      </Card>
      <Toaster />
    </div>
  )
}
