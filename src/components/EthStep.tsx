import { useState, useCallback, useEffect } from 'react'
import { getAddress } from 'ethers'
import { fetchPassport, fetchScorerThreshold, type PassportData } from '../lib/gitcoin'
import { createVerificationMessage, signWithMetaMask } from '../lib/siwe'

interface EthProvider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>
  isMetaMask?: boolean
  isPhantom?: boolean
}

function detectProviders(): { metamask: EthProvider | null; phantom: EthProvider | null } {
  const eth = window.ethereum as (EthProvider & { providers?: EthProvider[] }) | undefined
  if (!eth) return { metamask: null, phantom: null }

  // EIP-5749: multiple injected providers
  const list = eth.providers
  if (list?.length) {
    return {
      metamask: list.find(p => p.isMetaMask && !p.isPhantom) ?? null,
      phantom:  list.find(p => p.isPhantom) ?? null,
    }
  }

  // Single provider
  return {
    metamask: eth.isMetaMask && !eth.isPhantom ? eth : null,
    phantom:  eth.isPhantom ? eth : null,
  }
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
  const [providers, setProviders] = useState<ReturnType<typeof detectProviders>>({ metamask: null, phantom: null })

  useEffect(() => {
    setProviders(detectProviders())
  }, [])

  const connectWith = useCallback(async (provider: EthProvider, label: string) => {
    setError(null)
    try {
      setLoading(`Connecting ${label}...`)
      const accounts = await provider.request({ method: 'eth_requestAccounts' }) as string[]
      // getAddress() converts to EIP-55 checksummed format, fixes lowercase issue
      const address = getAddress(accounts[0])

      setLoading('Waiting for signature...')
      const message = createVerificationMessage(address, solanaAddress)
      await signWithMetaMask(message, address, provider)

      setLoading('Fetching Gitcoin Passport...')
      const data = await fetchPassport(address)
      onDone(data)
    } catch (e) {
      console.error(e)
      const code = (e as { code?: number })?.code
      if (code === -32002) {
        setError('MetaMask ima pending zahtjev — otvori MetaMask i prihvati ili odbij ga, pa proba ponovo.')
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

  if (loading) {
    return <p className="text-sm text-zinc-400">{loading}</p>
  }

  return (
    <div className="space-y-2">
      {mode === 'choose' && (
        <>
          {providers.metamask && (
            <button
              onClick={() => connectWith(providers.metamask!, 'MetaMask')}
              className="w-full flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              <span>🦊</span> Connect MetaMask
            </button>
          )}

          {providers.phantom && (
            <button
              onClick={() => connectWith(providers.phantom!, 'Phantom')}
              className="w-full flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              <span>👻</span> Connect Phantom (Ethereum)
            </button>
          )}

          {!providers.metamask && !providers.phantom && (
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
              className="flex-1 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
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
