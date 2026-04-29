import type { PassportData } from '../lib/gitcoin'

interface Props {
  passport: PassportData
  txHash: string
}

const THRESHOLD = 20

export default function SuccessCard({ passport, txHash }: Props) {
  const isVerified = passport.score >= THRESHOLD
  const short = (s: string) => `${s.slice(0, 6)}...${s.slice(-4)}`

  return (
    <div className="rounded-xl border border-emerald-700/40 bg-zinc-900 overflow-hidden">
      <div className="px-5 pt-5 pb-4 border-b border-zinc-800">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs" style={{ background: '#14F195', color: '#000' }}>
            ✓
          </div>
          <span className="text-sm text-zinc-400">Passport minted on Solana devnet</span>
        </div>

        <div className="flex justify-between items-start">
          <div>
            <p className="text-xs text-zinc-500 uppercase tracking-widest mb-1">Gitcoin Score</p>
            <p className="text-6xl font-bold" style={{ color: '#14F195' }}>
              {passport.score.toFixed(1)}
            </p>
          </div>
          <div className="text-right space-y-2">
            <div>
              <p className="text-xs text-zinc-500 mb-1">Stamps</p>
              <p className="text-2xl font-semibold">{passport.stamps.length}</p>
            </div>
            {isVerified ? (
              <span className="inline-block text-xs font-medium px-2 py-1 rounded-full" style={{ background: 'rgba(20,241,149,0.15)', color: '#14F195', border: '1px solid rgba(20,241,149,0.3)' }}>
                ✓ Verified Human
              </span>
            ) : (
              <span className="inline-block text-xs font-medium px-2 py-1 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700">
                Below {THRESHOLD} threshold
              </span>
            )}
          </div>
        </div>
      </div>

      {passport.stamps.length > 0 && (
        <div className="px-5 py-3 border-b border-zinc-800">
          <div className="flex flex-wrap gap-2">
            {passport.stamps.map((stamp) => (
              <span key={stamp} className="text-xs bg-zinc-800 border border-zinc-700 text-zinc-300 px-2 py-1 rounded-full">
                {stamp}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="px-5 py-3 space-y-1">
        {passport.ethAddress && (
          <p className="text-xs text-zinc-500 font-mono">
            ETH: {short(passport.ethAddress)}
          </p>
        )}
        <a
          href={`https://explorer.solana.com/tx/${txHash}?cluster=devnet`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-mono break-all hover:text-white transition-colors"
          style={{ color: '#9945FF' }}
        >
          {short(txHash)} — View on Explorer →
        </a>
      </div>
    </div>
  )
}
