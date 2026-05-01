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

// Returns true if input looks like a Luma URL
export function isLumaUrl(input: string): boolean {
  return /lu\.ma\//i.test(input)
}

// Extracts a fallback name from a Luma URL when the real title can't be fetched
// "lu.ma/superteam-hh-2025" → "Superteam HH 2025"
// "lu.ma/e/evt-abc123"      → "Luma Event"
export function parseLumaSlug(input: string): string {
  // Skip single-char path segments like /e/, /u/, /c/
  const slug = input.match(/lu\.ma\/(?:[a-z]\/)?([a-zA-Z0-9][a-zA-Z0-9-]+)/)?.[1]
  if (!slug || /^evt-/.test(slug)) return 'Luma Event'
  return slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

export async function fetchLumaEventTitle(url: string): Promise<string> {
  try {
    const res = await fetch(`/api/luma-event?url=${encodeURIComponent(url)}`)
    const json = await res.json() as { title?: string }
    return json.title?.trim() || parseLumaSlug(url)
  } catch {
    return parseLumaSlug(url)
  }
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

// Parses a full iCal calendar feed and returns all event names
export function parseIcsFeed(text: string): string[] {
  const blocks = text.match(/BEGIN:VEVENT[\s\S]*?END:VEVENT/g) ?? []
  const names: string[] = []
  for (const block of blocks) {
    // Unfold line continuations (RFC 5545: lines starting with space/tab continue previous)
    const unfolded = block.replace(/\r?\n[ \t]/g, '')
    const summary = unfolded.match(/^SUMMARY[^:]*:(.+)$/m)?.[1]?.trim()
    if (summary) names.push(summary)
  }
  return [...new Set(names)]
}

export async function parsePkpass(file: File): Promise<string | null> {
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
      pass.organizationName
    return name ?? null
  } catch {
    return null
  }
}
