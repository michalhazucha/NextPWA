"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

interface BarcodeDetectorResult {
  rawValue: string
  format?: string
}

interface BarcodeDetectorInstance {
  detect: (source: HTMLVideoElement | HTMLCanvasElement) => Promise<BarcodeDetectorResult[]>
}

interface BarcodeDetectorConstructor {
  new (options: { formats: string[] }): BarcodeDetectorInstance
}

interface ParsedQrValue {
  type: "url" | "json" | "text"
  raw: string
  url?: URL
  json?: unknown
}

interface QrScanResult {
  rawValue: string
  format?: string
  parsed: ParsedQrValue
}

const parseQrValue = (value: string): ParsedQrValue => {
  try {
    const json = JSON.parse(value) as unknown
    return { type: "json", raw: value, json }
  } catch {
    // Ignore JSON parse errors
  }

  try {
    const url = new URL(value)
    return { type: "url", raw: value, url }
  } catch {
    return { type: "text", raw: value }
  }
}

export default function ScanQrPage() {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number | null>(null)
  const detectorRef = useRef<BarcodeDetectorInstance | null>(null)

  const [isScanning, setIsScanning] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [scanResult, setScanResult] = useState<QrScanResult | null>(null)

  const isDetectorSupported = useMemo(() => {
    return typeof window !== "undefined" && "BarcodeDetector" in window
  }, [])

  const stopScan = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.pause()
      videoRef.current.srcObject = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    detectorRef.current = null
    setIsScanning(false)
  }, [])

  const handleDetection = useCallback(
    (barcode: BarcodeDetectorResult) => {
      const parsed = parseQrValue(barcode.rawValue)
      setScanResult({ rawValue: barcode.rawValue, format: barcode.format, parsed })
      setErrorMessage(null)
      stopScan()
    },
    [stopScan],
  )

  const startScanLoop = useCallback(async () => {
    const video = videoRef.current
    const detector = detectorRef.current
    if (!video || !detector) return

    if (video.readyState < 2) {
      rafRef.current = requestAnimationFrame(startScanLoop)
      return
    }

    try {
      const barcodes = await detector.detect(video)
      if (barcodes.length > 0) {
        handleDetection(barcodes[0])
        return
      }
    } catch (error) {
      console.error("QR scan failed:", error)
  setErrorMessage("Skenovanie zlyhalo. Skús to znova alebo obnov stránku.")
      stopScan()
      return
    }

    rafRef.current = requestAnimationFrame(startScanLoop)
  }, [handleDetection, stopScan])

  const startScan = useCallback(async () => {
    setErrorMessage(null)
    setScanResult(null)

    if (!isDetectorSupported) {
      setErrorMessage("Tento prehliadač nepodporuje skenovanie QR/čiarových kódov.")
      return
    }

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      })
      streamRef.current = mediaStream

      const BarcodeDetectorCtor = (window as unknown as { BarcodeDetector?: BarcodeDetectorConstructor })
        .BarcodeDetector
      if (!BarcodeDetectorCtor) {
        setErrorMessage("Skenovanie QR/čiarových kódov nie je k dispozícii.")
        stopScan()
        return
      }

      detectorRef.current = new BarcodeDetectorCtor({
        formats: [
          "qr_code",
          "code_128",
          "code_39",
          "code_93",
          "ean_13",
          "ean_8",
          "upc_a",
          "upc_e",
          "itf",
          "codabar",
        ],
      })

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream
        await videoRef.current.play()
      }

      setIsScanning(true)
      rafRef.current = requestAnimationFrame(startScanLoop)
    } catch (error) {
      console.error("Failed to access camera:", error)
      setErrorMessage("Nepodarilo sa spustiť kameru. Skontroluj povolenia.")
      stopScan()
    }
  }, [isDetectorSupported, startScanLoop, stopScan])

  useEffect(() => () => stopScan(), [stopScan])

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-3xl">
        <CardHeader className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-2xl">Skenovanie QR/čiarového kódu</CardTitle>
              <CardDescription>Nasmeruj fotoaparát na QR alebo čiarový kód.</CardDescription>
            </div>
            <Button asChild variant="outline">
              <Link href="/">Späť na domov</Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="rounded-lg border bg-black/90 p-3">
            <video ref={videoRef} className="h-[360px] w-full rounded-md object-cover" />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={startScan} disabled={isScanning}>
              {isScanning ? "Skenujem..." : "Spustiť skenovanie"}
            </Button>
            <Button variant="outline" onClick={stopScan} disabled={!isScanning}>
              Zastaviť
            </Button>
          </div>

          {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}

          {scanResult ? (
            <div className="space-y-3 rounded-lg border bg-muted p-4">
              <div className="text-sm text-muted-foreground">Našiel som kód:</div>
              <div className="break-all font-medium">{scanResult.rawValue}</div>
              {scanResult.format && (
                <div className="text-sm text-muted-foreground">Formát: {scanResult.format}</div>
              )}
              {scanResult.parsed.type === "url" && scanResult.parsed.url && (
                <div className="text-sm text-muted-foreground">
                  URL: {scanResult.parsed.url.origin}
                  {scanResult.parsed.url.pathname}
                </div>
              )}
              {scanResult.parsed.type === "json" && scanResult.parsed.json && (
                <pre className="whitespace-pre-wrap text-xs text-muted-foreground">
                  {JSON.stringify(scanResult.parsed.json, null, 2)}
                </pre>
              )}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              {isScanning ? "Skenujem... drž kód v zábere." : "Zatiaľ žiadny výsledok."}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
