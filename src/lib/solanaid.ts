export async function lookupSolanaId(walletAddress: string): Promise<string | null> {
  try {
    const res = await fetch(`https://api.solana.id/v1/profile/${walletAddress}`, {
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) return null
    const data = await res.json() as { username?: string; handle?: string; name?: string }
    return data?.username ?? data?.handle ?? data?.name ?? null
  } catch {
    return null
  }
}
