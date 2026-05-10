import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js'

// ~$1.50 at $150/SOL — filters micro-transaction bots
const SIGNIFICANT_LAMPORTS = 0.01 * LAMPORTS_PER_SOL

// Races a promise against a timeout; resolves to null on timeout instead of throwing
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    promise,
    new Promise<null>(resolve => setTimeout(() => resolve(null), ms)),
  ])
}

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
    const result = await withTimeout(
      connection.getSignaturesForAddress(pubkey, { limit: 1000 }),
      8000,
    )
    if (!result || result.length === 0) return 0
    const oldest = result[result.length - 1]
    if (!oldest.blockTime) return 0
    return Math.max(0, (Date.now() - oldest.blockTime * 1000) / (1000 * 60 * 60 * 24))
  } catch {
    return 0
  }
}

export async function analyzeSolanaWallet(
  address: string,
  connection: Connection,
): Promise<SolanaStats> {
  const empty: SolanaStats = { walletAgeMonths: 0, significantTxCount: 0, stamps: [] }

  try {
    const pubkey = new PublicKey(address)

    // Fetch up to 1000 signatures with a timeout
    const signatures = await withTimeout(
      connection.getSignaturesForAddress(pubkey, { limit: 1000 }),
      8000,
    )
    if (!signatures || signatures.length === 0) return empty

    const oldest = signatures[signatures.length - 1]
    const walletAgeMs = oldest.blockTime ? Date.now() - oldest.blockTime * 1000 : 0
    const walletAgeMonths = walletAgeMs / (1000 * 60 * 60 * 24 * 30)

    // Sample up to 8 recent txs to estimate activity (fewer = faster, less rate-limit risk)
    const sample = signatures.slice(0, 8)
    const txResults = await withTimeout(
      Promise.allSettled(
        sample.map(s =>
          connection.getParsedTransaction(s.signature, {
            maxSupportedTransactionVersion: 0,
          }),
        ),
      ),
      10000,
    )

    let significantSample = 0
    if (txResults) {
      for (const r of txResults) {
        if (r.status !== 'fulfilled' || !r.value?.meta) continue
        const { preBalances, postBalances } = r.value.meta
        if (Math.abs(postBalances[0] - preBalances[0]) >= SIGNIFICANT_LAMPORTS) {
          significantSample++
        }
      }
    }

    const ratio = sample.length > 0 ? significantSample / sample.length : 0
    const significantTxCount = Math.round(ratio * signatures.length)

    const stamps: string[] = []

    // Wallet age stamps — format must match scoring.ts patterns
    if (walletAgeMonths >= 24) {
      stamps.push(`Solana OG: ${Math.floor(walletAgeMonths / 12)}y wallet`)
    } else if (walletAgeMonths >= 12) {
      stamps.push('Solana: 1y+ wallet')
    } else if (walletAgeMonths >= 6) {
      stamps.push('Solana: 6m+ wallet')
    }

    // Activity stamps — format must match scoring.ts patterns
    if (significantTxCount >= 100) {
      stamps.push('Solana Active: 100+ txs')
    } else if (significantTxCount >= 50) {
      stamps.push('Solana Active: 50+ txs')
    } else if (significantTxCount >= 10) {
      stamps.push('Solana Active: 10+ txs')
    }

    return { walletAgeMonths, significantTxCount, stamps }
  } catch {
    return empty
  }
}
