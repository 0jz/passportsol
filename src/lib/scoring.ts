const STAMP_POINTS: Array<[RegExp, number]> = [
  [/^GitHub:/,          5],
  [/^ENS:/,             5],
  [/2y.+wallet/,       15],
  [/1y\+ wallet/,      10],
  [/6m\+ wallet/,       5],
  [/100\+ txs/,        12],
  [/50\+ txs/,          8],
  [/10\+ txs/,          3],
  [/^Event: /,          8],  // verified by trusted issuer
  [/^Event\?: /,        3],  // self-reported
]

export function calculatePassportScore(gitcoinScore: number, stamps: string[]): number {
  let bonus = 0
  for (const stamp of stamps) {
    for (const [pattern, points] of STAMP_POINTS) {
      if (pattern.test(stamp)) { bonus += points; break }
    }
  }
  return Math.round((gitcoinScore + bonus) * 10) / 10
}

export function bonusFromStamps(stamps: string[]): number {
  let bonus = 0
  for (const stamp of stamps) {
    for (const [pattern, points] of STAMP_POINTS) {
      if (pattern.test(stamp)) { bonus += points; break }
    }
  }
  return bonus
}
