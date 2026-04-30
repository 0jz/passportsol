import { useState, useCallback, useEffect } from 'react'
import { useWallet, useConnection } from '@solana/wallet-adapter-react'
import { requestDeviceCode, pollForToken, fetchGithubUser } from '../lib/githubOAuth'
import { lookupEns } from '../lib/ens'
import { analyzeSolanaWallet } from '../lib/solanaStats'
import { parseLumaSlug, parseAttestation, verifyAttestation, parseIcs, parseIcsFeed, parsePkpass } from '../lib/attestation'
import { lookupSolDomain } from '../lib/sns'
import { lookupSolanaId } from '../lib/solanaid'
import type { PassportData } from '../lib/gitcoin'

interface Props {
  passport: PassportData
  onDone: (stamps: string[]) => void
}

interface StampState {
  status: 'idle' | 'checking' | 'found' | 'not_found' | 'error' | 'already_added'
  value?: string
}

export default function StampsStep({ passport, onDone }: Props) {
  const wallet = useWallet()
  const { connection } = useConnection()

  const [verified, setVerified] = useState<string[]>([])
  const [ens, setEns] = useState<StampState>({ status: passport.ethAddress ? 'checking' : 'idle' })
  const [sns, setSns] = useState<StampState>({ status: wallet.publicKey ? 'checking' : 'idle' })
  const [solanaId, setSolanaId] = useState<StampState>({ status: wallet.publicKey ? 'checking' : 'idle' })
  const [solana, setSolana] = useState<StampState>({ status: wallet.publicKey ? 'checking' : 'idle' })
  const [githubStep, setGithubStep] = useState<'idle' | 'code' | 'polling' | 'done'>('idle')
  const [userCode, setUserCode] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [eventInput, setEventInput] = useState('')
  const [eventStatus, setEventStatus] = useState<'idle' | 'verifying' | 'error'>('idle')
  const [eventError, setEventError] = useState<string | null>(null)
  const [lumaLoading, setLumaLoading] = useState(false)
  const [lumaInput, setLumaInput] = useState('')

  // Only add if not already in passport
  const addStamp = useCallback((stamp: string) => {
    if (passport.stamps.includes(stamp)) return
    setVerified(prev => prev.includes(stamp) ? prev : [...prev, stamp])
  }, [passport.stamps])

  // Auto-detect Solana.id profile
  useEffect(() => {
    if (!wallet.publicKey) return
    const existing = passport.stamps.find(s => /^SolanaID:/.test(s))
    if (existing) {
      setSolanaId({ status: 'already_added', value: existing.replace('SolanaID: ', '') })
      return
    }
    lookupSolanaId(wallet.publicKey.toBase58()).then(profile => {
      if (profile) { setSolanaId({ status: 'found', value: profile }); addStamp(`SolanaID: ${profile}`) }
      else setSolanaId({ status: 'not_found' })
    })
  }, [wallet.publicKey, passport.stamps, addStamp])

  // Auto-detect .sol domain
  useEffect(() => {
    if (!wallet.publicKey) return
    const existing = passport.stamps.find(s => /^SNS:/.test(s))
    if (existing) {
      setSns({ status: 'already_added', value: existing.replace('SNS: ', '') })
      return
    }
    lookupSolDomain(wallet.publicKey.toBase58()).then(domain => {
      if (domain) { setSns({ status: 'found', value: domain }); addStamp(`SNS: ${domain}`) }
      else setSns({ status: 'not_found' })
    })
  }, [wallet.publicKey, passport.stamps, addStamp])

  // Auto-detect ENS
  useEffect(() => {
    if (!passport.ethAddress) return
    const existing = passport.stamps.find(s => /^ENS:/.test(s))
    if (existing) {
      setEns({ status: 'already_added', value: existing.replace('ENS: ', '') })
      return
    }
    lookupEns(passport.ethAddress).then(name => {
      if (name) { setEns({ status: 'found', value: name }); addStamp(`ENS: ${name}`) }
      else setEns({ status: 'not_found' })
    })
  }, [passport.ethAddress, passport.stamps, addStamp])

  // Auto-detect Solana stats
  useEffect(() => {
    if (!wallet.publicKey) return
    const existingSolana = passport.stamps.filter(s => s.startsWith('Solana'))
    if (existingSolana.length > 0) {
      setSolana({ status: 'already_added', value: existingSolana.join(', ') })
      return
    }
    analyzeSolanaWallet(wallet.publicKey.toBase58(), connection).then(stats => {
      if (stats.stamps.length > 0) {
        setSolana({ status: 'found', value: stats.stamps.join(', ') })
        stats.stamps.forEach(addStamp)
      } else {
        const months = Math.floor(stats.walletAgeMonths)
        const ageLabel = months < 1 ? '< 1 month old' : months < 12 ? `${months}m old` : `${Math.floor(months / 12)}y old`
        setSolana({ status: 'not_found', value: stats.walletAgeMonths > 0 ? ageLabel : undefined })
      }
    }).catch(() => setSolana({ status: 'error' }))
  }, [wallet.publicKey, connection, passport.stamps, addStamp])

  const hasGithubStamp = passport.stamps.some(s => /^GitHub:/.test(s))

  const addEventStamp = useCallback((name: string) => {
    const stamp = `Event?: ${name}`
    if (passport.stamps.includes(stamp) || verified.includes(stamp)) {
      setEventError('Ovaj event je već dodat')
      return
    }
    addStamp(stamp)
    setEventInput('')
  }, [passport.stamps, verified, addStamp])

  const handleLumaImport = useCallback(async () => {
    const input = lumaInput.trim()
    if (!input) return
    setEventError(null)
    setLumaLoading(true)
    try {
      const proxyUrl = `/api/luma-calendar?url=${encodeURIComponent(input)}`
      const res = await fetch(proxyUrl)
      if (!res.ok) throw new Error('Ne mogu da učitam kalendar — proveri da li je URL ispravan')
      const text = await res.text()
      const names = parseIcsFeed(text)
      if (names.length === 0) throw new Error('Nije pronađen nijedan event u kalendaru')
      let added = 0
      for (const name of names) {
        const stamp = `Event?: ${name}`
        if (!passport.stamps.includes(stamp) && !verified.includes(stamp)) {
          addStamp(stamp)
          added++
        }
      }
      setLumaInput('')
      if (added === 0) setEventError('Svi eventi su već dodati')
    } catch (e) {
      setEventError((e as Error).message)
    } finally {
      setLumaLoading(false)
    }
  }, [lumaInput, passport.stamps, verified, addStamp])

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
      const name = await parsePkpass(file)
      if (!name) { setEventError('Nije pronađen naziv eventa u .pkpass fajlu'); return }
      addEventStamp(name)
      return
    }

    setEventError('Podržani formati: .ics, .pkpass')
  }, [addEventStamp])

  const handleEventSubmit = useCallback(async () => {
    const input = eventInput.trim()
    if (!input) return
    setEventError(null)
    setEventStatus('idle')

    const slug = parseLumaSlug(input)
    if (slug) {
      addEventStamp(slug)
      return
    }

    const attest = parseAttestation(input)
    if (!attest) {
      setEventError('Unesi Luma URL (lu.ma/...) ili atestaciju u JSON formatu')
      return
    }

    setEventStatus('verifying')
    const result = await verifyAttestation(attest, wallet.publicKey?.toBase58() ?? '')
    if (!result.ok) {
      setEventError(result.reason ?? 'Verifikacija neuspešna')
      setEventStatus('error')
      return
    }

    const issuerSuffix = result.issuerName ? ` · ${result.issuerName}` : ''
    const stamp = `Event: ${attest.event}${issuerSuffix}`
    if (passport.stamps.includes(stamp) || verified.includes(stamp)) {
      setEventError('Ovaj event je već dodat')
      setEventStatus('idle')
      return
    }
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

  return (
    <div className="space-y-2">
      {/* Solana stats */}
      <StampRow label="Solana Wallet" description="Age & activity analysis" state={solana} />

      {/* Solana.id */}
      <StampRow label="Solana.id" description="On-chain identity profile" state={solanaId} />

      {/* .sol domain */}
      <StampRow label=".sol Domain" description="Solana Name Service" state={sns} />

      {/* ENS */}
      {passport.ethAddress && (
        <StampRow label="ENS" description="Ethereum Name Service" state={ens} />
      )}

      {/* Events */}
      <div className="bg-zinc-800 rounded-lg px-4 py-2.5 space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-sm font-medium text-white">Events</span>
            <span className="text-xs text-zinc-500 ml-2">Hackathons & conferences</span>
          </div>
        </div>
        {passport.stamps.filter(s => s.startsWith('Event')).length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {passport.stamps.filter(s => s.startsWith('Event')).map(s => (
              <span key={s} className="text-xs px-2 py-0.5 rounded-full font-medium text-zinc-400 bg-zinc-700">
                ✓ {s.replace(/^Event\??:\s*/, '')}
              </span>
            ))}
          </div>
        )}
        {/* Luma calendar import */}
        <div className="flex gap-2">
          <input
            type="text"
            value={lumaInput}
            onChange={e => setLumaInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLumaImport()}
            placeholder="Luma iCal URL (iz Luma → Settings → Calendar)"
            className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
          />
          <button
            onClick={handleLumaImport}
            disabled={!lumaInput.trim() || lumaLoading}
            className="text-xs px-3 py-1.5 rounded-lg disabled:opacity-40 transition-colors font-medium whitespace-nowrap"
            style={{ background: '#FF6B35', color: '#fff' }}
          >
            {lumaLoading ? '...' : 'Import all'}
          </button>
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={eventInput}
            onChange={e => setEventInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleEventSubmit()}
            placeholder="lu.ma/event-name ili atestacija JSON"
            className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
          />
          <button
            onClick={handleEventSubmit}
            disabled={!eventInput.trim() || eventStatus === 'verifying'}
            className="text-xs px-3 py-1.5 rounded-lg disabled:opacity-40 transition-colors font-medium"
            style={{ background: '#3f3f46', color: '#fff' }}
          >
            {eventStatus === 'verifying' ? '...' : 'Dodaj'}
          </button>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-600">ili uploaduj:</span>
          <label className="cursor-pointer text-xs px-2.5 py-1 rounded-lg font-medium transition-colors"
            style={{ background: '#3f3f46', color: '#a1a1aa' }}>
            .ics / .pkpass
            <input
              type="file"
              accept=".ics,.pkpass"
              className="hidden"
              onChange={handleFileUpload}
            />
          </label>
        </div>
        {eventError && <p className="text-xs text-red-400">{eventError}</p>}
        <p className="text-xs text-zinc-600">
          Luma link ili fajl → self-reported (+3). Atestacija od organizatora → verifikovano (+8).
        </p>
      </div>

      {/* GitHub */}
      <div className="bg-zinc-800 rounded-lg px-4 py-2.5 space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-sm font-medium text-white">GitHub</span>
            <span className="text-xs text-zinc-500 ml-2">Device flow verification</span>
          </div>
          {hasGithubStamp ? (
            <span className="text-xs font-medium text-zinc-500">✓ Already added</span>
          ) : githubStep === 'done' ? (
            <span className="text-xs font-medium" style={{ color: '#14F195' }}>✓ Verified</span>
          ) : githubStep === 'idle' ? (
            <button
              onClick={startGithub}
              disabled={loading}
              className="text-xs font-medium px-3 py-1 rounded-lg disabled:opacity-50 transition-colors"
              style={{ background: '#24292e', color: '#fff', border: '1px solid #444' }}
            >
              Connect
            </button>
          ) : (
            <span className="text-xs text-zinc-400">Waiting...</span>
          )}
        </div>
        {(githubStep === 'code' || githubStep === 'polling') && userCode && (
          <div className="border border-zinc-700 rounded-lg p-3 space-y-2">
            <p className="text-xs text-zinc-400">Enter this code on GitHub:</p>
            <p className="text-2xl font-mono font-bold tracking-widest text-center">{userCode}</p>
            <a href="https://github.com/login/device" target="_blank" rel="noopener noreferrer"
              className="block text-center text-xs text-purple-400 hover:text-purple-300">
              github.com/login/device →
            </a>
          </div>
        )}
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      {verified.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1">
          {verified.map(s => (
            <span key={s} className="text-xs px-2 py-1 rounded-full font-medium"
              style={{ background: 'rgba(20,241,149,0.15)', color: '#14F195', border: '1px solid rgba(20,241,149,0.3)' }}>
              ✓ {s}
            </span>
          ))}
        </div>
      )}

      <div className="pt-1">
        <button onClick={() => onDone(verified)}
          className="w-full text-black text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
          style={{ background: '#14F195' }}>
          {verified.length > 0 ? `Continue with ${verified.length} stamp${verified.length > 1 ? 's' : ''} →` : 'Continue →'}
        </button>
      </div>
    </div>
  )
}

function StampRow({ label, description, state }: {
  label: string
  description: string
  state: StampState
}) {
  return (
    <div className="flex items-center justify-between bg-zinc-800 rounded-lg px-4 py-2.5">
      <div>
        <span className="text-sm font-medium text-white">{label}</span>
        <span className="text-xs text-zinc-500 ml-2">{description}</span>
      </div>
      {state.status === 'checking' && <span className="text-xs text-zinc-500">Checking...</span>}
      {state.status === 'found' && (
        <span className="text-xs font-medium truncate max-w-32" style={{ color: '#14F195' }}>✓ {state.value}</span>
      )}
      {state.status === 'already_added' && (
        <span className="text-xs font-medium text-zinc-500">✓ Already added</span>
      )}
      {state.status === 'not_found' && (
        <span className="text-xs text-zinc-500">{state.value ?? 'Not found'}</span>
      )}
      {state.status === 'error' && <span className="text-xs text-red-500">Error</span>}
    </div>
  )
}
