export async function lookupFarcasterByEth(ethAddress: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://api.warpcast.com/v2/user-by-verification?address=${ethAddress.toLowerCase()}`,
      { headers: { Accept: 'application/json' } },
    )
    if (!res.ok) return null
    const data = await res.json() as { result?: { user?: { username?: string } } }
    return data?.result?.user?.username ?? null
  } catch {
    return null
  }
}
