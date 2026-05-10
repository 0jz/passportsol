// Bonfida SNS (Solana Name Service) — favorite domain lookup
// Proxy docs: https://sns-sdk-proxy.bonfida.workers.dev

const BONFIDA_PROXY = 'https://sns-sdk-proxy.bonfida.workers.dev'

type BonfidaResponse = { s: string; result?: string }

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    p,
    new Promise<null>(resolve => setTimeout(() => resolve(null), ms)),
  ])
}

export async function lookupSolDomain(walletAddress: string): Promise<string | null> {
  try {
    const result = await withTimeout(
      fetch(`${BONFIDA_PROXY}/favorite-domain/${walletAddress}`).then(async res => {
        if (!res.ok) return null
        const json = (await res.json()) as BonfidaResponse
        if (json.s !== 'ok' || !json.result) return null
        return `${json.result}.sol`
      }),
      5000,
    )
    return result ?? null
  } catch {
    return null
  }
}
