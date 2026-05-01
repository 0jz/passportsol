import {
  Connection,
  PublicKey,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js'
import type { WalletContextState } from '@solana/wallet-adapter-react'
import type { PassportData } from './gitcoin'

const MEMO_PROGRAM_ID = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr')

export async function ensureDevnetSol(
  wallet: WalletContextState,
  connection: Connection,
): Promise<void> {
  if (!wallet.publicKey) return
  try {
    const balance = await connection.getBalance(wallet.publicKey)
    if (balance >= 0.005 * LAMPORTS_PER_SOL) return
    const sig = await connection.requestAirdrop(wallet.publicKey, LAMPORTS_PER_SOL)
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash()
    await Promise.race([
      connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }),
      new Promise<void>((_, reject) => setTimeout(() => reject(new Error('timeout')), 12000)),
    ])
  } catch {
    // Non-fatal — proceed to transaction; wallet may already have enough SOL
  }
}

// Shared: sign and send a memo transaction, return the txid
async function sendMemo(
  wallet: WalletContextState,
  connection: Connection,
  data: object,
): Promise<string> {
  if (!wallet.publicKey) throw new Error('Wallet nije connectan')

  await ensureDevnetSol(wallet, connection)

  const instruction = new TransactionInstruction({
    keys: [],
    programId: MEMO_PROGRAM_ID,
    data: Buffer.from(JSON.stringify(data), 'utf8'),
  })

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash()

  const message = new TransactionMessage({
    payerKey: wallet.publicKey,
    recentBlockhash: blockhash,
    instructions: [instruction],
  }).compileToV0Message()

  const transaction = new VersionedTransaction(message)

  if (!wallet.sendTransaction) throw new Error('Wallet ne podržava slanje transakcija')

  const txid = await wallet.sendTransaction(transaction, connection)
  await connection.confirmTransaction({ signature: txid, blockhash, lastValidBlockHeight })
  return txid
}

export async function mintPassportMemo(
  wallet: WalletContextState,
  connection: Connection,
  passport: PassportData,
): Promise<string> {
  return sendMemo(wallet, connection, {
    v: 1,
    eth: passport.ethAddress ?? null,
    score: passport.score,
    threshold: passport.threshold,
    stamps: passport.stamps.slice(0, 20),
    ts: Math.floor(Date.now() / 1000),
  })
}

// Mints an invalidation memo — getPassportFromChain will treat this wallet
// as having no passport until a new one is minted after this transaction.
export async function invalidatePassport(
  wallet: WalletContextState,
  connection: Connection,
): Promise<void> {
  await sendMemo(wallet, connection, {
    v: 1,
    invalidated: true,
    ts: Math.floor(Date.now() / 1000),
  })
}

export async function getPassportFromChain(
  address: string,
  connection: Connection,
): Promise<{ score: number; threshold?: number; stamps: string[]; ts: number; eth?: string; txSig: string } | null> {
  try {
    const pubkey = new PublicKey(address)
    const signatures = await connection.getSignaturesForAddress(pubkey, { limit: 30 })

    for (const sig of signatures) {
      const tx = await connection.getParsedTransaction(sig.signature, {
        maxSupportedTransactionVersion: 0,
      })

      const logs = tx?.meta?.logMessages ?? []
      for (const log of logs) {
        const memoMatch = log.match(/Program log: Memo \(len \d+\): "(.+)"$/)
        if (memoMatch) {
          try {
            const content = memoMatch[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\')
            const data = JSON.parse(content)
            if (data.v !== 1) continue
            // Invalidation memo found — wallet has no active passport
            if (data.invalidated) return null
            return { ...data, txSig: sig.signature }
          } catch {
            // not our memo, skip
          }
        }
      }
    }
    return null
  } catch {
    return null
  }
}
