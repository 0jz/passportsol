import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js'
import type { WalletContextState } from '@solana/wallet-adapter-react'
import type { PassportData } from './gitcoin'

const MEMO_PROGRAM_ID = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr')
const FALLBACK_RPC = import.meta.env.VITE_SOLANA_RPC_FALLBACK as string | undefined
const RETRYABLE_ERROR_PATTERNS = [
  'blockhash not found',
  'transactionexpiredblockheightexceedederror',
  'node is behind',
  '429',
  'timed out',
  'timeout',
  'fetch failed',
]

function normalizeWalletRpcError(e: unknown): Error {
  const message = (e as { message?: string })?.message ?? String(e)
  const lower = message.toLowerCase()

  // In this devnet-only branch, a mainnet-beta 403 almost always means
  // the wallet extension itself is still pointed at Mainnet.
  if (
    lower.includes('api.mainnet-beta.solana.com') ||
    (lower.includes('403') && lower.includes('access forbidden'))
  ) {
    return new Error(
      'Phantom wallet is still using Solana Mainnet. Switch Phantom to Devnet, then try minting again.',
    )
  }

  return e instanceof Error ? e : new Error(message)
}

function isRetryableRpcError(e: unknown): boolean {
  const msg = (e as { message?: string })?.message?.toLowerCase() ?? String(e).toLowerCase()
  return RETRYABLE_ERROR_PATTERNS.some(p => msg.includes(p))
}

function fallbackConnectionFor(connection: Connection): Connection | null {
  if (!FALLBACK_RPC) return null
  if (connection.rpcEndpoint === FALLBACK_RPC) return null
  return new Connection(FALLBACK_RPC, 'confirmed')
}

async function withRpcFallback<T>(
  connection: Connection,
  op: (conn: Connection) => Promise<T>,
): Promise<T> {
  try {
    return await op(connection)
  } catch (e) {
    if (!isRetryableRpcError(e)) throw e
    const fallback = fallbackConnectionFor(connection)
    if (!fallback) throw e
    return op(fallback)
  }
}

export async function ensureDevnetSol(
  wallet: WalletContextState,
  connection: Connection,
): Promise<void> {
  if (!wallet.publicKey) return
  try {
    const balance = await withRpcFallback(connection, conn => conn.getBalance(wallet.publicKey!))
    if (balance >= 0.005 * LAMPORTS_PER_SOL) return
    const sig = await withRpcFallback(connection, conn => conn.requestAirdrop(wallet.publicKey!, LAMPORTS_PER_SOL))
    const { blockhash, lastValidBlockHeight } = await withRpcFallback(connection, conn => conn.getLatestBlockhash())
    await Promise.race([
      withRpcFallback(connection, conn => conn.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight })),
      new Promise<void>((_, reject) => setTimeout(() => reject(new Error('timeout')), 12000)),
    ])
  } catch {
    // Non-fatal: proceed to transaction; wallet may already have enough SOL
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

  const { context, value: latestBlockhash } = await withRpcFallback(
    connection,
    conn => conn.getLatestBlockhashAndContext(),
  )
  const { blockhash, lastValidBlockHeight } = latestBlockhash

  const transaction = new Transaction({
    recentBlockhash: blockhash,
    feePayer: wallet.publicKey,
  }).add(instruction)

  if (!wallet.sendTransaction) throw new Error('Wallet ne podrzava slanje transakcija')

  // MWA adapter bug workaround: allow unsigned serialization before wallet signs.
  const _origSerialize = transaction.serialize.bind(transaction)
  ;(transaction as unknown as { serialize: typeof transaction.serialize }).serialize =
    (opts?) => _origSerialize({ requireAllSignatures: false, verifySignatures: false, ...opts })

  const sendAndConfirm = async (conn: Connection): Promise<string> => {
    const txid = await wallet.sendTransaction(transaction, conn, {
      skipPreflight: true,
      minContextSlot: context.slot,
    })
    await conn.confirmTransaction({ signature: txid, blockhash, lastValidBlockHeight })
    return txid
  }

  try {
    return await sendAndConfirm(connection)
  } catch (e) {
    const normalized = normalizeWalletRpcError(e)
    if (normalized.message !== ((e as { message?: string })?.message ?? String(e))) throw normalized
    if (!isRetryableRpcError(e)) throw e
    const fallback = fallbackConnectionFor(connection)
    if (!fallback) throw e
    return sendAndConfirm(fallback)
  }
}

// Builds an unsigned memo transaction and returns it with blockhash info.
// Used by the Phantom deep link flow (sign happens in Phantom, not here).
export async function buildMemoTransaction(
  feePayer: PublicKey,
  connection: Connection,
  data: object,
): Promise<{ transaction: Transaction; blockhash: string; lastValidBlockHeight: number; minContextSlot: number }> {
  const instruction = new TransactionInstruction({
    keys: [],
    programId: MEMO_PROGRAM_ID,
    data: Buffer.from(JSON.stringify(data), 'utf8'),
  })
  const { context, value: latestBlockhash } = await withRpcFallback(
    connection,
    conn => conn.getLatestBlockhashAndContext(),
  )
  const { blockhash, lastValidBlockHeight } = latestBlockhash
  const transaction = new Transaction({ recentBlockhash: blockhash, feePayer }).add(instruction)
  return { transaction, blockhash, lastValidBlockHeight, minContextSlot: context.slot }
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

// Mints an invalidation memo: getPassportFromChain will treat this wallet
// as having no active passport until a new one is minted after this tx.
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

// Waits for a signature that was already submitted (e.g. by Phantom deep link).
// Does not use blockhash expiry: safe after redirect round-trip.
export async function waitForSignature(
  connection: Connection,
  signature: string,
  timeoutMs = 45000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs
  const fallback = fallbackConnectionFor(connection)

  while (Date.now() < deadline) {
    let value: Awaited<ReturnType<Connection['getSignatureStatus']>>['value']
    try {
      ({ value } = await connection.getSignatureStatus(signature, { searchTransactionHistory: true }))
    } catch (e) {
      if (!fallback || !isRetryableRpcError(e)) throw e
      ;({ value } = await fallback.getSignatureStatus(signature, { searchTransactionHistory: true }))
    }

    if (value?.err) throw new Error(`Transaction failed: ${JSON.stringify(value.err)}`)
    if (value?.confirmationStatus === 'confirmed' || value?.confirmationStatus === 'finalized') return
    await new Promise(r => setTimeout(r, 2000))
  }
  throw new Error('Confirmation timeout')
}

export async function getPassportFromChain(
  address: string,
  connection: Connection,
): Promise<{ score: number; threshold?: number; stamps: string[]; ts: number; eth?: string; txSig: string } | null> {
  try {
    const pubkey = new PublicKey(address)
    const signatures = await withRpcFallback(
      connection,
      conn => conn.getSignaturesForAddress(pubkey, { limit: 30 }),
    )

    for (const sig of signatures) {
      const tx = await withRpcFallback(
        connection,
        conn => conn.getParsedTransaction(sig.signature, { maxSupportedTransactionVersion: 0 }),
      )

      const logs = tx?.meta?.logMessages ?? []
      for (const log of logs) {
        const memoMatch = log.match(/Program log: Memo \(len \d+\): "(.+)"$/)
        if (memoMatch) {
          try {
            const content = memoMatch[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\')
            const parsed = JSON.parse(content)
            if (parsed.v !== 1) continue
            if (parsed.invalidated) return null
            return { ...parsed, txSig: sig.signature }
          } catch {
            // Not our memo format, skip
          }
        }
      }
    }
    return null
  } catch {
    return null
  }
}
