import { describe, expect, it } from 'vitest'
import {
  MAX_GITCOIN_SCORE,
  MAX_STAMPS,
  MAX_STAMP_LENGTH,
  sanitizeClaimInput,
} from '../src/lib/claimInput'

describe('sanitizeClaimInput', () => {
  it('passes through a well-formed body', () => {
    expect(
      sanitizeClaimInput({ solAddress: '  abc  ', score: 12, stamps: ['GitHub: a'], walletAgeDays: 30 }),
    ).toEqual({ solAddress: 'abc', score: 12, stamps: ['GitHub: a'], walletAgeDays: 30 })
  })

  it('handles non-object bodies', () => {
    for (const body of [null, undefined, 'x', 42]) {
      expect(sanitizeClaimInput(body)).toEqual({ solAddress: '', score: 0, stamps: [], walletAgeDays: 0 })
    }
  })

  it('replaces NaN and negative numbers and clamps huge scores', () => {
    expect(sanitizeClaimInput({ score: 'nope', walletAgeDays: -5 })).toMatchObject({ score: 0, walletAgeDays: 0 })
    expect(sanitizeClaimInput({ score: 1e9 }).score).toBe(MAX_GITCOIN_SCORE)
  })

  it('drops non-string stamps and bounds count and length', () => {
    const stamps = [1, null, 'ok', ...Array.from({ length: 100 }, () => 'x'.repeat(500))]
    const result = sanitizeClaimInput({ stamps }).stamps
    expect(result.length).toBe(MAX_STAMPS)
    expect(result[0]).toBe('ok')
    expect(result.every((s) => s.length <= MAX_STAMP_LENGTH)).toBe(true)
  })
})
