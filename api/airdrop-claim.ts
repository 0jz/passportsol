import { Connection, Keypair, PublicKey } from '@solana/web3.js'
import { getAssociatedTokenAddressSync, getMint, getOrCreateAssociatedTokenAccount, transfer } from '@solana/spl-token'
import { calculatePassportScore } from '../src/lib/scoring'

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
    const body = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body ?? {}) as ClaimBody
    const solAddress = body.solAddress?.trim()
    const score = Number(body.score ?? 0)
    const stamps = Array.isArray(body.stamps) ? body.stamps : []
    const walletAgeDays = Number(body.walletAgeDays ?? 0)

    if (!solAddress) return sendJson(res, 400, { error: 'Missing solAddress' })
    const recipient = new PublicKey(solAddress)
    const passportScore = calculatePassportScore(score, stamps)

    const minScore = envNum('HUMAN_MIN_SCORE', 5)
    const minWalletAgeDays = envNum('MIN_WALLET_AGE_DAYS', 1)
    if (!(passportScore > minScore)) return sendJson(res, 400, { error: `Score must be > ${minScore}` })
    if (walletAgeDays < minWalletAgeDays) return sendJson(res, 400, { error: `Wallet age must be >= ${minWalletAgeDays} day` })

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

    const connection = new Connection(rpc, 'confirmed')
    const treasury = Keypair.fromSecretKey(parseSecretKey(treasurySecret))
    const mint = new PublicKey(mintAddress)

    const mintInfo = await getMint(connection, mint)
    const decimals = mintInfo.decimals
    const baseUnits = BigInt(Math.floor(airdropAmount * 10 ** decimals))
    if (baseUnits <= 0n) return sendJson(res, 400, { error: 'Airdrop amount resolves to zero base units' })

    const sourceAta = getAssociatedTokenAddressSync(mint, treasury.publicKey)
    const destinationAta = await getOrCreateAssociatedTokenAccount(connection, treasury, mint, recipient)

    const txHash = await transfer(
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

