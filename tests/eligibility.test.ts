import { describe, expect, it } from 'vitest'
import { evaluateAirdropEligibility } from '../src/lib/airdropEligibility'

const thresholds = { humanMinScore: 5, minWalletAgeDays: 1, minSolForClaim: 0.002 }

describe('evaluateAirdropEligibility', () => {
  it('accepts a score strictly above the minimum with an old enough wallet', () => {
    expect(evaluateAirdropEligibility({ score: 5.1, walletAgeDays: 1 }, thresholds)).toEqual({
      eligible: true,
      reasons: [],
    })
  })

  it('rejects a score equal to the minimum', () => {
    const result = evaluateAirdropEligibility({ score: 5, walletAgeDays: 10 }, thresholds)
    expect(result.eligible).toBe(false)
    expect(result.reasons).toHaveLength(1)
  })

  it('rejects a wallet younger than the minimum age', () => {
    const result = evaluateAirdropEligibility({ score: 20, walletAgeDays: 0 }, thresholds)
    expect(result.eligible).toBe(false)
    expect(result.reasons[0]).toMatch(/Wallet age/)
  })

  it('reports every failing rule', () => {
    expect(evaluateAirdropEligibility({ score: 0, walletAgeDays: 0 }, thresholds).reasons).toHaveLength(2)
  })

  it('treats NaN as failing', () => {
    expect(evaluateAirdropEligibility({ score: NaN, walletAgeDays: 5 }, thresholds).eligible).toBe(false)
  })
})
