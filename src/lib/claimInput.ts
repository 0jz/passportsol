export const MAX_GITCOIN_SCORE = 100
export const MAX_STAMPS = 32
export const MAX_STAMP_LENGTH = 100
export const MAX_WALLET_AGE_DAYS = 36_500

export interface ClaimInput {
  solAddress: string
  score: number
  stamps: string[]
  walletAgeDays: number
}

function finiteOr(value: unknown, fallback: number): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

/**
 * Normalizes an untrusted claim request body. The claim route still trusts the
 * client for the values themselves (see README), but this bounds them so that
 * NaN, negative, absurdly large or oversized inputs cannot slip through.
 */
export function sanitizeClaimInput(body: unknown): ClaimInput {
  const raw = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>

  const stamps = (Array.isArray(raw.stamps) ? raw.stamps : [])
    .filter((s): s is string => typeof s === 'string')
    .slice(0, MAX_STAMPS)
    .map((s) => s.slice(0, MAX_STAMP_LENGTH))

  return {
    solAddress: typeof raw.solAddress === 'string' ? raw.solAddress.trim() : '',
    score: Math.min(Math.max(finiteOr(raw.score, 0), 0), MAX_GITCOIN_SCORE),
    stamps,
    walletAgeDays: Math.min(Math.max(finiteOr(raw.walletAgeDays, 0), 0), MAX_WALLET_AGE_DAYS),
  }
}
