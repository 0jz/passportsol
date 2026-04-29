const API_BASE = 'https://api.scorer.gitcoin.co'
const API_KEY = import.meta.env.VITE_GITCOIN_API_KEY as string | undefined
const SCORER_ID = import.meta.env.VITE_GITCOIN_SCORER_ID as string | undefined

export interface PassportData {
  ethAddress: string
  score: number
  stamps: string[]
  lastUpdated: string
}

const MOCK_DATA = {
  score: 24.5,
  stamps: ['GitHub', 'Twitter', 'ENS', 'BrightID', 'Coinbase'],
  lastUpdated: new Date().toISOString(),
}

async function submitPassport(ethAddress: string, headers: Record<string, string>): Promise<void> {
  await fetch(`${API_BASE}/registry/submit-passport`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ address: ethAddress, scorer_id: SCORER_ID }),
  })
  // Ignore errors — if already submitted this is a no-op
}

export async function fetchPassport(ethAddress: string): Promise<PassportData> {
  if (!API_KEY || !SCORER_ID) {
    console.warn('Gitcoin API key not set — using mock data')
    return { ...MOCK_DATA, ethAddress }
  }

  const headers = { 'X-API-Key': API_KEY }

  // Submit first so scorer calculates the score (no-op if already submitted)
  await submitPassport(ethAddress, headers)

  const [scoreRes, stampsRes] = await Promise.all([
    fetch(`${API_BASE}/registry/score/${SCORER_ID}/${ethAddress}`, { headers }),
    fetch(`${API_BASE}/registry/stamps/${ethAddress}?limit=100`, { headers }),
  ])

  if (!scoreRes.ok) throw new Error(`Score fetch failed: ${scoreRes.status}`)
  if (!stampsRes.ok) throw new Error(`Stamps fetch failed: ${stampsRes.status}`)

  const scoreData = await scoreRes.json()
  const stampsData = await stampsRes.json()

  return {
    ethAddress,
    score: parseFloat(scoreData.score ?? '0'),
    stamps: (stampsData.items ?? []).map(
      (s: { credential: { credentialSubject: { provider: string } } }) =>
        s.credential.credentialSubject.provider
    ),
    lastUpdated: scoreData.last_score_timestamp ?? new Date().toISOString(),
  }
}
