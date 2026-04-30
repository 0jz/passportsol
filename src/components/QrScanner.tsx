import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import jsQR from 'jsqr'

interface Props {
  onResult: (data: string) => void
  onClose: () => void
}

export default function QrScanner({ onResult, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [error, setError] = useState<string | null>(null)
  const resultFired = useRef(false)

  useEffect(() => {
    let stream: MediaStream | null = null
    let animFrame: number

    function scan() {
      const video = videoRef.current
      const canvas = canvasRef.current
      if (!video || !canvas) return
      if (video.readyState < video.HAVE_ENOUGH_DATA) {
        animFrame = requestAnimationFrame(scan)
        return
      }
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(video, 0, 0)
      const img = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const code = jsQR(img.data, img.width, img.height)
      if (code && !resultFired.current) {
        resultFired.current = true
        stream?.getTracks().forEach(t => t.stop())
        onResult(code.data)
        return
      }
      animFrame = requestAnimationFrame(scan)
    }

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment' } })
      .then(s => {
        stream = s
        if (videoRef.current) {
          videoRef.current.srcObject = s
          videoRef.current.play().then(scan)
        }
      })
      .catch(() => setError('Kamera nije dostupna ili pristup nije odobren'))

    return () => {
      cancelAnimationFrame(animFrame)
      stream?.getTracks().forEach(t => t.stop())
    }
  }, [onResult])

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      {/* Camera feed — full screen */}
      {!error && (
        <>
          <video
            ref={videoRef}
            className="absolute inset-0 w-full h-full object-cover"
            playsInline
            muted
          />
          <canvas ref={canvasRef} className="hidden" />
        </>
      )}

      {/* Dimmed overlay with cutout */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: 'rgba(0,0,0,0.55)'
      }} />

      {/* Viewfinder */}
      <div className="relative z-10 flex flex-col items-center gap-6">
        <div
          className="rounded-2xl"
          style={{
            width: 'min(80vw, 80vh)',
            height: 'min(80vw, 80vh)',
            border: '3px solid rgba(255,255,255,0.7)',
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.55)',
          }}
        />
        {error && (
          <p className="text-sm text-red-400 text-center px-6">{error}</p>
        )}
        <p className="text-sm text-white/60">Usmeri kameru prema QR kodu</p>
      </div>

      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-5 right-5 z-20 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
      >
        ✕
      </button>
    </div>,
    document.body
  )
}
