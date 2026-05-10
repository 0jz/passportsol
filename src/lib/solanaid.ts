// Solana.id profile lookup
// API docs: https://solana.id — tries multiple endpoints for resilience

const ENDPOINTS = [
  (addr: string) => `https://api.solana.id/v1/profile/${addr}`,
  (addr: string) => `https://api.solana.id/profile/${addr}`,
]

type SolanaIdResponse = {
  username?: string
  handle?: string
  name?: string
  domain?: string
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    p,
    new Promise<null>(resolve => setTimeout(() => resolve(null), ms)),
  ])
}

export async function lookupSolanaId(walletAddress: string): Promise<string | null> {
  for (const makeUrl of ENDPOINTS) {
    try {
      const result = await withTimeout(
        fetch(makeUrl(walletAddress), {
          headers: { Accept: 'application/json' },
        }).then(async res => {
          if (!res.ok) return null
          const data = (await res.json()) as SolanaIdResponse
          return data?.username ?? data?.handle ?? data?.name ?? data?.domain ?? null
        }),
        5000,
      )
      if (result) return result
    } catch {
      // Try next endpoint
    }
  }
  return null
}
