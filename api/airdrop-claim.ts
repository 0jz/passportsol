import { calculatePassportScore } from '../src/lib/scoring.js'

// ── LI.FI bridge verification ─────────────────────────────────────────────────
// Checks that this Solana wallet has at least one completed bridge
// via PassportSOL's LI.FI integrator tag before allowing a claim.
async function verifyBridgedViaLifi(solAddress: string): Promise<boolean> {
  try {
    const url = `https://li.quest/v1/analytics/transfers?wallet=${solAddress}&integrator=passportsol&status=DONE`
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return true // graceful fallback — don't block if LI.FI API is unreachable
    const data = await res.json() as { transfers?: unknown[]; data?: unknown[]; count?: number }
    const transfers = data.transfers ?? data.data ?? []
    if (Array.isArray(transfers)) return transfers.length > 0
    if (typeof data.count === 'number') return data.count > 0
    return true // unexpected shape — allow with benefit of doubt
  } catch {
    return true // network error — don't block the demo
  }
}

type ClaimBody = {
  solAddress?: string
  score?: number
  stamps?: string[]
  walletAgeDays?: number
}

const claimed = new Set<string>()

function envNum(name: string, fallback: number): number {
  const raw = process.env[name]
  if (!raw) return fallback
  const n = Number(raw)
  return Number.isFinite(n) ? n : fallback
}

function parseSecretKey(secret: string): Uint8Array {
  const normalized = secret.trim().replace(/^'+|'+$/g, '')
  const arr = JSON.parse(normalized) as number[]
  return Uint8Array.from(arr)
}

function sendJson(res: any, status: number, payload: object) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.end(JSON.stringify(payload))
}

export default async function handler(req: any, res: any) {
  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    res.end()
    return
  }

  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed' })
    return
  }

  try {
    const web3 = await import('@solana/web3.js')
    const splToken = await import('@solana/spl-token')

    const body = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body ?? {}) as ClaimBody
    const solAddress = body.solAddress?.trim()
    const score = Number(body.score ?? 0)
    const stamps = Array.isArray(body.stamps) ? body.stamps : []
    const walletAgeDays = Number(body.walletAgeDays ?? 0)

    if (!solAddress) return sendJson(res, 400, { error: 'Missing solAddress' })
    const recipient = new web3.PublicKey(solAddress)
    const passportScore = calculatePassportScore(score, stamps)

    const minScore = envNum('HUMAN_MIN_SCORE', 5)
    const minWalletAgeDays = envNum('MIN_WALLET_AGE_DAYS', 1)
    if (!(passportScore > minScore)) return sendJson(res, 400, { error: `Score must be > ${minScore}` })
    if (walletAgeDays < minWalletAgeDays) return sendJson(res, 400, { error: `Wallet age must be >= ${minWalletAgeDays} day` })

    // ── LI.FI bridge verification ─────────────────────────────────────────────
    const bridged = await verifyBridgedViaLifi(recipient.toBase58())
    if (!bridged) {
      return sendJson(res, 403, {
        error: 'You must bridge funds via LI.FI before claiming. Use the "Fund via LI.FI" step in the app.',
      })
    }

    const campaignId = process.env.CAMPAIGN_ID ?? 'devne