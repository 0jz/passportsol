import { useMemo, useState, useEffect, useCallback, lazy, Suspense } from 'react'
import { ChainType } from '@lifi/sdk'
import { calculatePassportScore } from '../lib/scoring'
import { evaluateAirdropEligibility } from '../lib/airdropEligibility'
import { CAMPAIGN_PUBLIC_CONFIG } from '../config/campaign'

// Solana chain ID in the LI.FI system (from @lifi/types ChainId.SOL)
const LIFI_SOLANA_CHAIN_ID = 1151111081099710

// Lazy-load the widget to keep initial bundle small
const LiFiWidget = lazy(() =>
  import('@lifi/widget').then(m => ({ default: m.LiFiWidget }))
)

interface Props {
  solAddress: string
  baseScore: number
  stamps: string[]
  walletAgeDays: number
  solBalance: number | null
  claimState: 'idle' | 'claiming' | 'claimed' | 'error'
  claimTxHash: string | null
  claimError: string | null
  onClaim: () => void
  onBalanceRefresh: () => void
}

export default function LifiAirdropPanel({
  solAddress,
  baseScore,
  stamps,
  walletAgeDays,
  solBalance,
  claimState,
  claimTxHash,
  claimError,
  onClaim,
  onBalanceRefresh,
}: Props) {
  const [showWidget, setShowWidget] = useState(false)

  const passportScore = useMemo(
    () => calculatePassportScore(baseScore, stamps),
    [baseScore, stamps],
  )

  const eligibility = useMemo(
    () => evaluateAirdropEligibility(
      { score: passportScore, walletAgeDays },
      CAMPAIGN_PUBLIC_CONFIG,
    ),
    [passportScore, walletAgeDays],
  )

  const hasEnoughSol =
    solBalance !== null ? solBalance >= CAMPAIGN_PUBLIC_CONFIG.minSolForClaim : false

  const canClaim =
    eligibility.eligible &&
    hasEnoughSol &&
    claimState !== 'claiming' &&
    claimState !== 'claimed'

  // Poll SOL balance every 12s while widget is open — auto-unlocks claim after bridge
  useEffect(() => {
    if (!showWidget || claimState === 'claimed') return
    const id = setInterval(onBalanceRefresh, 12000)
    return () => clearInterval(id)
  }, [showWidget, claimState, onBalanceRefresh])

  // Auto-close widget once the wallet is funded
  useEffect(() => {
    if (hasEnoughSol && showWidget) setShowWidget(false)
  }, [hasEnoughSol, showWidget])

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
      variant: 'compact' as const,
    }),
    [solAddress],
  )

  const handleRefreshClick = useCallback(() => onBalanceRefresh(), [onBalanceRefresh])

  const badgestyle: React.CSSProperties = {
    background: 'rgba(153,69,255,0.15)',
    color: '#9945FF',
    border: '1px solid rgba(153,69,255,0.3)',
  }

  return (
    <div className="rounded-xl border border-zinc-700 bg-zinc-900 p-4 space-y-3">

      {/* Header */}
      <div>
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold text-white">LI.FI Airdrop Rail</p>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={badgestyle}>
            powered by LI.FI
          </span>
        