import { describe, expect, it } from 'vitest'
import { bonusFromStamps, calculatePassportScore } from '../src/lib/scoring'

describe('scoring', () => {
  it('returns the gitcoin score when there are no stamps', () => {
    expect(calculatePassportScore(7.5, [])).toBe(7.5)
  })

  it('adds bonuses for known stamps', () => {
    expect(bonusFromStamps(['GitHub: octocat', 'ENS: vitalik.eth', 'SNS: foo.sol'])).toBe(15)
    expect(bonusFromStamps(['SolanaID: verified'])).toBe(4)
  })

  it('scores wallet age and activity tiers', () => {
    expect(bonusFromStamps(['2y wallet'])).toBe(15)
    expect(bonusFromStamps(['1y+ wallet'])).toBe(10)
    expect(bonusFromStamps(['100+ txs'])).toBe(12)
    expect(bonusFromStamps(['10+ txs'])).toBe(3)
  })

  it('weights verified events above self-reported ones', () => {
    expect(bonusFromStamps(['Event: Hackathon'])).toBe(8)
    expect(bonusFromStamps(['Event?: Meetup'])).toBe(3)
  })

  it('ignores unknown stamps', () => {
    expect(bonusFromStamps(['Twitter: someone', ''])).toBe(0)
  })

  it('counts each stamp category only once', () => {
    const spam = Array.from({ length: 50 }, (_, i) => `GitHub: user${i}`)
    expect(bonusFromStamps(spam)).toBe(5)
    expect(calculatePassportScore(0, spam)).toBe(5)
  })

  it('rounds to one decimal place', () => {
    expect(calculatePassportScore(1.23, ['GitHub: a'])).toBe(6.2)
  })
})
