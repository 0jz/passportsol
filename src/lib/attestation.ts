import bs58 from 'bs58'
import { PublicKey } from '@solana/web3.js'
import { unzipSync } from 'fflate'

export interface EventAttestation {
  v: 1
  type: 'event'
  wallet: string
  event: string
  issuer: string
  ts: number
  sig: string
}

// Add trusted issuers here as partnerships form
export const TRUSTED_ISSUERS: Record<string, string> = {
  // 'Base58PubkeyHere': 'Superteam',
  // 'AnotherPubkeyHere': 'Solana Foundation',
}

async function verifyEd25519(message: Uint8Array, sig: Uint8Array, pubkeyBytes: Uint8Array): Promise<boolean> {
  try {
    const key = await crypto.subtle.importKey('raw', pubkeyBytes, { name: 'Ed25519' }, false, ['verify'])
    return await crypto.subtle.verify({ name: 'Ed25519' }, key, sig, message)
  } catch {
    return false
  }
}

export async function verifyAttestation(
  attest: EventAttestation,
  walletAddress: string,
): Promise<{ ok: boolean; issuerName?: string; reason?: string }> {
  if (attest.wallet !== walletAddress) return { ok: false, reason: 'Atestacija nije za ovaj wallet' }

  const { sig, ...payload } = attest
  const message = new TextEncoder().encode(JSON.stringify(payload))

  let sigBytes: Uint8Array
  let pubkeyBytes: Uint8Array
  try {
    sigBytes = bs58.decode(sig)
    pubkeyBytes = new PublicKey(attest.issuer).toBytes()
  } catch {
    return { ok: false, reason: 'Neispravan format potpisa' }
  }

  const valid = await verifyEd25519(message, sigBytes, pubkeyBytes)
  if (!valid) return { ok: false, reason: 'Potpis nije validan' }

  return { ok: true, issuerName: TRUSTED_ISSUERS[attest.issuer] }
}

export function parseAttestation(input: string): EventAttestation | null {
  try {
    const data = JSON.parse(input)
    if (data.v !== 1 || data.type !== 'event' || !data.wallet || !data.event || !data.issuer || !data.sig) return null
    return data as EventAttestation
  } catch {
    return null
  }
}

export function parseIcs(text: string): string | null {
  const summary = text.match(/^SUMMARY[^:]*:(.+)$/m)?.[1]?.trim()
  return summary ?? null
}

export interface PkpassResult {
  name: string
  iconDataUrl?: string
}

export async function parsePkpass(file: File): Promise<PkpassResult | null> {
  try {
    const buffer = await file.arrayBuffer()
    const files = unzipSync(new Uint8Array(buffer))
    const passJsonBytes = files['pass.json']
    if (!passJsonBytes) return null
    const pass = JSON.parse(new TextDecoder().decode(passJsonBytes))
    // Try common fields for event name
    const name: string =
      pass.description ||
      pass.eventTicket?.primaryFields?.[0]?.value ||
      pass.generic?.primaryFields?.[0]?.value ||
      p