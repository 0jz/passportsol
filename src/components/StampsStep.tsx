import { useState, useCallback, useEffect } from 'react'
import { useWallet, useConnection } from '@solana/wallet-adapter-react'
import { requestDeviceCode, pollForToken, fetchGithubUser } from '../lib/githubOAuth'
import { lookupEns } from '../lib/ens'
import { analyzeSolanaWallet } from '../lib/solanaStats'
import { parseAttestation, verifyAttestation, parseIcs, parsePkpass } from '../lib/attestation'
import { lookupSolDomain } from '../lib/sns'
import QrScanner from './QrScanner'
import { lookupSolanaId } from '../lib/solanaid'
import type { PassportData } from '../lib/gitcoin'

interface Props {
  passport: PassportData
  onDone: (stamps: string[]) => void
  solAddress?: string | null
}

interface StampState {
  status: 'idle' | 'checking' | 'found' | 'not_found' | 'error' | 'already_added'
  value?: string
}

// icon + color for each stamp type
function stampMeta(label: string): { emoji: string; color: string; bg: string } {
  if (label.startsWith('GitHub'))    return { emoji: '🐙', color: '#e2e8f0', bg: '#24292e' }
  if (label.startsWith('ENS'))       return { emoji: '🔷', color: '#627EEA', bg: 'rgba(98,126,234,0.15)' }
  if (label.startsWith('SNS') || label.includes('.sol')) return { emoji: '🌐', color: '#9945FF', bg: 'rgba(153,69,255,0.15)' }
  if (label.startsWith('SolanaID')) return { emoji: '🪪', color: '#14F195', bg: 'rgba(20,241,149,0.1)' }
  if (label.startsWith('Solana OG')) return { emoji: '🏆', color: '#F59E0B', bg: 'rgba(245,158,11,0.15)' }
  if (label.startsWith('Solana'))   return { emoji: '◎',  color: '#9945FF', bg: 'rgba(153,69,255,0.12)' }
  if (label.startsWith('Event'))    return { emoji: '🎫', color: '#00C2FF', bg: 'rgba(0,194,255,0.12)' }
  return { emoji: '✦', color: '#a1a1aa', bg: '#27272a' }
}

export default function StampsStep({ passport, onDone, solAddress: solAddressProp }: Props) {
  const wallet = useWallet()
  const { connection } = useConnection()

  const solAddress = solAddressProp ?? wallet.publicKey?.toBase58() ?? null

  const [verified, setVerified] = useState<string[]>([])
  // iconDataUrls: stamp label → data URL for event stamps from pkpass
  const [iconDataUrls, setIconDataUrls] = useState<Record<string, string>>({})

  const [ens, setEns] = useState<StampState>({ status: passport.ethAddress ? 'checking' : 'idle' })
  const [sns, setSns] = useState<StampState>({ status: solAddress ? 'checking' : 'idle' })
  const [solanaId, setSolanaId] = useState<StampState>({ status: solAddress ? 'checking' : 'idle' })
  const [solana, setSolana] = useState<StampState>({ status: solAddress ? 'checking' : 'idle' })
  const [githubStep, setGithubStep] = useState<'idle' | 'code' | 'polling' | 'done'>('idle')
  const [userCode, setUserCode] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [eventInput, setEventInput] = useState('')
  const [eventStatus, setEventStatus] = useState<'idle' | 'verifying' | 'error'>('idle')
  const [eventError, setEventError] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)
  const [lastQrRaw, setLastQrRaw] = useState<string | null>(null)

  const addStamp = useCallback((stamp: string, iconUrl?: string) => {
    if (passport.stamps.includes(stamp)) return
    setVerified(prev => prev.includes(stamp) ? prev : [...prev, stamp])
    if (iconUrl) {
      setIconDataUrls(prev => ({ ...prev, [stamp]: iconUrl }))
    }
  }, [passport.stamps])

  useEffect(() => {
    if (!solAddress) return
    const existing = passport.stamps.find(s => /^SolanaID:/.test(s))
    if (existing) { setSolanaId({ status: 'already_added', value: existing.replace('SolanaID: ', '') }); return }
    lookupSolanaId(solAddress).then(profile => {
      if (profile) { setSolanaId({ status: 'found', value: profile }); addStamp(`SolanaID: ${profile}`) }
      else setSolanaId({ status: 'not_found' })
    })
  }, [solAddress, passport.stamps, addStamp])

  useEffect(() => {
    if (!solAddress) return
    const existing = passport.stamps.find(s => /^SNS:/.test(s))
    if (existing) { setSns({ status: 'already_added', value: existing.replace('SNS: ', '') }); return }
    lookupSolDomain(solAddress).then(domain => {
      if (domain) { setSns({ status: 'found', value: domain }); addStamp(`SNS: ${domain}`) }
      else setSns({ status: 'not_found' })
    })
  }, [solAddress, passport.stamps, addStamp])

  useEffect(() => {
    if (!passport.ethAddress) return
    const existing = passport.stamps.find(s => /^ENS:/.test(s))
    if (existing) { setEns({ status: 'already_added', value: existing.replace('ENS: ', '') }); return }
    lookupEns(passport.ethAddress).then(name => {
      if (name) { setEns({ status: 'found', value: name }); addStamp(`ENS: ${name}`) }
      else setEns({ status: 'not_found' })
    })
  }, [passport.ethAddress, passport.stamps, addStamp])

  useEffect(() => {
    if (!solAddress) return
    const existingSolana = passport.stamps.filter(s => s.startsWith('Solana'))
    if (existingSolana.length > 0) { setSolana({ status: 'already_added', value: existingSolana.join(', ') }); return }
    analyzeSolanaWallet(solAddress, connection).then(stats => {
      if (stats.stamps.length > 0) {
        setSolana({ status: 'found', value: stats.stamps.join(', ') })
        stats.stamps.forEach(s => addStamp(s))
      } else {
        const months = Math.floor(stats.walletAgeMonths)
        const ageLabel = months < 1 ? '< 1 month old' : months < 12 ? `${months}m old` : `${Math.floor(months / 12)}y old`
        setSolana({ status: 'not_found', value: stats.walletAgeMonths > 0 ? ageLabel : undefined })
      }
    }).catch(() => setSolana({ status: 'error' }))
  }, [solAddress, connection, passport.stamps, addStamp])

  const hasGithubStamp = passport.stamps.some(s => /^GitHub:/.test(s))

  const addEventStamp = useCallback((name: string, iconUrl?: string) => {
    const stamp = `Event?: ${name}`
    if (passport.stamps.includes(stamp) || verified.includes(stamp)) {
      setEventError('Ovaj event je već dodat')
      return
    }
    addStamp(stamp, iconUrl)
    setEventInput('')
  }, [passport.stamps, verified, addStamp])

  const handleQrResult = useCallback(async (data: string) => {
    setScanning(false)
    setEventError(null)
    setLastQrRaw(data)
    const attest = parseAttestation(data)
    if (attest) {
      const result = await verifyAttestation(attest, wallet.publicKey?.toBase58() ?? '')
      if (!result.ok) { setEventError(result.reason ?? 'Verifikacija neuspešna'); return }
      const issuerSuffix = result.issuerName ? ` · ${result.issuerName}` : ''
      addStamp(`Event: ${attest.event}${issuerSuffix}`)
      return
    }
    setEventError('QR nije prepoznat kao event atestacija')
  }, [addStamp, wallet.publicKey])

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setEventError(null)
    e.target.value = ''

    if (file.name.endsWith('.ics')) {
      const text = await file.text()
      const name = parseIcs(text)
      if (!name) { setEventError('Nije pronađen naziv eventa u .ics fajlu'); return }
      addEventStamp(name)
      return
    }

    if (file.name.endsWith('.pkpass')) {
      const result = await parsePkpass(file)
      if (!result) { setEventError('Nije pronađen naziv eventa u .pkpass fajlu'); return }
      addEventStamp(result.name, result.iconDataUrl)
      return
    }

    setEventError('Podržani formati: .ics, .pkpass')
  }, [addEventStamp])

  const handleEventSubmit = useCallback(async () => {
    const input = eventInput.trim()
    if (!input) return
    setEventError(null)
    setEventStatus('idle')
    const attest = parseAttestation(input)
    if (!attest) { setEventError('Unesi event atestaciju u JSON formatu'); return }
    setEventStatus('verifying')
    const result = await verifyAttestation(attest, wallet.publicKey?.toBase58() ?? '')
    if (!result.ok) { setEventError(result.reason ?? 'Verifikacija neuspešna'); setEventStatus('error'); return }
    const issuerSuffix = result.issuerName ? ` · ${result.issuerName}` : ''
    const stamp = `Event: ${attest.event}${issuerSuffix}`
    if (passport.stamps.includes(stamp) || verified.includes(stamp)) { setEventError('Ovaj event je već dodat'); setEventStatus('idle'); return }
    addStamp(stamp)
    setEventInput('')
    setEventStatus('idle')
  }, [eventInput, passport.stamps, verified, addStamp, wallet.publicKey])

  const startGithub = useCallback(async () => {
    setError(null)
    setLoading(true)
    try {
      const { device_code, user_code, verification_uri, interval } = await requestDeviceCode()
      setUserCode(user_code)
      setGithubStep('code')
      setLoading(false)
      window.open(verification_uri, '_blank')
      setGithubStep('polling')
      const token = await pollForToken(device_code, interval)
      const user = await fetchGithubUser(token)
      addStamp(`GitHub: ${user.login}`)
      setGithubStep('done')
    } catch (e) {
      setError((e as Error).message)
      setGithubStep('idle')
      setLoading(false)
    }
  }, [addStamp])

  // All collected stamps (from passport + newly verified)
  const allStamps = [
    ...passport.stamps,
    ...verified.filter(s => !passport.stamps.includes(s)),
  ]

  return (
    <div className="space-y-4">

      {/* Collection header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-white">Your Badge Collection</p>
          <p className="text-xs text-zinc-500 mt-0.5">Each badge adds to your score</p>
        </div>
        {allStamps.length > 0 && (
          <span className="text-xs font-bold px-2.5 py-1 rounded-full"
            style={{ background: 'rgba(20,241,149,0.15)', color: '#14F195', border: '1px solid rgba(20,241,149,0.25)' }}>
            {allStamps.length} badge{allStamps.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Auto-detected badges */}
      <div className="space-y-2">
        <p className="text-[11px] text-zinc-500 uppercase tracking-wider font-medium">Auto-detected</p>
        <BadgeCard label="Solana Wallet" description="Wallet age & activity" state={solana} />
        <BadgeCard label="Solana.id" description="On-chain identity profile" state={solanaId} />
        <BadgeCard label=".sol Domain" description="Solana Name Service" state={sns} />
        {passport.ethAddress && (
          <BadgeCard label="ENS" description="Ethereum Name Service" state={ens} />
        )}
      </div>

      {/* Event badges */}
      <div className="space-y-2">
        <p className="text-[11px] text-zinc-500 uppercase tracking-wider font-medium">Event Badges</p>

        {/* Already collected events */}
        {allStamps.filter(s => s.startsWith('Event')).length > 0 && (
          <div className="grid grid-cols-2 gap-2">
            {allStamps.filter(s => s.startsWith('Event')).map(s => {
              const name = s.replace(/^Event\??:\s*/, '')
              const iconUrl = iconDataUrls[s]
              const meta = stampMeta(s)
              return (
                <div key={s} className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 border"
                  style={{ background: meta.bg, borderColor: 'rgba(0,194,255,0.2)' }}>
                  {iconUrl
                    ? <img src={iconUrl} alt="" className="w-7 h-7 rounded-lg object-cover shrink-0" />
                    : <span className="text-xl shrink-0">{meta.emoji}</span>
                  }
                  <span className="text-xs font-medium text-white leading-tight truncate">{name}</span>
                </div>
              )
            })}
          </div>
        )}

        {/* QR scan */}
        {scanning ? (
          <QrScanner onResult={handleQrResult} onClose={() => setScanning(false)} />
        ) : (
          <button
            onClick={() => { setScanning(true); setEventError(null); setLastQrRaw(null) }}
            className="w-full flex items-center justify-center gap-2 text-xs px-3 py-2.5 rounded-xl font-medium transition-colors border border-dashed"
            style={{ background: 'rgba(0,194,255,0.05)', borderColor: 'rgba(0,194,255,0.25)', color: '#00C2FF' }}
          >
            📷 Scan event QR
          </button>
        )}

        {/* File upload */}
        <div className="flex items-center gap-2">
          <label className="cursor-pointer flex-1 text-center text-xs px-3 py-2 rounded-xl font-medium border border-dashed transition-colors"
            style={{ background: 'rgba(0,194,255,0.05)', borderColor: 'rgba(0,194,255,0.15)', color: '#71717a' }}>
            Upload .ics / .pkpass
            <input type="file" accept=".ics,.pkpass" className="hidden" onChange={handleFileUpload} />
          </label>
        </div>

        {/* Manual JSON paste */}
        <div className="flex gap-2">
          <input
            type="text"
            value={eventInput}
            onChange={e => setEventInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleEventSubmit()}
            placeholder="Event attestation JSON"
            className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
          />
          <button
            onClick={handleEventSubmit}
            disabled={!eventInput.trim() || eventStatus === 'verifying'}
            className="text-xs px-3 py-1.5 rounded-lg disabled:opacity-40 font-medium"
            style={{ background: '#3f3f46', color: '#fff' }}
          >
            {eventStatus === 'verifying' ? '...' : 'Add'}
          </button>
        </div>

        {lastQrRaw && (
          <div className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2">
            <p className="text-xs text-zinc-500 font-mono break-all">{lastQrRaw}</p>
          </div>
        )}
        {eventError && <p className="text-xs text-red-400">{eventError}</p>}
      </div>

      {/* GitHub badge */}
      <div className="space-y-2">
        <p className="text-[11px] text-zinc-500 uppercase tracking-wider font-medium">Developer Badges</p>
        <div className="flex items-center justify-between rounded-xl px-3 py-2.5 border"
          style={{
            background: hasGithubStamp || githubStep === 'done' ? '#1a1e24' : '#18181b',
            borderColor: hasGithubStamp || githubStep === 'done' ? 'rgba(36,41,46,0.8)' : '#3f3f46',
          }}>
          <div className="flex items-center gap-2.5">
            <span className="text-xl">🐙</span>
            <div>
              <p className="text-xs font-semibold text-white">GitHub</p>
              <p className="text-[10px] text-zinc-500">Verified developer account</p>
            </div>
          </div>
          {hasGithubStamp ? (
            <span className="text-xs font-medium text-zinc-500">✓ Added</span>
          ) : githubStep === 'done' ? (
            <span className="text-xs font-medium" style={{ color: '#14F195' }}>✓ Earned</span>
          ) : githubStep === 'idle' ? (
            <button onClick={startGithub} disabled={loading}
              className="text-xs font-medium px-3 py-1 rounded-lg disabled:opacity-50"
              style={{ background: '#24292e', color: '#fff', border: '1px solid #444' }}>
              Connect
            </button>
          ) : (
            <span className="text-xs text-zinc-400 animate-pulse">Waiting...</span>
          )}
        </div>
        {(githubStep === 'code' || githubStep === 'polling') && userCode && (
          <div className="border border-zinc-700 rounded-xl p-3 space-y-2