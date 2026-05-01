// Phantom Provider Deep Link API
// Docs: https://docs.phantom.app/solana/integrating-with-provider-api/provider-deeplinks
//
// Uses HTTPS deep links (not MWA loopback) — works in Chrome/Brave on Android.
// Encryption: x25519 DH + XSalsa20-Poly1305 (= NaCl box).

import nacl from 'tweetnacl'
import bs58 from 'bs58'

// ── Storage keys ────────────────────────────────────────────────────────────

const SK = {
  kp:      'pdl_kp',    // our x25519 keypair (persists for the browser session)
  session: 'pdl_sess',  // Phantom session returned after connect
  pending: 'pdl_pend',  // operation pending a sign redirect
}

// ── Types ────────────────────────────────────────────────────────────────────

interface DLKeypair  { priv: string; pub: string }    // base58
interface DLSession  { phantomPub: string; session: string; walletPub: string }
export interface PendingOp {
  op: 'mint' | 'delete' | 'remint'
  txB58: string          // base58 unsigned serialized transaction
  blockhash: string
  lastValidBlockHeight: number
}

// ── Crypto helpers ────────────────────────────────────────────────────────────

function getOrCreateKeypair(): DLKeypair {
  try {
    const s = localStorage.getItem(SK.kp)
    if (s) return JSON.parse(s)
  } catch {}
  const kpRaw = nacl.box.keyPair()
  const kp: DLKeypair = { priv: bs58.encode(kpRaw.secretKey), pub: bs58.encode(kpRaw.publicKey) }
  localStorage.setItem(SK.kp, JSON.stringify(kp))
  return kp
}

function naclEncrypt(msg: string, myPrivB58: string, theirPubB58: string) {
  const nonce     = nacl.randomBytes(24)
  const sharedKey = nacl.box.before(bs58.decode(theirPubB58), bs58.decode(myPrivB58))
  const bytes     = nacl.box.after(new TextEncoder().encode(msg), nonce, sharedKey)
  return { nonce: bs58.encode(nonce), payload: bs58.encode(bytes) }
}

function naclDecrypt(payloadB58: string, nonceB58: string, myPrivB58: string, theirPubB58: string): unknown {
  const sharedKey = nacl.box.before(bs58.decode(theirPubB58), bs58.decode(myPrivB58))
  const dec       = nacl.box.open.after(bs58.decode(payloadB58), bs58.decode(nonceB58), sharedKey)
  if (!dec) throw new Error('Decryption failed')
  return JSON.parse(new TextDecoder().decode(dec))
}

// ── Session helpers ───────────────────────────────────────────────────────────

export function getSession(): DLSession | null {
  try { return JSON.parse(localStorage.getItem(SK.session) ?? 'null') } catch { return null }
}

export function clearSession() {
  localStorage.removeItem(SK.session)
  localStorage.removeItem(SK.kp)
  localStorage.removeItem(SK.pending)
}

function setPending(p: PendingOp) {
  localStorage.setItem(SK.pending, JSON.stringify(p))
}

export function getPending(): PendingOp | null {
  try { return JSON.parse(localStorage.getItem(SK.pending) ?? 'null') } catch { return null }
}

export function clearPending() {
  localStorage.removeItem(SK.pending)
}

// ── Deep link launchers ───────────────────────────────────────────────────────

function redirectBase() {
  return window.location.origin + window.location.pathname
}

/** Step 1 — open Phantom connect screen */
export function phantomConnect() {
  const kp = getOrCreateKeypair()
  const p = new URLSearchParams({
    app_url:                      window.location.origin,
    dapp_encryption_public_key:   kp.pub,
    redirect_link:                redirectBase(),
    cluster:                      'devnet',
  })
  window.location.href = `https://phantom.app/ul/v1/connect?${p}`
}

/** Step 2 — open Phantom signing screen with a pre-built unsigned transaction */
export function phantomSignAndSend(pending: PendingOp) {
  const kp   = getOrCreateKeypair()
  const sess = getSession()
  if (!sess) throw new Error('Not connected via deep link')

  setPending(pending)

  const { nonce, payload } = naclEncrypt(
    JSON.stringify({
      transaction:  pending.txB58,
      session:      sess.session,
      sendOptions:  { skipPreflight: true },
    }),
    kp.priv,
    sess.phantomPub,
  )

  const p = new URLSearchParams({
    dapp_encryption_public_key: kp.pub,
    nonce,
    redirect_link:              redirectBase(),
    payload,
  })
  window.location.href = `https://phantom.app/ul/v1/signAndSendTransaction?${p}`
}

// ── Redirect handler (call on every page load) ────────────────────────────────

export type DeeplinkReturn =
  | { type: 'connected'; walletPub: string }
  | { type: 'signed';    signature: string; pending: PendingOp }
  | { type: 'none' }

const RELAY_KEY    = '__phantom_relay'
const RELAY_TTL_MS = 5 * 60 * 1000

export function handleDeeplinkReturn(): DeeplinkReturn {
  // Inside Phantom's in-app browser, check for params relayed via localStorage
  // (stored by the Android relay in main.tsx before it bounced back here).
  const insidePhantom = !!(window as { phantom?: { solana?: unknown } }).phantom?.solana
  let searchString = window.location.search
  let fromRelay = false
  if (insidePhantom) {
    try {
      const raw = localStorage.getItem(RELAY_KEY)
      if (raw) {
        const relay = JSON.parse(raw) as { params: string; ts: number }
        if (Date.now() - relay.ts < RELAY_TTL_MS) {
          searchString = relay.params
          fromRelay = true
        }
        localStorage.removeItem(RELAY_KEY)
      }
    } catch { /* ignore */ }
  }

  const params          = new URLSearchParams(searchString)
  const phantomPubParam = params.get('phantom_encryption_public_key')
  const data            = params.get('data')
  const nonce           = params.get('nonce')
  if (!data || !nonce) return { type: 'none' }

  // Clean URL only when reading directly from window.location (not relay)
  if (!fromRelay) window.history.replaceState({}, '', window.location.pathname)

  const kp = getOrCreateKeypair()

  try {
    // ── Connect response ─────────────────────────────────────────────────────
    if (phantomPubParam) {
      const result = naclDecrypt(data, nonce, kp.priv, phantomPubParam) as {
        public_key: string; session: string
      }
      localStorage.setItem(SK.session, JSON.stringify({
        phantomPub: phantomPubParam,
        session:    result.session,
        walletPub:  result.public_key,
      } satisfies DLSession))
      return { type: 'connected', walletPub: result.public_key }
    }

    // ── Sign response ────────────────────────────────────────────────────────
    const sess = getSession()
    if (!sess) return { type: 'none' }
    const result  = naclDecrypt(data, nonce, kp.priv, sess.phantomPub) as { signature: string }
    const pending = getPending()
    if (!pending || !result.signature) return { type: 'none' }
    clearPending()
    return { type: 'signed', signature: result.signature, pending }

  } catch {
    return { type: 'none' }
  }
}
