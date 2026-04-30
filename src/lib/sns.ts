const BONFIDA_PROXY = 'https://sns-sdk-proxy.bonfida.workers.dev'

export async function lookupSolDomain(walletAddress: string): Promise<string | null> {
  try {
    const res = await fetch(`${BONFIDA_PROXY}/favorite-domain/${walletAddress}`)
    const json = await res.json() as { s: string; result?: string }
    if (json.s !== 'ok' || !json.result) return null
    return `${json.result}.sol`
  } catch {
    return null
  }
}
