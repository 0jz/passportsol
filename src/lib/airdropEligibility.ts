import type { EligibilityThresholds } from '../config/campaign'

export interface AirdropEligibilityInput {
  score: number
  walletAgeDays: number
}

export interface AirdropEligibilityResult {
  eligible: boolean
  reasons: string[]
}

export function evaluateAirdropEligibility(
  input: AirdropEligibilityInput,
  thresholds: EligibilityThresholds = { humanMinScore: 5, minWalletAgeDays: 1, minSolForClaim: 0.000005 },
): AirdropEligibilityResult {
  const reasons: string[] = []

  if (!(input.score > thresholds.humanMinScore)) {
    reasons.push(`Score must be > ${thresholds.humanMinScore}`)
  }

  if (input.walletAgeDays < thresholds.minWalletAgeDays) {
    reasons.push(`Wallet age must be >= ${thresholds.minWalletAgeDays} day`)
  }

  return {
    eligible: reasons.length === 0,
    reasons,
  }
}

