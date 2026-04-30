import { useState, useCallback, useEffect, useRef } from 'react'
import { useWallet, useConnection } from '@solana/wallet-adapter-react'
import { requestDeviceCode, pollForToken, fetchGithubUser } from '../lib/githubOAuth'
import { lookupEns } from '../lib/ens'
import { analyzeSolanaWallet } from '../lib/solanaStats'
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
  const [solana, setSolana] = useState<StampState>({ status: wallet.publicKey ? 'checking' : 'idle' })
  const [githubStep, setGithubStep] = useState<'idle' | 'code' | 'polling' | 'done'>('idle')
  const [userCode, setUserCode] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const autoProceedFired = useRef(false)

  // Only add if not already in passport
  const addStamp = useCallback((stamp: string) => {
    if (passport.stamps.includes(stamp)) return
    setVerified(prev => prev.includes(stamp) ? prev : [...prev, stamp])
  }, [passport.stamps])

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

  // True when every manual stamp option is verified or already in passport.
  // Add more conditions here as new stamps are introduced (e.g. Twitter):
  // && (hasTwitterStamp || twitterStep === 'done')
  const allManualHandled = hasGithubStamp || githubStep === 'done'

  useEffect(() => {
    if (!allManualHandled || autoProceedFired.current) return
    if (verified.length === 0) return  // nothing new — let user click Skip
    autoProceedFired.current = true
    onDone(verified)
  }, [allManualHandled, verified, onDone])

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

      {/* ENS */}
      {passport.ethAddress && (
        <StampRow label="ENS" description="Ethereum Name Service" state={ens} />
      )}

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

      <div className="flex gap-2 pt-1">
        {verified.length > 0 && (
          <button onClick={() => onDone(verified)}
            className="flex-1 text-black text-sm font-semibold px-4 py-2 rounded-lg"
            style={{ background: '#14F195' }}>
            Add {verified.length} stamp{verified.length > 1 ? 's' : ''} →
          </button>
        )}
        <button onClick={() => onDone(verified)}
          className={`text-zinc-500 hover:text-zinc-300 text-xs py-1 transition-colors ${verified.length === 0 ? 'w-full' : ''}`}>
          {verified.length > 0 ? 'Skip remaining →' : 'Skip →'}
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
