import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js'
import bs58 from 'bs58'
import type { WalletContextState } from '@solana/wallet-adapter-react'
import type { PassportData } from './gitcoin'

const MEMO_PROGRAM_ID = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr')

export async function ensureDevnetSol(
  wallet: WalletContextState,
  connection: Connection,
): Promise<void> {
  if (!wallet.publicKey) return
  const balance = await connection.getBalance(wallet.publicKey)
  if (balance < 0.005 * LAMPORTS_PER_SOL) {
    const sig = await connection.requestAirdrop(wallet.publicKey, LAMPORTS_PER_SOL)
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash()
    await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight })
  }
}

export async function mintPassportMemo(
  wallet: WalletContextState,
  connection: Connection,
  passport: PassportData,
): Promise<string> {
  if (!wallet.publicKey || !wallet.signTransaction) {
    throw new Error('Wallet nije connectan')
  }

  await ensureDevnetSol(wallet, connection)

  const memoData = JSON.stringify({
    v: 1,
    eth: passport.ethAddress ?? null,
    score: passport.score,
    threshold: passport.threshold,
    stamps: passport.stamps.slice(0, 20),
    ts: Math.floor(Date.now() / 1000),
  })

  const instruction = new TransactionInstruction({
    keys: [{ pubkey: wallet.publicKey, isSigner: true, isWritable: false }],
    programId: MEMO_PROGRAM_ID,
    data: Buffer.from(memoData, 'utf8'),
  })

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash()

  const transaction = new Transaction({
    recentBlockhash: blockhash,
    feePayer: wallet.publicKey,
  }).add(instruction)

  const signed = await wallet.signTransaction(transaction)

  // Extract txid from signed tx before sending — so we have it even if send fails
  const rawSig = signed.signatures[0]?.signature
  if (!rawSig) throw new Error('Transaction signing failed')
  const txid = bs58.encode(rawSig)

  try {
    await connection.sendRawTransaction(signed.serialize(), { skipPreflight: true, maxRetries: 5 })
  } catch (e) {
    const msg = (e as Error)?.message ?? ''
    // Already processed = transaction confirmed on a previous attempt, treat as success
    if (msg.includes('already been processed')) {
      return txid
    }
    throw e
  }

  await connection.confirmTransaction({ signature: txid, blockhash, lastValidBlockHeight })
  return txid
}

export async function getPassportFromChain(
  address: string,
  connection: Connection,
): Promise<{ score: number; threshold?: number; stamps: string[]; ts: number; eth?: string } | null> {
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
            if (data.v === 1) return data
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
