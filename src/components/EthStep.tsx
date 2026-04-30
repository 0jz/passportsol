import { useState, useCallback, useEffect } from 'react'
import { getAddress } from 'ethers'
import { fetchPassport, fetchScorerThreshold, type PassportData } from '../lib/gitcoin'
import { createVerificationMessage, signWithMetaMask } from '../lib/siwe'

interface EthProvider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>
}

interface EIP6963Detail {
  info: { uuid: string; name: string; icon: string; rdns: string }
  provider: EthProvider
}

function useEip6963Providers() {
  const [providers, setProviders] = useState<EIP6963Detail[]>([])

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<EIP6963Detail>).detail
      if (!detail?.info?.uuid) return
      setProviders(prev =>
        prev.some(p => p.info.uuid === detail.info.uuid) ? prev : [...prev, detail]
      )
    }
    window.addEventListener('eip6963:announceProvider', handler)
    window.dispatchEvent(new Event('eip6963:requestProvider'))
    return () => window.removeEventListener('eip6963:announceProvider', handler)
  }, [])

  return providers
}

interface Props {
  solanaAddress: string
  onDone: (passport: PassportData) => void
}

export default function EthStep({ solanaAddress, onDone }: Props) {
  const [mode, setMode] = useState<'choose' | 'manual'>('choose')
  const [manualAddress, setManualAddress] = useState('')
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const eip6963 = useEip6963Providers()
  const [legacyProvider, setLegacyProvider] = useState<EthProvider | null>(null)

  useEffect(() => {
    // Give EIP-6963 wallets a tick to announce, then check legacy window.ethereum
    const t = setTimeout(() => {
      if (eip6963.length === 0) {
        const eth = (window as { ethereum?: EthProvider }).ethereum
        setLegacyProvider(eth ?? null)
      }
    }, 150)
    return () => clearTimeout(t)
  }, [eip6963.length])

  const connectWith = useCallback(async (provider: EthProvider, label: string) => {
    setError(null)
    try {
      setLoading(`Connecting ${label}...`)
      const accounts = await provider.request({ method: 'eth_requestAccounts' }) as string[]
      const address = getAddress(accounts[0])

      setLoading('Waiting for signature...')
      const message = createVerificationMessage(address, solanaAddress)
      await signWithMetaMask(message, address, provider)

      setLoading('Fetching Gitcoin Passport...')
      const data = await fetchPassport(address)
      onDone(data)
    } catch (e) {
      const code = (e as { code?: number })?.code
      if (code === -32002) {
        setError('Wallet ima pending zahtjev — otvori ga i prihvati ili odbij, pa proba ponovo.')
      } else {
        setError((e as { message?: string })?.message ?? String(e))
      }
    } finally {
      setLoading(null)
    }
  }, [solanaAddress, onDone])

  const handleManual = useCallback(async () => {
    const raw = manualAddress.trim()
    if (!raw.startsWith('0x') || raw.length !== 42) {
      setError('Unesi ispravnu Ethereum adresu (0x...)')
      return
    }
    setError(null)
    try {
      const address = getAddress(raw)
      setLoading('Fetching Gitcoin Passport...')
      const data = await fetchPassport(address)
      onDone(data)
    } catch (e) {
      setError((e as { message?: string })?.message ?? String(e))
    } finally {
      setLoading(null)
    }
  }, [manualAddress, onDone])

  const handleSkip = useCallback(async () => {
    const threshold = await fetchScorerThreshold()
    onDone({ ethAddress: null!, score: 0, threshold, stamps: [], lastUpdated: new Date().toISOString() })
  }, [onDone])

  if (loading) return <p className="text-sm text-zinc-400">{loading}</p>

  return (
    <div className="space-y-2">
      {mode === 'choose' && (
        <>
          {eip6963.map(({ info, provider }) => (
            <button
              key={info.uuid}
              onClick={() => connectWith(provider, info.name)}
              className="w-full flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              <img src={info.icon} alt={info.name} className="w-5 h-5 rounded-sm shrink-0" />
              Connect {info.name}
            </button>
          ))}

          {eip6963.length === 0 && legacyProvider && (
            <button
              onClick={() => connectWith(legacyProvider, 'Ethereum Wallet')}
              className="w-full flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              <span className="text-lg leading-none">🔗</span> Connect Ethereum Wallet
            </button>
          )}

          {eip6963.length === 0 && !legacyProvider && (
            <p className="text-xs text-zinc-500">No Ethereum wallet detected</p>
          )}

          <button
            onClick={() => setMode('manual')}
            className="w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm px-4 py-2 rounded-lg transition-colors"
          >
            Enter ETH address manually
          </button>

          <button onClick={handleSkip} className="w-full text-zinc-500 hover:text-zinc-300 text-xs py-1 transition-colors">
            Skip this step →
          </button>
        </>
      )}

      {mode === 'manual' && (
        <div className="space-y-2">
          <input
            type="text"
            value={manualAddress}
            onChange={e => setManualAddress(e.target.value)}
            placeholder="0x..."
            className="w-full bg-zinc-800 border border-zinc-700 text-white text-sm px-3 py-2 rounded-lg font-mono focus:outline-none focus:border-zinc-500"
          />
          <div className="flex gap-2">
            <button
              onClick={handleManual}
              className="flex-1 bg-zinc-700 hover:bg-zinc-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              Fetch Passport
            </button>
            <button
              onClick={() => setMode('choose')}
              className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm px-4 py-2 rounded-lg transition-colors"
            >
              Back
            </button>
          </div>
          <button onClick={handleSkip} className="w-full text-zinc-500 hover:text-zinc-300 text-xs py-1 transition-colors">
            Skip this step →
          </button>
        </div>
      )}

      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  )
}
