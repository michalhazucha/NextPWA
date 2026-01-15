"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from "react"
import Link from "next/link"
import { PDFDocument } from "pdf-lib"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const SIGNATURE_HEIGHT = 180
const SIGNATURE_LINE_WIDTH = 2.5
const SIGNATURE_COLOR = "#111827"

interface SignatureDrawPoint {
  x: number
  y: number
}

const getPointerPosition = (event: PointerEvent<HTMLCanvasElement>) => {
  const canvas = event.currentTarget
  const rect = canvas.getBoundingClientRect()
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  }
}

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

export default function SignPdfPage() {
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [hasSignature, setHasSignature] = useState(false)
  const [isSigning, setIsSigning] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const canvasContainerRef = useRef<HTMLDivElement | null>(null)
  const isDrawingRef = useRef(false)
  const lastPointRef = useRef<SignatureDrawPoint | null>(null)
  const resizeObserverRef = useRef<ResizeObserver | null>(null)

  const canSign = useMemo(() => Boolean(pdfFile && hasSignature), [pdfFile, hasSignature])

  const prepareCanvas = useCallback((canvas: HTMLCanvasElement, width: number) => {
    const ratio = window.devicePixelRatio || 1
    canvas.width = Math.floor(width * ratio)
    canvas.height = Math.floor(SIGNATURE_HEIGHT * ratio)
    canvas.style.width = `${width}px`
    canvas.style.height = `${SIGNATURE_HEIGHT}px`

    const context = canvas.getContext("2d")
    if (context) {
      context.setTransform(1, 0, 0, 1, 0, 0)
      context.scale(ratio, ratio)
      context.lineCap = "round"
      context.lineJoin = "round"
      context.lineWidth = SIGNATURE_LINE_WIDTH
      context.strokeStyle = SIGNATURE_COLOR
    }
  }, [])

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current
    const container = canvasContainerRef.current
    if (!canvas || !container) return

    const { width } = container.getBoundingClientRect()
    if (!width) return

    const snapshot = canvas.toDataURL("image/png")
    prepareCanvas(canvas, width)

    if (snapshot !== "data:," && hasSignature) {
      const image = new Image()
      image.onload = () => {
        const context = canvas.getContext("2d")
        if (context) {
          context.drawImage(image, 0, 0, width, SIGNATURE_HEIGHT)
        }
      }
      image.src = snapshot
    }
  }, [hasSignature, prepareCanvas])

  useEffect(() => {
    resizeCanvas()
    resizeObserverRef.current?.disconnect()
    if (canvasContainerRef.current) {
      resizeObserverRef.current = new ResizeObserver(() => resizeCanvas())
      resizeObserverRef.current.observe(canvasContainerRef.current)
    }
    return () => resizeObserverRef.current?.disconnect()
  }, [resizeCanvas])

  useEffect(() => {
    if (!pdfFile) {
      setPdfUrl(null)
      return
    }
    const url = URL.createObjectURL(pdfFile)
    setPdfUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [pdfFile])

  const startDrawing = (event: PointerEvent<HTMLCanvasElement>) => {
    event.preventDefault()
    const canvas = canvasRef.current
    if (!canvas) return
    isDrawingRef.current = true
    canvas.setPointerCapture(event.pointerId)
    const point = getPointerPosition(event)
    lastPointRef.current = point
    const context = canvas.getContext("2d")
    if (context) {
      context.beginPath()
      context.moveTo(point.x, point.y)
    }
  }

  const drawSignature = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return
    const canvas = canvasRef.current
    if (!canvas) return
    const point = getPointerPosition(event)
    const context = canvas.getContext("2d")
    if (context) {
      const lastPoint = lastPointRef.current
      if (lastPoint) {
        context.lineTo(point.x, point.y)
        context.stroke()
      }
    }
    lastPointRef.current = point
  }

  const stopDrawing = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return
    isDrawingRef.current = false
    event.currentTarget.releasePointerCapture(event.pointerId)
    if (!hasSignature) {
      setHasSignature(true)
    }
  }

  const clearSignature = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const context = canvas.getContext("2d")
    if (context) {
      context.clearRect(0, 0, canvas.width, canvas.height)
    }
    setHasSignature(false)
    lastPointRef.current = null
  }

  const handlePdfChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null
    setPdfFile(file)
    setStatusMessage(null)
  }

  const signPdf = async () => {
    if (!pdfFile || !canvasRef.current) return
    setIsSigning(true)
    setStatusMessage(null)

    try {
      const pdfBytes = await pdfFile.arrayBuffer()
      const document = await PDFDocument.load(pdfBytes)
      const pages = document.getPages()
      const lastPage = pages[pages.length - 1]

      const signatureDataUrl = canvasRef.current.toDataURL("image/png")
      const signatureImage = await document.embedPng(signatureDataUrl)

      const pageSize = lastPage.getSize()
      const maxWidth = Math.min(pageSize.width * 0.4, 220)
      const scale = maxWidth / signatureImage.width
      const signatureWidth = signatureImage.width * scale
      const signatureHeight = signatureImage.height * scale
      const margin = 36

      lastPage.drawImage(signatureImage, {
        x: pageSize.width - signatureWidth - margin,
        y: margin,
        width: signatureWidth,
        height: signatureHeight,
      })

      const signedBytes = await document.save()
      const blob = new Blob([signedBytes], { type: "application/pdf" })
      downloadBlob(blob, "signed-document.pdf")
      setStatusMessage("Podpis je vložený na poslednú stranu PDF a súbor sa stiahol.")
    } catch (error) {
      console.error("Failed to sign PDF:", error)
      setStatusMessage("Nepodarilo sa podpísať PDF. Skús to znova.")
    } finally {
      setIsSigning(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-3xl">
        <CardHeader className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-2xl">Podpis PDF dokumentu</CardTitle>
              <CardDescription>Nahraj PDF a podpíš ho priamo prstom alebo stylusom.</CardDescription>
            </div>
            <Button asChild variant="outline">
              <Link href="/">Späť na domov</Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="pdf-upload">PDF dokument</Label>
            <Input id="pdf-upload" type="file" accept="application/pdf" onChange={handlePdfChange} />
          </div>

          {pdfUrl ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Náhľad PDF (podpis sa vloží na poslednú stranu vpravo dole).
              </p>
              <div className="h-[420px] w-full overflow-hidden rounded-lg border bg-muted">
                <iframe title="pdf-preview" src={pdfUrl} className="h-full w-full" />
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
              Najprv nahraj PDF dokument, aby sa zobrazil náhľad.
            </div>
          )}

          <div className="space-y-3">
            <Label>Podpis</Label>
            <div
              ref={canvasContainerRef}
              className="rounded-lg border bg-white p-2"
            >
              <canvas
                ref={canvasRef}
                className="touch-none"
                onPointerDown={startDrawing}
                onPointerMove={drawSignature}
                onPointerUp={stopDrawing}
                onPointerLeave={stopDrawing}
              />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button type="button" variant="outline" onClick={clearSignature}>
                Vymazať podpis
              </Button>
              <Button type="button" onClick={signPdf} disabled={!canSign || isSigning}>
                {isSigning ? "Podpisujem..." : "Stiahnuť podpísané PDF"}
              </Button>
            </div>
            {statusMessage && <p className="text-sm text-muted-foreground">{statusMessage}</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
