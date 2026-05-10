import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js'

// ~$1.50 at $150/SOL — filters micro-transaction bots
const SIGNIFICANT_LAMPORTS = 0.01 * LAMPORTS_PER_SOL

export interface SolanaStats {
  walletAgeMonths: number
  significantTxCount: number
  stamps: string[]
}

export async function getWalletAgeDays(
  address: string,
  connection: Connection,
): Promise<number> {
  try {
    const pubkey = new PublicKey(address)
    const signatures = await connection.getSignaturesForAddress(pubkey, { limit: 1000 })
    if (signatures.length === 0) return 0
    const oldest = signatures[signatures.length - 1]
    if (!oldest.blockTime) return 0
    const walletAgeMs = Date.now() - oldest.blockTime * 1000
    return Math.max(0, walletAgeMs / (1000 * 60 * 60 * 24))
  } catch {
    return 0
  }
}

export async function analyzeSolanaWallet(
  address: string,
  connection: Connection,
): Promise<SolanaStats> {
  const pubkey = new PublicKey(address)
  const signatures = await connection.getSignaturesForAddress(pubkey, { limit: 1000 })

  if (signatures.length === 0) return { walletAgeMonths: 0, significantTxCount: 0, stamps: [] }

  const oldest = signatures[signatures.length - 1]
  const walletAgeMs = oldest.blockTime ? Date.now() - oldest.blockTime * 1000 : 0
  const walletAgeMonths = walletAgeMs / (1000 * 60 * 60 * 24 * 30)

  // Sample 10 recent txs to estimate significant activity ratio
  const sample = signatures.slice(0, 10)
  const txResults = await Promise.allSettled(
    sample.map(s =>
      connection.getParsedTransaction(s.signature, { maxSupportedTransactionVersion: 0 }),
    ),
  )

  let significantSample = 0
  for (const r of txResults) {
    if (r.status !== 'fulfilled' || !r.value?.meta) continue
    const { preBalances, postBalances } = r.value.meta
    if (Math.abs(postBalances[0] - preBalances[0]) >= SIGNIFICANT_LAMPORTS) significantSample++
  }

  const ratio = sample.length > 0 ? significantSample / sample.length : 0
  const significantTxCount = Math.round(ratio * signatures.length)

  const stamps: string[] = []

  if (walletAgeMonths >= 24) stamps.push(`Solana OG: ${Math.floor(walletAgeMonths / 12)}y wallet`)
  else if (walletAgeMonths >= 12) stamps.push('Solana: 1y+ wallet')
  else if (walletAgeMonths >= 6) stamps.push('Solana: 6m+ wallet')

  if (significantTxCount >= 100) stamps.push('Solana Active: 100+ txs')
  else if (significantTxCount >= 50) stamps.push('Solana Active: 50+ txs')
  else if (significantTxCount >= 10) stamps.push('Solana Active: 10+ txs')

  return { walletAgeMonths, significantTxCount, stamps }
}
