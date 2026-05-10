import { useMemo } from 'react'
import { calculatePassportScore } from '../lib/scoring'
import { evaluateAirdropEligibility } from '../lib/airdropEligibility'
import { buildJumperFundingUrl } from '../lib/lifi'
import { CAMPAIGN_PUBLIC_CONFIG } from '../config/campaign'

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
}: Props) {
  const passportScore = useMemo(() => calculatePassportScore(baseScore, stamps), [baseScore, stamps])
  const eligibility = useMemo(
    () => evaluateAirdropEligibility({ score: passportScore, walletAgeDays }, CAMPAIGN_PUBLIC_CONFIG),
    [passportScore, walletAgeDays],
  )
  const fundingUrl = useMemo(() => buildJumperFundingUrl(solAddress), [solAddress])
  const hasEnoughSol = solBalance !== null ? solBalance >= CAMPAIGN_PUBLIC_CONFIG.minSolForClaim : false
  const canClaim = eligibility.eligible && hasEnoughSol && claimState !== 'claiming' && claimState !== 'claimed'

  return (
    <div className="rounded-xl border border-zinc-700 bg-zinc-900 p-4 space-y-3">
      <div>
        <p className="text-sm font-semibold text-white">LI.FI Airdrop Rail</p>
        <p className="text-xs text-zinc-500">
          Cross-chain funding + eligibility-gated memecoin airdrop claim.
        </p>
      </div>

      <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-xs space-y-1">
        <p className="text-zinc-400">Eligibility</p>
        <p className={eligibility.eligible ? 'text-emerald-400' : 'text-amber-400'}>
          {eligibility.eligible ? 'Eligible' : eligibility.reasons.join(' · ')}
        </p>
        <p className="text-zinc-600">Wallet age: {walletAgeDays.toFixed(2)} day(s)</p>
        <p className="text-zinc-600">
          SOL balance: {solBalance === null ? 'loading...' : `${solBalance.toFixed(6)} SOL`}
        </p>
      </div>

      {!hasEnoughSol && (
        <a
          href={fundingUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full text-center text-sm font-semibold px-4 py-2.5 rounded-lg"
          style={{ background: '#06b6d4', color: '#081016', textDecoration: 'none' }}
        >
          Fund Wallet via LI.FI (Jumper)
        </a>
      )}

      <button
        disabled={!canClaim}
        onClick={onClaim}
        className="w-full text-sm font-semibold px-4 py-2.5 rounded-lg disabled:opacity-40"
        style={{ background: '#14F195', color: '#081016' }}
      >
        {claimState === 'claiming'
          ? 'Claiming...'
          : claimState === 'claimed'
            ? 'Claimed'
            : 'Claim Memecoin Airdrop'}
      </button>

      {claimError && <p className="text-xs text-red-400">{claimError}</p>}
      {claimTxHash && (
        <a
          href={`https://explorer.solana.com/tx/${claimTxHash}?cluster=devnet`}
          target="_blank"
          rel="noopener noreferrer"
          className="block text-xs text-cyan-400 hover:text-cyan-300"
        >
          View claim tx on Solana Explorer
        </a>
      )}
    </div>
  )
}

