import { useState, useCallback } from 'react'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'
import { type PassportData } from './lib/gitcoin'
import { mintPassportMemo } from './lib/solana'
import EthStep from './components/EthStep'
import ReclaimStep from './components/ReclaimStep'
import SuccessCard from './components/SuccessCard'
import VerifyPage from './components/VerifyPage'

type Page = 'mint' | 'verify'
type Step = 0 | 1 | 2 | 3 | 4

export default function App() {
  const { connection } = useConnection()
  const wallet = useWallet()

  const [page, setPage] = useState<Page>('mint')
  const [passport, setPassport] = useState<PassportData | null>(null)
  const [reclaimDone, setReclaimDone] = useState(false)
  const [txHash, setTxHash] = useState<string | null>(null)
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const step: Step =
    txHash       ? 4 :
    reclaimDone  ? 3 :
    passport     ? 2 :
    wallet.connected ? 1 : 0

  const handleReclaimDone = useCallback((stamps: string[]) => {
    if (stamps.length > 0 && passport) {
      setPassport(prev => prev ? { ...prev, stamps: [...prev.stamps, ...stamps] } : prev)
    }
    setReclaimDone(true)
  }, [passport])

  const mintPassport = useCallback(async () => {
    if (!passport) return
    setError(null)
    try {
      setLoading('Requesting devnet SOL if needed...')
      const txid = await mintPassportMemo(wallet, connection, passport)
      setTxHash(txid)
    } catch (e) {
      console.error(e)
      setError((e as { message?: string })?.message ?? String(e))
    } finally {
      setLoading(null)
    }
  }, [wallet, connection, passport])

  return (
    <div className="min-h-screen bg-zinc-950 text-white">

      {/* Nav */}
      <nav className="border-b border-zinc-800">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
          <span className="font-bold text-sm">
            <span style={{ color: '#9945FF' }}>Solana</span>{' '}
            <span style={{ color: '#14F195' }}>Passport</span>
          </span>
          <div className="flex gap-1">
            {(['mint', 'verify'] as Page[]).map(p => (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={`text-sm px-3 py-1.5 rounded-lg transition-colors capitalize ${
                  page === p
                    ? 'bg-zinc-800 text-white'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {p === 'mint' ? 'Mint Passport' : 'Verify'}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {page === 'verify' ? (
        <VerifyPage />
      ) : (
        <div className="max-w-lg mx-auto px-4 py-12">
          <div className="text-center mb-10">
            <h1 className="text-3xl font-bold tracking-tight mb-2">
              Mint your Passport
            </h1>
            <p className="text-zinc-400 text-sm">Bring your Gitcoin reputation to Solana</p>
          </div>

          <div className="space-y-3">
            {/* Step 1 */}
            <StepCard number={1} title="Connect Solana Wallet" done={step >= 1} active={step === 0}>
              <div className="flex flex-col gap-2">
                <WalletMultiButton style={{ background: '#9945FF', borderRadius: 8, height: 40, fontSize: 14 }} />
                {wallet.publicKey && (
                  <p className="text-xs text-zinc-500 font-mono truncate">
                    {wallet.publicKey.toBase58()}
                  </p>
                )}
              </div>
            </StepCard>

            {/* Step 2 — optional ETH */}
            <StepCard number={2} title="Link Ethereum Identity" badge="optional" done={step >= 2} active={step === 1} locked={step < 1}>
              {step === 1 && (
                <EthStep
                  solanaAddress={wallet.publicKey?.toBase58() ?? ''}
                  onDone={setPassport}
                />
              )}
              {passport?.ethAddress && (
                <p className="text-xs text-zinc-500 font-mono truncate">{passport.ethAddress}</p>
              )}
              {passport && !passport.ethAddress && (
                <p className="text-xs text-zinc-500">Skipped — no ETH data</p>
              )}
            </StepCard>

            {/* Step 3 — optional Reclaim */}
            <StepCard number={3} title="Verify Web2 Identity" badge="optional" done={step >= 3} active={step === 2} locked={step < 2}>
              {step === 2 && (
                <ReclaimStep onDone={handleReclaimDone} />
              )}
              {reclaimDone && passport && passport.stamps.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {passport.stamps.map(s => (
                    <span key={s} className="text-xs bg-zinc-800 border border-zinc-700 text-zinc-300 px-2 py-0.5 rounded-full">{s}</span>
                  ))}
                </div>
              )}
              {reclaimDone && (!passport || passport.stamps.length === 0) && (
                <p className="text-xs text-zinc-500">Skipped — no web2 stamps</p>
              )}
            </StepCard>

            {/* Step 4 — mint */}
            <StepCard number={4} title="Mint Passport On-Chain" done={step >= 4} active={step === 3} locked={step < 3}>
              {step === 3 && !txHash && (
                <button
                  onClick={mintPassport}
                  disabled={!!loading}
                  className="disabled:opacity-50 text-black text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
                  style={{ background: '#14F195' }}
                >
                  {loading ?? 'Mint Passport →'}
                </button>
              )}
            </StepCard>
          </div>

          {/* Success */}
          {txHash && passport && (
            <div className="mt-4">
              <SuccessCard passport={passport} txHash={txHash} />
            </div>
          )}

          {error && (
            <div className="mt-4 p-3 bg-red-950 border border-red-800 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function StepCard({
  number, title, badge, done, active, locked, children,
}: {
  number: number
  title: string
  badge?: string
  done?: boolean
  active?: boolean
  locked?: boolean
  children?: React.ReactNode
}) {
  return (
    <div className={`rounded-xl border p-5 transition-all ${
      done   ? 'border-emerald-800/40 bg-zinc-900/60' :
      active ? 'border-zinc-600 bg-zinc-900' :
               'border-zinc-800 bg-zinc-900/30 opacity-50'
    }`}>
      <div className="flex items-center gap-3 mb-3">
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
          style={{
            background: done ? '#14F195' : active ? '#3f3f46' : '#27272a',
            color: done ? '#000' : '#fff',
          }}
        >
          {done ? '✓' : number}
        </div>
        <h3 className={`text-sm font-medium ${locked ? 'text-zinc-500' : 'text-white'}`}>
          {title}
        </h3>
        {badge && (
          <span className="text-xs text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded-full ml-auto">
            {badge}
          </span>
        )}
      </div>
      {!locked && children}
    </div>
  )
}
