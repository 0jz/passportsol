import { useEffect, useRef, useState } from 'react'
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

  return (
    <div className="space-y-2">
      <div className="relative rounded-lg overflow-hidden bg-zinc-950" style={{ aspectRatio: '1', width: '100%' }}>
        {!error && (
          <>
            <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
            <canvas ref={canvasRef} className="hidden" />
            {/* Viewfinder overlay */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-64 h-64 border-2 border-white/40 rounded-lg" style={{
                boxShadow: '0 0 0 9999px rgba(0,0,0,0.45)'
              }} />
            </div>
          </>
        )}
        {error && (
          <div className="flex items-center justify-center h-full p-4">
            <p className="text-xs text-red-400 text-center">{error}</p>
          </div>
        )}
      </div>
      <p className="text-xs text-zinc-500 text-center">Usmeri kameru prema QR kodu na tiketu</p>
      <button
        onClick={onClose}
        className="w-full text-zinc-500 hover:text-zinc-300 text-xs py-1 transition-colors"
      >
        Otkaži
      </button>
    </div>
  )
}
