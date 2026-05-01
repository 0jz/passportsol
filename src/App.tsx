import { useState, useCallback, useEffect, useMemo } from 'react'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'
import { PublicKey } from '@solana/web3.js'
import bs58 from 'bs58'
import { type PassportData } from './lib/gitcoin'
import {
  mintPassportMemo, getPassportFromChain, invalidatePassport,
  buildMemoTransaction, ensureDevnetSol, waitForSignature,
} from './lib/solana'
import {
  phantomConnect, phantomSignAndSend, handleDeeplinkReturn,
  getSession, clearSession, type PendingOp,
} from './lib/phantom-deeplink'
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
  return `https://phantom.app/ul/browse/${encodeURIComponent(window.location.href)}?ref=${encodeURIComponent(window.location.origin)}`
}

// ─── App ─────────────────────────────────────────────────────────────────────

type Page = 'mint' | 'verify'
type Step = 0 | 1 | 2 | 3 | 4

export default function App() {
  const { connection } = useConnection()
  const wallet = useWallet()
  const pubkeyStr = useMemo(() => wallet.publicKey?.toBase58() ?? null, [wallet.publicKey])

  // Deep link mode: Chrome/Brave on Android (not inside Phantom's browser)
  const useDeepLink = useMemo(() => isMobileBrowser() && !isInsidePhantom(), [])
  const [deepLinkPub, setDeepLinkPub] = useState<string | null>(() => {
    try { return getSession()?.walletPub ?? null } catch { return null }
  })

  // Inside Phantom after relay: deepLinkPub is set before wallet.connect() resolves,
  // so fall back to it until the standard adapter connects.
  const effectivePubkey = useDeepLink ? deepLinkPub : (pubkeyStr ?? deepLinkPub)

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

  // Process Phantom deep link redirect on mount (Chrome/Brave + Android relay flow)
  useEffect(() => {
    const hasRelay = (() => { try { return !!localStorage.getItem('__phantom_relay') } catch { return false } })()
    if (!useDeepLink && !hasRelay) return
    const result = handleDeeplinkReturn()

    if (result.type === 'connected') {
      setDeepLinkPub(result.walletPub)
      // Relay lands user inside Phantom browser (useDeepLink=false) — auto-connect
      // standard wallet adapter so signing works natively without deep links.
      if (!useDeepLink) setTimeout(() => { wallet.connect().catch(() => {}) }, 100)
      return
    }

    if (result.type === 'signed') {
      const { signature, pending } = result
      const savedPassport = (() => {
        try { return JSON.parse(localStorage.getItem('pdl_passport') ?? 'null') as PassportData | null }
        catch { return null }
      })()
      const pub = getSession()?.walletPub ?? null

      setLoading('Potvrđujem transakciju...')
      waitForSignature(connection, signature).then(() => {
        if (pending.op === 'delete') {
          if (pub) clearStored(pub)
          setPassport(null); setTxHash(null); setStampsReady(false); setCustomStamps([])
          setPassportDeleted(true)
        } else if (savedPassport && pub) {
          setPassport(savedPassport); setTxHash(signature); setStampsReady(true)
          saveStored(pub, { passport: savedPassport, txHash: signature })
          localStorage.removeItem('pdl_passport')
        }
      }).catch(e => setError(`Confirmation failed: ${(e as Error).message}`))
        .finally(() => setLoading(null))
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Helper: build + redirect to Phantom for signing (Chrome/Brave deep link path)
  const triggerDeepLinkSign = useCallback(async (
    op: PendingOp['op'],
    passportForOp?: PassportData,
  ) => {
    if (!deepLinkPub) return
    const feePayer = new PublicKey(deepLinkPub)
    const memoData = op === 'delete'
      ? { v: 1, invalidated: true, ts: Math.floor(Date.now() / 1000) }
      : {
          v: 1,
          eth: passportForOp?.ethAddress ?? null,
          score: passportForOp?.score,
          threshold: passportForOp?.threshold,
          stamps: passportForOp?.stamps.slice(0, 20),
          ts: Math.floor(Date.now() / 1000),
        }

    // Airdrop if needed (non-fatal)
    try { await ensureDevnetSol({ publicKey: feePayer } as Parameters<typeof ensureDevnetSol>[0], connection) } catch {}

    const { transaction, blockhash, lastValidBlockHeight } = await buildMemoTransaction(feePayer, connection, memoData)
    const txB58 = bs58.encode(transaction.serialize({ requireAllSignatures: false, verifySignatures: false }))

    if (op !== 'delete' && passportForOp) {
      localStorage.setItem('pdl_passport', JSON.stringify(passportForOp))
    }

    phantomSignAndSend({ op, txB58, blockhash, lastValidBlockHeight })
    // redirects away — nothing after this executes
  }, [deepLinkPub, connection])

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

    // Fast path: show localStorage immediately, then revalidate from chain
    const stored = loadStored(effectivePubkey)
    if (stored) {
      setPassport(stored.passport)
      setTxHash(stored.txHash)
      setStampsReady(true)
    }

    // Always check chain in background — picks up updates made on other devices
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
    (wallet.connected || !!deepLinkPub) ? 1 : 0

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
    if (useDeepLink && deepLinkPub) {
      setLoading('Opening Phantom...')
      try { await triggerDeepLinkSign('remint', updated) }
      catch (e) { setError((e as Error).message); setLoading(null) }
      return
    }
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
  }, [passport, wallet, connection, useDeepLink, deepLinkPub, triggerDeepLinkSign])

  const mintPassport = useCallback(async () => {
    if (!passport) return
    setError(null)
    if (useDeepLink && deepLinkPub) {
      setLoading('Opening Phantom...')
      try { await triggerDeepLinkSign('mint', passport) }
      catch (e) { setError((e as Error).message); setLoading(null) }
      return
    }
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
  }, [wallet, connection, passport, useDeepLink, deepLinkPub, triggerDeepLinkSign])

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
    if (useDeepLink && deepLinkPub) {
      setLoading('Opening Phantom...')
      try { await triggerDeepLinkSign('delete') }
      catch (e) { setError((e as Error).message); setLoading(null) }
      return
    }
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
  }, [effectivePubkey, wallet, connection, useDeepLink, deepLinkPub, triggerDeepLinkSign])

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

      {useDeepLink && !deepLinkPub && (
        <div className="bg-zinc-900 border-b border-zinc-800 px-4 py-3">
          <div className="max-w-lg mx-auto space-y-2">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-zinc-400">Preporučeno: otvori app unutar Phantoma.</p>
              <a
                href={phantomBrowseUrl()}
                className="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg"
                style={{ background: '#9945FF', color: '#fff' }}
              >
                Otvori u Phantomu
              </a>
            </div>
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-zinc-600">Ili poveži Phantom bez otvaranja browsera.</p>
              <button
                onClick={phantomConnect}
                className="shrink-0 text-xs px-3 py-1.5 rounded-lg border border-zinc-700 text-zinc-400 hover:text-zinc-200"
              >
                Poveži via deep link
              </button>
            </div>
          </div>
        </div>
      )}

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
                {useDeepLink ? (
                  deepLinkPub ? (
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                      <p className="text-xs text-zinc-400 font-mono truncate">{deepLinkPub}</p>
                      <button onClick={() => { clearSession(); setDeepLinkPub(null) }}
                        className="text-xs text-zinc-600 hover:text-zinc-400 ml-auto shrink-0">Odjavi</button>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      <a href={phantomBrowseUrl()}
                        className="text-sm font-semibold px-4 py-2 rounded-lg w-fit inline-block"
                        style={{ background: '#9945FF', color: '#fff' }}>
                        Otvori u Phantomu →
                      </a>
                      <button onClick={phantomConnect}
                        className="text-xs text-zinc-500 hover:text-zinc-300 text-left">
                        ili poveži via deep link
                      </button>
                    </div>
                  )
                ) : (
                  <WalletMultiButton style={{ background: '#9945FF', borderRadius: 8, height: 40, fontSize: 14 }} />
                )}
                {wallet.publicKey && !useDeepLink && (
                  <p className="text-xs text-zinc-500 font-mono truncate">
                    {wallet.publicKey.toBase58()}
                  </p>
                )}
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
                Delete Passport
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
