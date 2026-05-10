import { useMemo, useState, useEffect, useCallback, lazy, Suspense } from 'react'
import { ChainType } from '@lifi/sdk'
import { calculatePassportScore } from '../lib/scoring'
import { evaluateAirdropEligibility } from '../lib/airdropEligibility'
import { CAMPAIGN_PUBLIC_CONFIG } from '../config/campaign'

// Solana chain ID in the LI.FI system
const LIFI_SOLANA_CHAIN_ID = 1151111081099710

// Lazy-load the widget so it doesn't block initial bundle
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
    () => evaluateAirdropEligibility({ score: passportScore, walletAgeDays }, CAMPAIGN_PUBLIC_CONFIG),
    [passportScore, walletAgeDays],
  )

  const hasEnoughSol =
    solBalance !== null ? solBalance >= CAMPAIGN_PUBLIC_CONFIG.minSolForClaim : false

  const canClaim =
    eligibility.eligible &&
    hasEnoughSol &&
    claimState !== 'claiming' &&
    claimState !== 'claimed'

  // Poll balance every 12 s while widget is open so the UI auto-unlocks after bridging
  useEffect(() => {
    if (!showWidget || claimState === 'claimed') return
    const id = setInterval(onBalanceRefresh, 12000)
    return () => clearInterval(id)
  }, [showWidget, claimState, onBalanceRefresh])

  // Auto-close widget once wallet is funded
  useEffect(() => {
    if (hasEnoughSol && showWidget) setShowWidget(false)
  }, [hasEnoughSol, showWidget])

  // LI.FI widget config — destination locked to user's Solana wallet
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
      // Pre-set Solana as destination chain (numeric ID required by WidgetConfig)
      toChain: LIFI_SOLANA_CHAIN_ID,
      toToken: 'SOL',
      // Pre-fill destination address with correct chain type (SVM = Solana)
      toAddress: {
        address: solAddress,
        chainType: ChainType.SVM,
      },
      variant: 'compact' as const,
    }),
    [solAddress],
  )

  const handleRefreshClick = useCallback(() => onBalanceRefresh(), [onBalanceRefresh])

  return (
    <div className="rounded-xl border border-zinc-700 bg-zinc-900 p-4 space-y-3">

      {/* ── Header ── */}
      <div>
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold text-white">LI.FI Airdrop Rail</p>
          <span
            className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
            style={{
   