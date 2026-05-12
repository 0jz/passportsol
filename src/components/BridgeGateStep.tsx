import { useEffect, lazy, Suspense } from 'react'
import { ChainType } from '@lifi/sdk'
import { CAMPAIGN_PUBLIC_CONFIG } from '../config/campaign'

const LIFI_SOLANA_CHAIN_ID = 1151111081099710

const LiFiWidget = lazy(() =>
  import('@lifi/widget').then(m => ({ default: m.LiFiWidget }))
)

// Detect devnet from env (VITE_SOLANA_RPC_URL or VITE_SOLANA_RPC_FALLBACK contains "devnet")
const IS_DEVNET =
  (import.meta.env.VITE_SOLANA_RPC_URL ?? '').includes('devnet') ||
  (import.meta.env.VITE_SOLANA_RPC_FALLBACK ?? '').includes('devnet')

interface Props {
  solAddress: string
  solBalance: number | null
  onReady: () => void
  onBalanceRefresh: () => void
}

export default function BridgeGateStep({
  solAddress,
  solBalance,
  onReady,
  onBalanceRefresh,
}: Props) {
  const isFunded =
    solBalance !== null && solBalance >= CAMPAIGN_PUBLIC_CONFIG.minSolForClaim

  // Poll balance every 12s — auto-unlocks Continue when funded
  useEffect(() => {
    if (isFunded) return
    const id = setInterval(onBalanceRefresh, 12000)
    return () => clearInterval(id)
  }, [isFunded, onBalanceRefresh])

  return (
    <div className="space-y-4">
      {IS_DEVNET ? (
        /* ── DEV MODE: no LI.FI widget, use devnet faucet ── */
        <div className="rounded-xl border border-zinc-700 bg-zinc-900 p-5 space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-widest text-amber-400 border border-amber-400/40 rounded px-2 py-0.5">
              DEV MODE
            </span>
            <span className="text-xs text-zinc-400">Solana Devnet</span>
          </div>

          <p className="text-zinc-300 text-sm">
            You are on <strong className="text-amber-300">devnet</strong>. The LI.FI bridge
            is disabled — fund your wallet using the Solana devnet faucet.
          </p>

          <div className="space-y-1">
            <p className="text-xs text-zinc-500">Your devnet address</p>
            <p className="font-mono text-xs text-zinc-200 break-all bg-zinc-800 rounded-lg px-3 py-2 select-all">
              {solAddress}
            </p>
          </div>

          <a
            href={`https://faucet.solana.com/?address=${solAddress}`}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full text-center text-sm font-semibold px-4 py-2.5 rounded-xl transition-all"
            style={{ background: '#9945FF', color: '#fff' }}
          >
            Open Devnet Faucet →
          </a>

          <p className="text-[11px] text-zinc-600 text-center">
            Request 1–2 SOL from the faucet, then wait for the balance check below.
          </p>
        </div>
      ) : (
        /* ── MAINNET: full LI.FI widget ── */
        <>
          <p className="text-zinc-400 text-xs">
            Bridge any token from any chain to SOL. Your destination address is
            pre-filled — no copy-paste needed.
          </p>

          <div
            className="rounded-xl overflow-hidden border border-zinc-800"
            style={{ minHeight: 420 }}
          >
            <Suspense
              fallback={
                <div className="flex items-center justify-center h-40 text-zinc-500 text-sm">
                  Loading LI.FI Widget...
                </div>
              }
            >
              <LiFiWidget
                integrator="passportsol"
                config={{
                  integrator: 'passportsol',
                  appearance: 'dark' as const,
                  theme: {
                    palette: {
                      primary: { main: '#9945FF' },
                      secondary: { main: '#14F195' },
                      background: { default: '#09090b', paper: '#18181b' },
                    },
                    shape: { borderRadius: 12, borderRadiusSecondary: 8 },
                  },
                  toChain: LIFI_SOLANA_CHAIN_ID,
                  toToken: 'SOL',
                  toAddress: {
                    address: solAddress,
                    chainType: ChainType.SVM,
                  },
                  rpcUrls: {
                    1:     ['https://rpc.ankr.com/eth'],
                    42161: ['https://rpc.ankr.com/arbitrum'],
                    10:    ['https://rpc.ankr.com/optimism'],
                    137:   ['https://rpc.ankr.com/polygon'],
                    8453:  ['https://rpc.ankr.com/base'],
                    56:    ['https://rpc.ankr.com/bsc'],
                    43114: ['https://rpc.ankr.com/avalanche'],
                    [LIFI_SOLANA_CHAIN_ID]: ['https://rpc.ankr.com/solana'],
                  },
                  variant: 'compact' as const,
                }}
              />
            </Suspense>
          </div>
        </>
      )}

      {/* Balance row — works for both devnet and mainnet */}
      <div className="flex items-center justify-between text-xs px-1">
        <span className="text-zinc-500">SOL balance{IS_DEVNET ? ' (devnet)' : ''}</span>
        <div className="flex items-center gap-2">
          <span className={isFunded ? 'text-emerald-400 font-medium' : 'text-amber-400'}>
            {solBalance === null
              ? 'checking...'
              : `${solBalance.toFixed(5)} SOL`}
          </span>
          <button
            onClick={onBalanceRefresh}
            className="text-zinc-600 hover:text-zinc-400 transition-colors"
            title="Refresh"
          >
            &#8635;
          </button>
        </div>
      </div>

      {/* Continue button — unlocks when funded */}
      <button
        onClick={onReady}
        disabled={!isFunded}
        className="w-full text-sm font-semibold px-4 py-3 rounded-xl disabled:opacity-40 transition-all"
        style={{ background: '#14F195', color: '#081016' }}
      >
        {isFunded
          ? 'Wallet Funded — Continue →'
          : `Waiting for funds (need ${CAMPAIGN_PUBLIC_CONFIG.minSolForClaim} SOL)...`}
      </button>

      <p className="text-[11px] text-zinc-600 text-center">
        {IS_DEVNET
          ? 'Devnet balance is checked automatically every 12 seconds.'
          : 'Already have SOL? Balance is checked automatically every 12 seconds.'}
      </p>
    </div>
  )
}
