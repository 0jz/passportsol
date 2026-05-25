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

const IS_DEVNET = import.meta.env.VITE_SOLANA_NETWORK !== 'mainnet'

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

  const badgestyle = {
    background: 'rgba(153,69,255,0.15)',
    color: '#9945FF',
    border: '1px solid rgba(153,69,255,0.3)',
  }

  return (
    <div className="rounded-xl border border-zinc-700 bg-zinc-900 p-4 space-y-3">

      {/* Header */}
      <div>
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold text-white">
            {IS_DEVNET ? 'Devnet Airdrop Rail' : 'LI.FI Airdrop Rail'}
          </p>
          {!IS_DEVNET && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={badgestyle}>
              powered by LI.FI
            </span>
          )}
        </div>
        <p className="text-xs text-zinc-500 mt-0.5">
          {IS_DEVNET
            ? 'No LI.FI step is required on devnet. Fund your wallet from the Solana faucet, then claim.'
            : 'Bridge from any chain, fund your Solana wallet, and claim the airdrop.'}
        </p>
      </div>

      {/* Status panel */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3 space-y-1.5 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-zinc-500">Eligibility</span>
          <span className={eligibility.eligible ? 'text-emerald-400 font-medium' : 'text-amber-400'}>
            {eligibility.eligible ? '✓ Eligible' : eligibility.reasons.join(' · ')}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-zinc-500">Passport score</span>
          <span className="text-zinc-300">{passportScore.toFixed(1)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-zinc-500">Wallet age</span>
          <span className="text-zinc-300">{walletAgeDays.toFixed(1)} day(s)</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-zinc-500">SOL balance</span>
          <div className="flex items-center gap-1.5">
            <span className={hasEnoughSol ? 'text-emerald-400' : 'text-amber-400'}>
              {solBalance === null ? '...' : `${solBalance.toFixed(5)} SOL`}
            </span>
            <button
              onClick={handleRefreshClick}
              className="text-zinc-600 hover:text-zinc-400 transition-colors leading-none"
              title="Refresh balance"
            >
              &#8635;
            </button>
          </div>
        </div>
      </div>

      {!hasEnoughSol && (
        <div className="space-y-2">
          {IS_DEVNET ? (
            <>
              <a
                href={`https://faucet.solana.com/?address=${solAddress}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full text-center text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors"
                style={{ background: '#9945FF', color: '#fff' }}
              >
                Open Devnet Faucet →
              </a>

              <p className="text-xs text-zinc-600 text-center">
                Request devnet SOL, then refresh your balance and claim.
              </p>
            </>
          ) : (
            <>
              <button
                onClick={() => setShowWidget(v => !v)}
                className="w-full text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors"
                style={{ background: showWidget ? '#27272a' : '#9945FF', color: '#fff' }}
              >
                {showWidget ? 'Hide LI.FI Widget' : 'Fund via LI.FI (cross-chain)'}
              </button>

              {showWidget && (
                <div className="rounded-xl overflow-hidden border border-zinc-800" style={{ minHeight: 420 }}>
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
              )}

              <p className="text-xs text-zinc-600 text-center">
                Bridge ETH, USDC, MATIC and more to SOL in a few clicks
              </p>
            </>
          )}
        </div>
      )}

      {/* Funded confirmation */}
      {hasEnoughSol && claimState !== 'claimed' && (
        <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 rounded-lg px-3 py-2">
          <span>&#10003;</span>
          <span>{IS_DEVNET ? 'Wallet funded on devnet — ready to claim.' : 'Wallet funded — ready to claim your airdrop.'}</span>
        </div>
      )}

      {/* Claim button */}
      <button
        disabled={!canClaim}
        onClick={onClaim}
        className="w-full text-sm font-semibold px-4 py-2.5 rounded-lg disabled:opacity-40 transition-opacity"
        style={{ background: '#14F195', color: '#081016' }}
      >
        {claimState === 'claiming'
          ? 'Claiming...'
          : claimState === 'claimed'
            ? 'Airdrop Claimed'
            : 'Claim Memecoin Airdrop'}
      </button>

      {/* Error */}
      {claimError && (
        <p className="text-xs text-red-400 bg-red-950/40 border border-red-800/40 rounded-lg px-3 py-2">
          {claimError}
        </p>
      )}

      {/* Success tx link */}
      {claimTxHash && (
        <a
          href={`https://explorer.solana.com/tx/${claimTxHash}?cluster=devnet`}
          target="_blank"
          rel="noopener noreferrer"
          className="block text-xs text-center font-medium hover:underline"
          style={{ color: '#14F195' }}
        >
          View claim tx on Solana Explorer
        </a>
      )}

    </div>
  )
}
