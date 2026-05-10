import { useMemo } from 'react'
import { calculatePassportScore } from '../lib/scoring'
import { evaluateAirdropEligibility } from '../lib/airdropEligibility'
import { buildJumperFundingUrl } from '../lib/lifi'

const MIN_SOL_RECOMMENDED = 0.002

interface Props {
  solAddress: string
  baseScore: number
  stamps: string[]
  walletAgeDays: number
  solBalance: number | null
}

export default function LifiAirdropPanel({
  solAddress,
  baseScore,
  stamps,
  walletAgeDays,
  solBalance,
}: Props) {
  const passportScore = useMemo(() => calculatePassportScore(baseScore, stamps), [baseScore, stamps])
  const eligibility = useMemo(
    () => evaluateAirdropEligibility({ score: passportScore, walletAgeDays }),
    [passportScore, walletAgeDays],
  )
  const fundingUrl = useMemo(() => buildJumperFundingUrl(solAddress), [solAddress])
  const hasEnoughSol = solBalance !== null ? solBalance >= MIN_SOL_RECOMMENDED : false

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
          SOL balance: {solBalance === null ? 'loading...' : `${solBalance.toFixed(4)} SOL`}
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
        disabled={!eligibility.eligible || !hasEnoughSol}
        className="w-full text-sm font-semibold px-4 py-2.5 rounded-lg disabled:opacity-40"
        style={{ background: '#14F195', color: '#081016' }}
      >
        Claim Memecoin Airdrop (coming soon)
      </button>
    </div>
  )
}

