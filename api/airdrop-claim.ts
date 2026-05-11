import { calculatePassportScore } from '../src/lib/scoring.js'

type LifiVerificationResult = {
  allowed: boolean
  verified: boolean
  reason: 'verified' | 'not_found' | 'unreachable' | 'unexpected_shape'
}

// Checks that this Solana wallet has at least one completed bridge
// via PassportSOL's LI.FI integrator tag before allowing a claim.
async function verifyBridgedViaLifi(solAddress: string): Promise<LifiVerificationResult> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 5000)

  try {
    const url = `https://li.quest/v1/analytics/transfers?wallet=${solAddress}&integrator=passportsol&status=DONE`
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    })
    clearTimeout(timer)

    if (!res.ok) {
      return { allowed: true, verified: false, reason: 'unreachable' }
    }

    const data = await res.json() as { transfers?: unknown[]; data?: unknown[]; count?: number }
    const transfers = data.transfers ?? data.data ?? []

    if (Array.isArray(transfers)) {
      return transfers.length > 0
        ? { allowed: true, verified: true, reason: 'verified' }
        : { allowed: false, verified: false, reason: 'not_found' }
    }

    if (typeof data.count === 'number') {
      return data.count > 0
        ? { allowed: true, verified: true, reason: 'verified' }
        : { allowed: false, verified: false, reason: 'not_found' }
    }

    return { allowed: true, verified: false, reason: 'unexpected_shape' }
  } catch {
    clearTimeout(timer)
    return { allowed: true, verified: false, reason: 'unreachable' }
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

function getQuerySolAddress(req: any): string | null {
  const raw = req.query?.solAddress
  if (typeof raw === 'string') return raw.trim() || null
  if (Array.isArray(raw) && typeof raw[0] === 'string') return raw[0].trim() || null
  return null
}

export default async function handler(req: any, res: any) {
  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    res.end()
    return
  }

  if (req.method === 'GET') {
    try {
      const web3 = await import('@solana/web3.js')
      const solAddress = getQuerySolAddress(req)

      if (!solAddress) {
        sendJson(res, 400, { error: 'Missing solAddress' })
        return
      }

      const recipient = new web3.PublicKey(solAddress)
      const verification = await verifyBridgedViaLifi(recipient.toBase58())

      sendJson(res, 200, {
        ok: true,
        lifiBridgeVerified: verification.verified,
        claimAllowedByLifiGate: verification.allowed,
        reason: verification.reason,
      })
      return
    } catch (e) {
      sendJson(res, 400, { error: (e as Error).message })
      return
    }
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

    const verification = await verifyBridgedViaLifi(recipient.toBase58())
    if (!verification.allowed) {
      return sendJson(res, 403, {
        error: 'You must bridge funds via LI.FI before claiming. Use the "Fund via LI.FI" step in the app.',
      })
    }

    const campaignId = process.env.CAMPAIGN_ID ?? 'devnet-default'
    const claimKey = `${campaignId}:${recipient.toBase58()}`
    if (claimed.has(claimKey)) return sendJson(res, 409, { error: 'This wallet already claimed for this campaign' })

    const rpc = process.env.SOLANA_RPC_URL
    const mintAddress = process.env.AIRDROP_TOKEN_MINT
    const treasurySecret = process.env.CLAIM_TREASURY_SECRET
    const airdropAmount = envNum('AIRDROP_AMOUNT', 10)
    if (!rpc || !mintAddress || !treasurySecret) {
      return sendJson(res, 500, { error: 'Missing server env configuration' })
    }

    const connection = new web3.Connection(rpc, 'confirmed')
    const treasury = web3.Keypair.fromSecretKey(parseSecretKey(treasurySecret))
    const mint = new web3.PublicKey(mintAddress)

    const mintInfo = await splToken.getMint(connection, mint)
    const decimals = mintInfo.decimals
    const baseUnits = BigInt(Math.floor(airdropAmount * 10 ** decimals))
    if (baseUnits <= 0n) return sendJson(res, 400, { error: 'Airdrop amount resolves to zero base units' })

    const sourceAta = splToken.getAssociatedTokenAddressSync(mint, treasury.publicKey)
    const destinationAta = await splToken.getOrCreateAssociatedTokenAccount(connection, treasury, mint, recipient)

    const txHash = await splToken.transfer(
      connection,
      treasury,
      sourceAta,
      destinationAta.address,
      treasury.publicKey,
      baseUnits,
    )

    claimed.add(claimKey)
    sendJson(res, 200, { ok: true, txHash })
  } catch (e) {
    sendJson(res, 500, { error: (e as Error).message })
  }
}

export const config = { runtime: 'nodejs' }
