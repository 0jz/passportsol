import { useState, useCallback } from 'react'
import { useConnection } from '@solana/wallet-adapter-react'
import { getPassportFromChain } from '../lib/solana'

function isEthAddress(addr: string) {
  return /^0x[0-9a-fA-F]{40}$/.test(addr)
}

function isSolAddress(addr: string) {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(addr)
}

export default function VerifyPage() {
  const { connection } = useConnection()
  const [address, setAddress] = useState('')
  const [result, setResult] = useState<{ score: number; stamps: string[]; ts: number; eth?: string } | 'not_found' | null>(null)
  const [loading, setLoading] = useState(false)
  const [inputError, setInputError] = useState<string | null>(null)

  const verify = useCallback(async () => {
    const addr = address.trim()
    if (!addr) return

    setInputError(null)
    setResult(null)

    if (isEthAddress(addr)) {
      setInputError('Ovo je Ethereum adresa — Passport se čuva na Solana adresu. Unesi Solana (base58) adresu vlasnika.')
      return
    }

    if (!isSolAddress(addr)) {
      setInputError('Neispravna adresa — unesi Solana adresu (base58 format).')
      return
    }

    setLoading(true)
    try {
      const data = await getPassportFromChain(addr, connection)
      setResult(data ?? 'not_found')
    } finally {
      setLoading(false)
    }
  }, [address, connection])

  const THRESHOLD = 20
  const isVerified = result && result !== 'not_found' && result.score >= THRESHOLD

  return (
    <div className="max-w-lg mx-auto px-4 py-16">
      <div className="text-center mb-10">
        <h2 className="text-2xl font-bold mb-2">Verify Passport</h2>
        <p className="text-zinc-400 text-sm">Check if a Solana wallet has a minted passport</p>
      </div>

      <div className="space-y-2 mb-6">
        <div className="flex gap-2">
          <input
            type="text"
            value={address}
            onChange={e => { setAddress(e.target.value); setInputError(null); setResult(null) }}
            onKeyDown={e => e.key === 'Enter' && verify()}
            placeholder="Solana wallet address (base58)..."
            className={`flex-1 bg-zinc-900 border text-white text-sm px-3 py-2 rounded-lg font-mono focus:outline-none transition-colors ${
              inputError ? 'border-red-700 focus:border-red-500' : 'border-zinc-700 focus:border-zinc-500'
            }`}
          />
          <button
            onClick={verify}
            disabled={loading || !address.trim()}
            className="disabled:opacity-50 text-black text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
            style={{ background: '#14F195' }}
          >
            {loading ? '...' : 'Verify'}
          </button>
        </div>

        {inputError && (
          <p className="text-xs text-amber-400">{inputError}</p>
        )}
      </div>

      {loading && (
        <div className="rounded-xl border border-zinc-700 bg-zinc-900 p-5 text-center">
          <p className="text-zinc-400 text-sm">Scanning transactions...</p>
        </div>
      )}

      {result === 'not_found' && (
        <div className="rounded-xl border border-zinc-700 bg-zinc-900 p-5 text-center">
          <p className="text-zinc-400 text-sm mb-1">No passport found for this wallet</p>
          <p className="text-zinc-600 text-xs">Passport hasn't been minted yet, or the address is wrong</p>
        </div>
      )}

      {result && result !== 'not_found' && (
        <div className="rounded-xl border bg-zinc-900 overflow-hidden" style={{ borderColor: isVerified ? 'rgba(20,241,149,0.3)' : '#3f3f46' }}>
          <div className="px-5 py-4 border-b border-zinc-800 flex justify-between items-start">
            <div>
              <p className="text-xs text-zinc-500 uppercase tracking-widest mb-1">Gitcoin Score</p>
              <p className="text-5xl font-bold" style={{ color: '#14F195' }}>
                {result.score.toFixed(1)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-zinc-500 mb-2">Status</p>
              {isVerified ? (
                <span className="inline-block text-xs font-semibold px-3 py-1 rounded-full" style={{ background: 'rgba(20,241,149,0.15)', color: '#14F195', border: '1px solid rgba(20,241,149,0.3)' }}>
                  ✓ Verified Human
                </span>
              ) : (
                <span className="inline-block text-xs font-medium px-3 py-1 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700">
                  Below {THRESHOLD} threshold
                </span>
              )}
            </div>
          </div>

          {result.stamps.length > 0 && (
            <div className="px-5 py-3 border-b border-zinc-800">
              <div className="flex flex-wrap gap-2">
                {result.stamps.map(stamp => (
                  <span key={stamp} className="text-xs bg-zinc-800 border border-zinc-700 text-zinc-300 px-2 py-1 rounded-full">
                    {stamp}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="px-5 py-3 space-y-1">
            {result.eth && (
              <p className="text-xs text-zinc-500 font-mono">ETH: {result.eth}</p>
            )}
            <p className="text-xs text-zinc-500">
              Verified at: {new Date(result.ts * 1000).toLocaleString()}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
