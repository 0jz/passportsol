import { useMemo, useCallback } from 'react'
import { calculatePassportScore } from '../lib/scoring'
import { evaluateAirdropEligibility } from '../lib/airdropEligibility'
import { CAMPAIGN_PUBLIC_CONFIG } from '../config/campaign'

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

export default function AirdropClaimPanel({
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

  const handleRefreshClick = useCallback(() => onBalanceRefresh(), [onBalanceRefresh])

  return (
    <div className="rounded-xl border border-zinc-700 bg-zinc-900 p-4 space-y-3">
      <div>
        <p className="text-sm font-semibold text-white">
          {IS_DEVNET ? 'Devnet Claim Rail' : 'Airdrop Claim Rail'}
        </p>
        <p className="text-xs text-zinc-500 mt-0.5">
          {IS_DEVNET
            ? 'Fund your wallet from the Solana faucet, then claim.'
            : 'Fund your Solana wallet with enough SOL, then claim the airdrop.'}
        </p>
      </div>

      <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3 space-y-1.5 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-zinc-500">Eligibility</span>
          <span className={eligibility.eligible ? 'text-emerald-400 font-medium' : 'text-amber-400'}>
            {eligibility.eligible ? 'Eligible' : eligibility.reasons.join(' | ')}
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
          <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3 space-y-2">
            <p className="text-xs text-zinc-500">
              {IS_DEVNET ? 'Fund this devnet address' : 'Fund this Solana address'}
            </p>
            <p className="font-mono text-xs text-zinc-300 break-all bg-zinc-900 rounded-md px-3 py-2 select-all">
              {solAddress}
            </p>
          </div>

          {IS_DEVNET && (
            <a
              href={`https://faucet.solana.com/?address=${solAddress}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full text-center text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors"
              style={{ background: '#9945FF', color: '#fff' }}
            >
              Open Devnet Faucet {'->'}
            </a>
          )}

          <p className="text-xs text-zinc-600 text-center">
            {IS_DEVNET
              ? 'Request devnet SOL, then refresh your balance and claim.'
              : 'Send SOL to this address, then refresh your balance and claim.'}
          </p>
        </div>
      )}

      {hasEnoughSol && claimState !== 'claimed' && (
        <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 rounded-lg px-3 py-2">
          <span>&#10003;</span>
          <span>{IS_DEVNET ? 'Wallet funded on devnet - ready to claim.' : 'Wallet funded - ready to claim your airdrop.'}</span>
        </div>
      )}

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

      {claimError && (
        <p className="text-xs text-red-400 bg-red-950/40 border border-red-800/40 rounded-lg px-3 py-2">
          {claimError}
        </p>
      )}

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
