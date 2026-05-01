import { useState, useCallback, useEffect, useMemo } from 'react'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'
import { type PassportData } from './lib/gitcoin'
import {
  mintPassportMemo, getPassportFromChain, invalidatePassport,
} from './lib/solana'
import EthStep from './components/EthStep'
import StampsStep from './components/StampsStep'
import SuccessCard from './components/SuccessCard'
import VerifyPage from './components/VerifyPage'

// ─── localStorage helpers ────────────────────────────────────────────────────

interface StoredData {
  passport: PassportData
  txHash: string
}

function storageKey(addr: string) { return `solpassport_v1_${addr}` }

function loadStored(addr: string): StoredData | null {
  try { return JSON.parse(localStorage.getItem(storageKey(addr)) ?? 'null') }
  catch { return null }
}

function saveStored(addr: string, data: StoredData) {
  try { localStorage.setItem(storageKey(addr), JSON.stringify(data)) }
  catch {}
}

function clearStored(addr: string) {
  localStorage.removeItem(storageKey(addr))
}

// ─── Mobile helpers ──────────────────────────────────────────────────────────

function isMobileBrowser() {
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
}

function isInsidePhantom() {
  return !!(window as unknown as { phantom?: { solana?: unknown } }).phantom?.solana
}

function phantomBrowseUrl() {
  const url = encodeURIComponent(window.location.href)
  const ref = encodeURIComponent(window.location.origin)
  // iOS: HTTPS Universal Link opens Phantom's in-app browser directly
  // Android: phantom:// custom scheme (registered by Phantom app)
  if (/Android/i.test(navigator.userAgent)) {
    return `phantom://browse/${url}?ref=${ref}`
  }
  return `https://phantom.app/ul/browse/${url}?ref=${ref}`
}

// ─── App ─────────────────────────────────────────────────────────────────────

type Page = 'mint' | 'verify'
type Step = 0 | 1 | 2 | 3 | 4

export default function App() {
  const { connection } = useConnection()
  const wallet = useWallet()
  const pubkeyStr = useMemo(() => wallet.publicKey?.toBase58() ?? null, [wallet.publicKey])
  const effectivePubkey = pubkeyStr

  const [page, setPage] = useState<Page>('mint')
  const [passport, setPassport] = useState<PassportData | null>(null)
  const [stampsReady, setStampsReady] = useState(false)
  const [customStamps, setCustomStamps] = useState<string[]>([])
  const [txHash, setTxHash] = useState<string | null>(null)
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [addingStamps, setAddingStamps] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [passportDeleted, setPassportDeleted] = useState(false)

  // Restore from localStorage or chain when wallet connects; clear on disconnect
  useEffect(() => {
    if (!effectivePubkey) {
      setPassport(null)
      setTxHash(null)
      setStampsReady(false)
      setCustomStamps([])
      setAddingStamps(false)
      setError(null)
      return
    }

    const stored = loadStored(effectivePubkey)
    if (stored) {
      setPassport(stored.passport)
      setTxHash(stored.txHash)
      setStampsReady(true)
    }

    setSyncing(true)
    getPassportFromChain(effectivePubkey, connection).then(data => {
      if (!data) return
      if (stored && data.txSig === stored.txHash) return
      const passport: PassportData = {
        ethAddress: data.eth ?? '',
        score: data.score,
        threshold: data.threshold ?? 20,
        stamps: data.stamps,
        lastUpdated: new Date(data.ts * 1000).toISOString(),
      }
      setPassport(passport)
      setTxHash(data.txSig)
      setStampsReady(true)
      saveStored(effectivePubkey, { passport, txHash: data.txSig })
    }).finally(() => setSyncing(false))
  }, [effectivePubkey, connection])

  const step: Step =
    txHash ? 4 :
    passport && stampsReady ? 3 :
    passport ? 2 :
    wallet.connected ? 1 : 0

  const handleStampsDone = useCallback((newStamps: string[]) => {
    setCustomStamps(newStamps)
    setPassport(prev => {
      if (!prev || newStamps.length === 0) return prev
      return { ...prev, stamps: [...prev.stamps, ...newStamps] }
    })
    setStampsReady(true)
  }, [])

  const handleMoreStampsDone = useCallback(async (newStamps: string[]) => {
    setAddingStamps(false)
    if (!passport || newStamps.length === 0) return
    const updated = { ...passport, stamps: [...passport.stamps, ...newStamps] }
    setError(null)
    try {
      setLoading('Re-minting passport with new stamps...')
      const txid = await mintPassportMemo(wallet, connection, updated)
      setPassport(updated)
      setTxHash(txid)
      if (wallet.publicKey) {
        saveStored(wallet.publicKey.toBase58(), { passport: updated, txHash: txid })
      }
    } catch (e) {
      setError((e as { message?: string })?.message ?? String(e))
    } finally {
      setLoading(null)
    }
  }, [passport, wallet, connection])

  const mintPassport = useCallback(async () => {
    if (!passport) return
    setError(null)
    try {
      setLoading('Preparing transaction — check your wallet app...')
      const txid = await mintPassportMemo(wallet, connection, passport)
      setTxHash(txid)
      if (wallet.publicKey) {
        saveStored(wallet.publicKey.toBase58(), { passport, txHash: txid })
      }
    } catch (e) {
      console.error(e)
      setError((e as { message?: string })?.message ?? String(e))
    } finally {
      setLoading(null)
    }
  }, [wallet, connection, passport])

  const handleBackToEth = useCallback(() => {
    setPassport(null)
    setStampsReady(false)
    setCustomStamps([])
  }, [])

  const handleBackToStamps = useCallback(() => {
    setStampsReady(false)
    setCustomStamps([])
  }, [])

  const handleDelete = useCallback(async () => {
    if (!effectivePubkey) return
    if (!window.confirm(
      'Ovo će poništiti pasoš na ovoj Solana adresi.\n\n' +
      'Biće kreirana nova on-chain transakcija (mali network fee).\n' +
      'Nakon toga možeš mintovati potpuno novi pasoš.'
    )) return
    setError(null)
    try {
      setLoading('Poništavam pasoš...')
      await invalidatePassport(wallet, connection)
      clearStored(effectivePubkey)
      setPassport(null)
      setTxHash(null)
      setStampsReady(false)
      setCustomStamps([])
      setAddingStamps(false)
      setPassportDeleted(true)
    } catch (e) {
      setError((e as { message?: string })?.message ?? String(e))
    } finally {
      setLoading(null)
    }
  }, [effectivePubkey, wallet, connection])

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
      ) : step === 0 ? (

        /* ── Landing page ──────────────────────────────────────────────────── */
        <div className="flex flex-col items-center justify-center px-6 py-24 min-h-[80vh]">
          <div className="text-center max-w-sm w-full">

            {/* Logo */}
            <div className="mb-2 flex justify-center">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg,#9945FF 0%,#14F195 100%)' }}>
                <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                  <path d="M8 22l16-12M8 16l8-6 8 6M8 10l16 12" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"/>
                </svg>
              </div>
            </div>

            <h1 className="text-4xl font-bold tracking-tight mt-4 mb-2">
              <span style={{ color: '#9945FF' }}>Solana</span>{' '}
              <span style={{ color: '#14F195' }}>Passport</span>
            </h1>
            <p className="text-zinc-400 text-base mb-1">Your on-chain reputation, on Solana.</p>
            <p className="text-zinc-600 text-sm mb-10">
              Link Ethereum identity · Add Gitcoin stamps · Mint once, verify anywhere.
            </p>

            {/* Connect CTA */}
            {isMobileBrowser() && !isInsidePhantom() ? (
              <a
                href={phantomBrowseUrl()}
                className="inline-flex items-center gap-2 font-bold px-8 py-3.5 rounded-xl text-sm w-full justify-center"
                style={{ background: '#9945FF', color: '#fff', textDecoration: 'none' }}
              >
                Open in Phantom
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </a>
            ) : (
              <WalletMultiButton style={{
                background: '#9945FF', borderRadius: 12,
                height: 48, fontSize: 15, width: '100%', justifyContent: 'center',
              }} />
            )}

            {/* Feature pills */}
            <div className="flex flex-wrap justify-center gap-2 mt-10">
              {['Gitcoin Stamps', 'ETH Identity', 'On-chain', 'Cross-device'].map(f => (
                <span key={f} className="text-xs px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-500">
                  {f}
                </span>
              ))}
            </div>
          </div>
        </div>

      ) : (

        /* ── Mint stepper ──────────────────────────────────────────────────── */
        <div className="max-w-lg mx-auto px-4 py-12">
          <div className="space-y-3">
            {/* Step 1 — wallet */}
            <StepCard number={1} title="Connect Solana Wallet" done={step >= 1} active={false}>
              <div className="flex flex-col gap-2">
                <WalletMultiButton style={{ background: '#9945FF', borderRadius: 8, height: 36, fontSize: 13 }} />
                {syncing && (
                  <p className="text-xs text-zinc-500 animate-pulse">Checking for existing passport...</p>
                )}
              </div>
            </StepCard>

            {/* Step 2 — optional ETH */}
            <StepCard number={2} title="Link Ethereum Identity" badge="optional" done={step >= 2} active={step === 1 && !syncing} locked={step < 1 || syncing}>
              {step === 1 && (
                <EthStep
                  solanaAddress={effectivePubkey ?? wallet.publicKey?.toBase58() ?? ''}
                  onDone={setPassport}
                />
              )}
              {step > 1 && passport?.ethAddress && (
                <p className="text-xs text-zinc-500 font-mono truncate">{passport.ethAddress}</p>
              )}
              {step > 1 && passport && !passport.ethAddress && (
                <p className="text-xs text-zinc-500">Skipped — no ETH data</p>
              )}
            </StepCard>

            {/* Step 3 — stamps */}
            <StepCard number={3} title="Add Stamps" badge="optional" done={step >= 3} active={step === 2} locked={step < 2}>
              {step === 2 && passport && (
                <>
                  <StampsStep passport={passport} onDone={handleStampsDone} />
                  <button onClick={handleBackToEth} className="text-zinc-600 hover:text-zinc-400 text-xs py-1 transition-colors">
                    ← Back
                  </button>
                </>
              )}
              {step > 2 && customStamps.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {customStamps.map(s => (
                    <span key={s} className="text-xs px-2 py-0.5 rounded-full font-medium"
                      style={{ background: 'rgba(20,241,149,0.1)', color: '#14F195', border: '1px solid rgba(20,241,149,0.2)' }}>
                      ✓ {s}
                    </span>
                  ))}
                </div>
              )}
              {step > 2 && customStamps.length === 0 && (
                <p className="text-xs text-zinc-500">Skipped</p>
              )}
            </StepCard>

            {/* Step 4 — mint */}
            <StepCard number={4} title="Mint Passport On-Chain" done={step >= 4} active={step === 3} locked={step < 3}>
              {step === 3 && !txHash && (
                <div className="flex items-center gap-3">
                  <button
                    onClick={mintPassport}
                    disabled={!!loading}
                    className="disabled:opacity-50 text-black text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
                    style={{ background: '#14F195' }}
                  >
                    {loading ?? 'Mint Passport →'}
                  </button>
                  <button onClick={handleBackToStamps} className="text-zinc-600 hover:text-zinc-400 text-xs transition-colors">
                    ← Back
                  </button>
                </div>
              )}
            </StepCard>
          </div>

          {passportDeleted && !txHash && (
            <div className="mt-4 p-4 bg-emerald-950 border border-emerald-800 rounded-lg text-emerald-400 text-sm">
              Pasoš je izbrisan. Možeš mintovati novi prolazeći kroz korake iznad.
              <button
                onClick={() => setPassportDeleted(false)}
                className="ml-3 text-emerald-600 hover:text-emerald-400 text-xs"
              >✕</button>
            </div>
          )}

          {txHash && passport && (
            <div className="mt-4 space-y-3">
              <SuccessCard passport={passport} txHash={txHash} />

              {!addingStamps && (
                <button
                  onClick={() => setAddingStamps(true)}
                  className="w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm px-4 py-2.5 rounded-lg transition-colors"
                >
                  + Add more stamps
                </button>
              )}

              {addingStamps && (
                <div className="rounded-xl border border-zinc-700 bg-zinc-900 p-5 space-y-3">
                  <div className="flex items-start gap-2 bg-amber-950/40 border border-amber-800/50 rounded-lg px-3 py-2">
                    <span className="text-amber-400 text-sm mt-0.5">⚠</span>
                    <p className="text-xs text-amber-300/90">
                      Adding stamps requires a new on-chain transaction. A small network fee will be charged for each update.
                    </p>
                  </div>
                  <p className="text-sm font-medium text-white">Add Stamps</p>
                  <StampsStep passport={passport} onDone={handleMoreStampsDone} />
                </div>
              )}

              <button
                onClick={handleDelete}
                disabled={!!loading}
                className="w-full text-zinc-600 hover:text-red-400 text-xs py-1 transition-colors disabled:opacity-40"
              >
                {loading ?? 'Delete Passport'}
              </button>
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
