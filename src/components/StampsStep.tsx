import { useState, useCallback, useEffect } from 'react'
import { requestDeviceCode, pollForToken, fetchGithubUser } from '../lib/githubOAuth'
import { lookupEns } from '../lib/ens'
import type { PassportData } from '../lib/gitcoin'

interface Props {
  passport: PassportData
  onDone: (stamps: string[]) => void
}

type EnsStatus = 'checking' | string | null

export default function StampsStep({ passport, onDone }: Props) {
  const [verified, setVerified] = useState<string[]>([])
  const [ensStatus, setEnsStatus] = useState<EnsStatus>(passport.ethAddress ? 'checking' : null)
  const [githubStep, setGithubStep] = useState<'idle' | 'code' | 'polling' | 'done'>('idle')
  const [userCode, setUserCode] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Auto-detect ENS if ETH address is linked
  useEffect(() => {
    if (!passport.ethAddress) return
    lookupEns(passport.ethAddress).then(name => {
      if (name) {
        setEnsStatus(name)
        setVerified(prev => [...prev, `ENS: ${name}`])
      } else {
        setEnsStatus(null)
      }
    })
  }, [passport.ethAddress])

  const startGithub = useCallback(async () => {
    setError(null)
    setLoading(true)
    try {
      const { device_code, user_code, verification_uri, interval } = await requestDeviceCode()
      setUserCode(user_code)
      setGithubStep('code')
      setLoading(false)

      // Open verification page automatically
      window.open(verification_uri, '_blank')

      // Poll in background
      setGithubStep('polling')
      const token = await pollForToken(device_code, interval)
      const user = await fetchGithubUser(token)
      const stamp = `GitHub: ${user.login}`
      setVerified(prev => [...prev, stamp])
      setGithubStep('done')
    } catch (e) {
      setError((e as Error).message)
      setGithubStep('idle')
      setLoading(false)
    }
  }, [])

  return (
    <div className="space-y-3">
      {/* ENS stamp */}
      {passport.ethAddress && (
        <div className="flex items-center justify-between bg-zinc-800 rounded-lg px-4 py-2.5">
          <div>
            <span className="text-sm font-medium text-white">ENS</span>
            <span className="text-xs text-zinc-500 ml-2">Ethereum Name Service</span>
          </div>
          {ensStatus === 'checking' && <span className="text-xs text-zinc-500">Checking...</span>}
          {ensStatus && ensStatus !== 'checking' && (
            <span className="text-xs font-medium" style={{ color: '#14F195' }}>✓ {ensStatus}</span>
          )}
          {ensStatus === null && ensStatus !== 'checking' && (
            <span className="text-xs text-zinc-500">Not found</span>
          )}
        </div>
      )}

      {/* GitHub stamp */}
      <div className="bg-zinc-800 rounded-lg px-4 py-2.5 space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-sm font-medium text-white">GitHub</span>
            <span className="text-xs text-zinc-500 ml-2">Prove you have a GitHub account</span>
          </div>
          {githubStep === 'done' && (
            <span className="text-xs font-medium" style={{ color: '#14F195' }}>✓ Verified</span>
          )}
          {githubStep === 'idle' && (
            <button
              onClick={startGithub}
              disabled={loading}
              className="text-xs font-medium px-3 py-1 rounded-lg transition-colors disabled:opacity-50"
              style={{ background: '#24292e', color: '#fff', border: '1px solid #444' }}
            >
              Connect
            </button>
          )}
          {(githubStep === 'code' || githubStep === 'polling') && (
            <span className="text-xs text-zinc-400">Waiting...</span>
          )}
        </div>

        {(githubStep === 'code' || githubStep === 'polling') && userCode && (
          <div className="border border-zinc-700 rounded-lg p-3 space-y-2">
            <p className="text-xs text-zinc-400">Enter this code on GitHub:</p>
            <p className="text-2xl font-mono font-bold tracking-widest text-center text-white">{userCode}</p>
            <a
              href="https://github.com/login/device"
              target="_blank"
              rel="noopener noreferrer"
              className="block text-center text-xs text-purple-400 hover:text-purple-300"
            >
              github.com/login/device →
            </a>
          </div>
        )}
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      {/* Verified list */}
      {verified.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {verified.map(s => (
            <span key={s} className="text-xs px-2 py-1 rounded-full font-medium" style={{ background: 'rgba(20,241,149,0.15)', color: '#14F195', border: '1px solid rgba(20,241,149,0.3)' }}>
              ✓ {s}
            </span>
          ))}
        </div>
      )}

      <div className="flex gap-2 pt-1">
        {verified.length > 0 && (
          <button
            onClick={() => onDone(verified)}
            className="flex-1 text-black text-sm font-semibold px-4 py-2 rounded-lg"
            style={{ background: '#14F195' }}
          >
            Add {verified.length} stamp{verified.length > 1 ? 's' : ''} →
          </button>
        )}
        <button
          onClick={() => onDone(verified)}
          className={`text-zinc-500 hover:text-zinc-300 text-xs py-1 transition-colors ${verified.length === 0 ? 'w-full' : ''}`}
        >
          {verified.length > 0 ? 'Skip remaining →' : 'Skip →'}
        </button>
      </div>
    </div>
  )
}
