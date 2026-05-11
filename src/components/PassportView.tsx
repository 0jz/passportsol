import { calculatePassportScore, bonusFromStamps } from '../lib/scoring'
import { evaluateAirdropEligibility } from '../lib/airdropEligibility'
import { CAMPAIGN_PUBLIC_CONFIG } from '../config/campaign'

const SEAL_COLORS = ['#9945FF', '#14F195', '#00C2FF', '#FB8C00', '#E91E63', '#00BCD4']

interface BadgeInfo {
  label: string
  sub: string
  color: string
  points: number
  verified: boolean
  isEvent: boolean
  sealIndex?: number
}

function parseStamps(stamps: string[]): BadgeInfo[] {
  const badges: BadgeInfo[] = []
  stamps.forEach((s, idx) => {
    if (s.startsWith('GitHub: '))
      badges.push({ label: 'GitHub', sub: s.slice(8), color: '#e2e8f0', points: 5, verified: true, isEvent: false })
    else if (s.startsWith('SNS: '))
      badges.push({ label: '.sol', sub: s.slice(5), color: '#9945FF', points: 5, verified: true, isEvent: false })
    else if (s.startsWith('ENS: '))
      badges.push({ label: 'ENS', sub: s.slice(5), color: '#627EEA', points: 5, verified: true, isEvent: false })
    else if (s.startsWith('SolanaID: '))
      badges.push({ label: 'Solana.id', sub: s.slice(10), color: '#14F195', points: 4, verified: true, isEvent: false })
    else if (s.startsWith('Solana OG: '))
      badges.push({ label: 'Solana OG', sub: s.slice(11), color: '#F59E0B', points: 15, verified: true, isEvent: false })
    else if (s.startsWith('Solana Active: '))
      badges.push({ label: 'Active', sub: s.slice(15), color: '#00C2FF', points: 8, verified: true, isEvent: false })
    else if (s.startsWith('Solana: '))
      badges.push({ label: 'Wallet', sub: s.slice(8), color: '#9945FF', points: 5, verified: true, isEvent: false })
    else if (s.startsWith('Event: '))
      badges.push({ label: s.slice(7).replace(/ · .+$/, ''), sub: 'Verified', color: SEAL_COLORS[idx % SEAL_COLORS.length], points: 8, verified: true, isEvent: true, sealIndex: idx })
    else if (s.startsWith('Event?: '))
      badges.push({ label: s.slice(8), sub: 'Self-reported', color: SEAL_COLORS[idx % SEAL_COLORS.length], points: 3, verified: false, isEvent: true, sealIndex: idx })
  })
  return badges
}

function Seal({ label, color, verified, sealIndex }: { label: string; color: string; verified: boolean; sealIndex: number }) {
  const rot = (sealIndex % 2 === 0 ? -1 : 1) * (5 + (sealIndex % 3) * 4)
  const words = label.split(' ')
  const lines = words.length <= 2
    ? [words.join(' ')]
    : [
        words.slice(0, Math.ceil(words.length / 2)).join(' '),
        words.slice(Math.ceil(words.length / 2)).join(' '),
      ]
  return (
    <div
      className="flex items-center justify-center text-center shrink-0"
      style={{
        width: 72, height: 72, borderRadius: '50%',
        border: `2px solid ${color}`,
        boxShadow: `inset 0 0 0 3px rgba(0,0,0,0.6), 0 0 0 1px ${color}22`,
        transform: `rotate(${rot}deg)`,
        color, opacity: verified ? 1 : 0.55, padding: 6,
      }}
    >
      <div>
        {lines.map((l, i) => (
          <p key={i} className="font-bold leading-tight" style={{ fontSize: 9 }}>{l}</p>
        ))}
        {!verified && <p style={{ fontSize: 7, opacity: 0.7, marginTop: 1 }}>unverified</p>}
      </div>
    </div>
  )
}

function IdentityBadge({ label, sub, color, points }: { label: string; sub: string; color: string; points: number }) {
  return (
    <div
      className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 border"
      style={{ background: color + '18', borderColor: color + '40' }}
    >
      <div
        className="w-1.5 h-1.5 rounded-full shrink-0"
        style={{ background: color }}
      />
      <div className="min-w-0">
        <p className="text-[10px] font-bold leading-none truncate" style={{ color }}>{label}</p>
        <p className="text-[9px] text-zinc-500 leading-none mt-0.5 truncate max-w-[90px]">{sub}</p>
      </div>
      <span className="text-[9px] font-bold ml-auto shrink-0" style={{ color: color + 'cc' }}>+{points}</span>
    </div>
  )
}

interface Props {
  stamps: string[]
  score: number
  threshold: number
  solAddress?: string | null
  ethAddress?: string | null
  txHash?: string
  mintedAt?: number
  walletAgeDays?: number
}

export default function PassportView({
  stamps,
  score,
  threshold,
  solAddress,
  ethAddress,
  txHash,
  mintedAt,
  walletAgeDays = 0,
}: Props) {
  const passportScore = calculatePassportScore(score, stamps)
  const bonus = bonusFromStamps(stamps)
  const isVerified = passportScore >= threshold
  const badges = parseStamps(stamps)
  const identityBadges = badges.filter(b => !b.isEvent)
  const eventBadges = badges.filter(b => b.isEvent)
  const shortTx = (s: string) => `${s.slice(0, 6)}...${s.slice(-4)}`
  const eligibility = evaluateAirdropEligibility({ score: passportScore, walletAgeDays }, CAMPAIGN_PUBLIC_CONFIG)

  return (
    <div className="rounded-xl border border-zinc-700 bg-zinc-900 overflow-hidden" style={{ fontFamily: 'monospace' }}>
      {/* Header */}
      <div
        className="px-5 pt-4 pb-3 border-b border-zinc-800 flex items-start justify-between"
        style={{ background: 'linear-gradient(135deg, rgba(153,69,255,0.06) 0%, rgba(20,241,149,0.04) 100%)' }}
      >
        <div>
          <p className="text-xs tracking-[0.25em] uppercase mb-0.5" style={{ color: '#9945FF' }}>Solana</p>
          <p className="text-xs tracking-[0.25em] uppercase" style={{ color: '#14F195' }}>Passport</p>
          {mintedAt && (
            <p className="text-xs text-zinc-600 mt-1.5">{new Date(mintedAt * 1000).toLocaleDateString()}</p>
          )}
        </div>
        <div className="text-right">
          <p className="text-4xl font-bold leading-none" style={{ color: '#14F195' }}>
            {passportScore.toFixed(1)}
          </p>
          <p className="text-xs mt-1" style={{ color: isVerified ? '#14F195' : '#71717a' }}>
            {isVerified ? 'Verified Human' : `< ${threshold} threshold`}
          </p>
          {bonus > 0 && (
            <p className="text-xs text-zinc-600 mt-0.5">
              {score.toFixed(1)} Gitcoin + {bonus} pts
            </p>
          )}
        </div>
      </div>

      {/* Addresses */}
      {(solAddress || ethAddress) && (
        <div className="px-5 py-3 border-b border-zinc-800 space-y-1.5">
          {solAddress && (
            <div className="flex gap-3">
              <span className="text-xs text-zinc-600 w-20 shrink-0">SOL</span>
              <span className="text-xs text-zinc-400 break-all">{solAddress}</span>
            </div>
          )}
          {ethAddress && (
            <div className="flex gap-3">
              <span className="text-xs text-zinc-600 w-20 shrink-0">ETH</span>
              <span className="text-xs text-zinc-400 break-all">{ethAddress}</span>
            </div>
          )}
        </div>
      )}

      {/* Badge collection */}
      {badges.length > 0 && (
        <div className="px-5 py-4 border-b border-zinc-800">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-zinc-600 tracking-[0.2em] uppercase">Badge Collection</p>
            <span
              className="text-[10px] font-bold px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(20,241,149,0.12)', color: '#14F195', border: '1px solid rgba(20,241,149,0.25)' }}
            >
              {badges.length} badge{badges.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Identity badges as chips */}
          {identityBadges.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {identityBadges.map((b, i) => (
                <IdentityBadge key={i} label={b.label} sub={b.sub} color={b.color} points={b.points} />
              ))}
            </div>
          )}

          {/* Event stamps as seals */}
          {eventBadges.length > 0 && (
            <div className="flex flex-wrap gap-3 mt-1">
              {eventBadges.map((b, i) => (
                <Seal key={i} label={b.label} color={b.color} verified={b.verified} sealIndex={b.sealIndex ?? i} />
              ))}
            </div>
          )}

          {badges.length === 0 && (
            <p className="text-xs text-zinc-600 italic">No badges collected yet</p>
          )}
        </div>
      )}

      {/* Eligibility */}
      <div className="px-5 py-3 space-y-2">
        <div className="text-xs">
          <span className="text-zinc-500">Airdrop eligibility: </span>
          {eligibility.eligible ? (
            <span style={{ color: '#14F195' }}>Eligible (score &gt; 5, wallet age &gt;= 1 day)</span>
          ) : (
            <span className="text-amber-400">{eligibility.reasons.join(' · ')}</span>
          )}
        </div>
        <div className="text-xs text-zinc-600">Wallet age: {walletAgeDays.toFixed(2)} day(s)</div>

        {txHash && (
          <a
            href={`https://explorer.solana.com/tx/${txHash}?cluster=devnet`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs break-all transition-colors hover:text-white"
            style={{ color: '#9945FF' }}
          >
            {shortTx(txHash)} - View on Explorer
          </a>
        )}
      </div>
    </div>
  )
}
