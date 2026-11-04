const STAMP_POINTS: Array<[RegExp, number]> = [
  [/^GitHub:/,          5],
  [/^ENS:/,             5],
  [/^SNS:/,             5],
  [/^SolanaID:/,        4],
  [/2y.+wallet/,       15],
  [/1y\+ wallet/,      10],
  [/6m\+ wallet/,       5],
  [/100\+ txs/,        12],
  [/50\+ txs/,          8],
  [/10\+ txs/,          3],
  [/^Event: /,          8],  // verified by trusted issuer
  [/^Event\?: /,        3],  // self-reported
]

/**
 * Sum of bonus points for a list of stamps. Each stamp category counts at most
 * once, so repeating a stamp (e.g. many "GitHub: x" entries) cannot inflate the
 * score. Unknown stamps are worth nothing.
 */
export function bonusFromStamps(stamps: string[]): number {
  const counted = new Set<number>()
  let bonus = 0
  for (const stamp of stamps) {
    const index = STAMP_POINTS.findIndex(([pattern]) => pattern.test(stamp))
    if (index === -1 || counted.has(index)) continue
    counted.add(index)
    bonus += STAMP_POINTS[index][1]
  }
  return bonus
}

export function calculatePassportScore(gitcoinScore: number, stamps: string[]): number {
  return Math.round((gitcoinScore + bonusFromStamps(stamps)) * 10) / 10
}
