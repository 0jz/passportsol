import { useEffect, useMemo, lazy, Suspense } from 'react'
import { ChainType } from '@lifi/sdk'
import { CAMPAIGN_PUBLIC_CONFIG } from '../config/campaign'

const LIFI_SOLANA_CHAIN_ID = 1151111081099710

const LiFiWidget = lazy(() =>
  import('@lifi/widget').then(m => ({ default: m.LiFiWidget }))
)

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

  useEffect(() => {
    if (isFunded) return
    const id = setInterval(onBalanceRefresh, 12000)
    return () => clearInterval(id)
  }, [isFunded, onBalanceRefresh])

  const widgetConfig = useMemo(
    () => ({
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
      // Ankr free public RPCs — override widget defaults for balance reads
      rpcUrls: {
        1:     ['https://rpc.ankr.com/eth'],        // Ethereum mainnet
        42161: ['https://rpc.ankr.com/arbitrum'],   // Arbitrum
        10:    ['https://rpc.ankr.com/optimism'],   // Optimism
        137:   ['https://rpc.ankr.com/polygon'],    // Polygon
        8453:  ['https://rpc.ankr.com/base'],       // Base
        56:    ['https://rpc.ankr.com/bsc'],        // BNB Chain
        43114: ['https://rpc.ankr.com/avalanche'],  // Avalanche
        [LIFI_SOLANA_CHAIN_ID]: ['https://rpc.ankr.com/solana'],
      },
      variant: 'compact' as const,
    }),
    [solAddress],
  )

  return (
    <div className="space-y-4">
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
          <LiFiWidget integrator="passportsol" config={widgetConfig} />
        </Suspense>
      </div>

      <div className="flex items-center justify-between text-xs px-1">
        <span className="text-zinc-500">SOL balance</span>
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
        Already have SOL? Balance is checked automatically every 12 seconds.
      </p>
    </div>
  )
}
