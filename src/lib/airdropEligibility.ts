export const AIRDROP_MIN_SCORE = 5
export const AIRDROP_MIN_WALLET_AGE_DAYS = 1

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
): AirdropEligibilityResult {
  const reasons: string[] = []

  if (!(input.score > AIRDROP_MIN_SCORE)) {
    reasons.push(`Score must be > ${AIRDROP_MIN_SCORE}`)
  }

  if (input.walletAgeDays < AIRDROP_MIN_WALLET_AGE_DAYS) {
    reasons.push(`Wallet age must be >= ${AIRDROP_MIN_WALLET_AGE_DAYS} day`)
  }

  return {
    eligible: reasons.length === 0,
    reasons,
  }
}

