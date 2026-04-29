import { useState, useCallback } from 'react'
import { startReclaimVerification, RECLAIM_PROVIDERS } from '../lib/reclaim'

interface Props {
  onDone: (stamps: string[]) => void
}

export default function ReclaimStep({ onDone }: Props) {
  const [verified, setVerified] = useState<string[]>([])
  const [activeUrl, setActiveUrl] = useState<string | null>(null)
  const [activeProvider, setActiveProvider] = useState<string | null>(null)
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const verify = useCallback(async (provider: typeof RECLAIM_PROVIDERS[0]) => {
    setError(null)
    setLoading(`Initializing ${provider.name}...`)
    try {
      const url = await startReclaimVerification(
        provider.id,
        (stamp) => {
          setVerified(prev => [...prev, stamp])
          setActiveUrl(null)
          setActiveProvider(null)
          setLoading(null)
        },
        (err) => {
          setError(err.message)
          setLoading(null)
          setActiveUrl(null)
          setActiveProvider(null)
        },
      )
      setActiveUrl(url)
      setActiveProvider(provider.name)
      setLoading(null)
    } catch (e) {
      setError((e as Error).message)
      setLoading(null)
    }
  }, [])

  return (
    <div className="space-y-3">
      {verified.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {verified.map(s => (
            <span key={s} className="text-xs px-2 py-1 rounded-full font-medium" style={{ background: 'rgba(20,241,149,0.15)', color: '#14F195', border: '1px solid rgba(20,241,149,0.3)' }}>
              ✓ {s}
            </span>
          ))}
        </div>
      )}

      {!activeUrl && !loading && (
        <div className="space-y-2">
          {RECLAIM_PROVIDERS.map(p => (
            <button
              key={p.id}
              onClick={() => verify(p)}
              disabled={verified.some(s => s.includes(p.name))}
              className="w-full flex items-center justify-between bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-sm px-4 py-2.5 rounded-lg transition-colors"
            >
              <span className="text-white font-medium">{p.name}</span>
              <span className="text-zinc-500 text-xs">{p.description}</span>
            </button>
          ))}
        </div>
      )}

      {loading && <p className="text-sm text-zinc-400">{loading}</p>}

      {activeUrl && (
        <div className="bg-zinc-800 rounded-lg p-4 space-y-3">
          <p className="text-sm text-zinc-300">Verify your <span className="text-white font-medium">{activeProvider}</span> account:</p>
          <a
            href={activeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full text-center text-sm font-semibold py-2 rounded-lg transition-colors"
            style={{ background: '#9945FF', color: '#fff' }}
          >
            Open Verification →
          </a>
          <p className="text-xs text-zinc-500 text-center">Complete verification in the new tab, then return here.</p>
          <button
            onClick={() => { setActiveUrl(null); setActiveProvider(null) }}
            className="w-full text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            Cancel
          </button>
        </div>
      )}

      {error && <p className="text-xs text-red-400">{error}</p>}

      <div className="flex gap-2 pt-1">
        {verified.length > 0 && (
          <button
            onClick={() => onDone(verified)}
            className="flex-1 text-black text-sm font-semibold px-4 py-2 rounded-lg"
            style={{ background: '#14F195' }}
          >
            Continue →
          </button>
        )}
        <button
          onClick={() => onDone(verified)}
          className={`text-zinc-500 hover:text-zinc-300 text-xs py-1 transition-colors ${verified.length === 0 ? 'w-full' : ''}`}
        >
          {verified.length > 0 ? 'Skip remaining →' : 'Skip this step →'}
        </button>
      </div>
    </div>
  )
}
