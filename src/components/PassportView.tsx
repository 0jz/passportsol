import { calculatePassportScore, bonusFromStamps } from '../lib/scoring'
import { evaluateAirdropEligibility } from '../lib/airdropEligibility'

const SEAL_COLORS = ['#9945FF', '#14F195', '#00C2FF', '#FB8C00', '#E91E63', '#00BCD4']

function parseStamps(stamps: string[]) {
  const identity: { label: string; value: string }[] = []
  const events: { name: string; verified: boolean }[] = []

  for (const s of stamps) {
    if (s.startsWith('GitHub: ')) identity.push({ label: 'GitHub', value: s.slice(8) })
    else if (s.startsWith('SNS: ')) identity.push({ label: '.sol', value: s.slice(5) })
    else if (s.startsWith('ENS: ')) identity.push({ label: 'ENS', value: s.slice(5) })
    else if (s.startsWith('SolanaID: ')) identity.push({ label: 'Solana.id', value: s.slice(10) })
    else if (s.startsWith('Solana OG: ')) identity.push({ label: 'Wallet', value: s.slice(11) })
    else if (s.startsWith('Solana Active: ')) identity.push({ label: 'Activity', value: s.slice(15) })
    else if (s.startsWith('Solana: ')) identity.push({ label: 'Wallet', value: s.slice(8) })
    else if (s.startsWith('Event: ')) events.push({ name: s.slice(7).replace(/ · .+$/, ''), verified: true })
    else if (s.startsWith('Event?: ')) events.push({ name: s.slice(8), verified: false })
  }

  return { identity, events }
}

function Seal({ name, verified, index }: { name: string; verified: boolean; index: number }) {
  const color = SEAL_COLORS[index % SEAL_COLORS.length]
  const rot = (index % 2 === 0 ? -1 : 1) * (5 + (index % 3) * 4)
  const words = name.split(' ')
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
        width: 72,
        height: 72,
        borderRadius: '50%',
        border: `2px solid ${color}`,
        boxShadow: `inset 0 0 0 3px rgba(0,0,0,0.6), 0 0 0 1px ${color}22`,
        transform: `rotate(${rot}deg)`,
        color,
        opacity: verified ? 1 : 0.55,
        padding: 6,
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
  const { identity, events } = parseStamps(stamps)
  const shortTx = (s: string) => `${s.slice(0, 6)}...${s.slice(-4)}`
  const eligibility = evaluateAirdropEligibility({ score: passportScore, walletAgeDays })

  return (
    <div className="rounded-xl border border-zinc-700 bg-zinc-900 overflow-hidden" style={{ fontFamily: 'monospace' }}>
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

      {(identity.length > 0 || ethAddress || solAddress) && (
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
          {identity.map(({ label, value }) => (
            <div key={label + value} className="flex gap-3">
              <span className="text-xs text-zinc-600 w-20 shrink-0">{label}</span>
              <span className="text-xs text-zinc-300 truncate">{value}</span>
            </div>
          ))}
        </div>
      )}

      {events.length > 0 && (
        <div className="px-5 py-4 border-b border-zinc-800">
          <p className="text-xs text-zinc-600 tracking-[0.2em] uppercase mb-3">Stamps</p>
          <div className="flex flex-wrap gap-3">
            {events.map((ev, i) => (
              <Seal key={ev.name + i} name={ev.name} verified={ev.verified} index={i} />
            ))}
          </div>
        </div>
      )}

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

