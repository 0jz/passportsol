const CLIENT_ID = import.meta.env.VITE_TWITTER_CLIENT_ID as string | undefined

function getRedirectUri() {
  return window.location.origin
}

function generateVerifier(): string {
  const arr = new Uint8Array(32)
  crypto.getRandomValues(arr)
  return btoa(String.fromCharCode(...arr)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

async function generateChallenge(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return btoa(String.fromCharCode(...new Uint8Array(hash)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

export async function startTwitterAuth(): Promise<void> {
  if (!CLIENT_ID) throw new Error('VITE_TWITTER_CLIENT_ID not set')

  const verifier = generateVerifier()
  const challenge = await generateChallenge(verifier)
  const state = generateVerifier()

  sessionStorage.setItem('tw_verifier', verifier)
  sessionStorage.setItem('tw_state', state)

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: CLIENT_ID,
    redirect_uri: getRedirectUri(),
    scope: 'tweet.read users.read',
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  })

  window.location.href = `https://twitter.com/i/oauth2/authorize?${params}`
}

export async function handleTwitterCallback(
  code: string,
  state: string,
): Promise<string> {
  if (!CLIENT_ID) throw new Error('VITE_TWITTER_CLIENT_ID not set')

  const storedState = sessionStorage.getItem('tw_state')
  const verifier = sessionStorage.getItem('tw_verifier')

  if (state !== storedState || !verifier) throw new Error('Invalid OAuth state')

  sessionStorage.removeItem('tw_state')
  sessionStorage.removeItem('tw_verifier')
  window.history.replaceState({}, '', window.location.pathname)

  // Exchange via Vercel proxy (avoids CORS on twitter token endpoint)
  const tokenRes = await fetch('/api/twitter-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      grant_type: 'authorization_code',
      client_id: CLIENT_ID,
      redirect_uri: getRedirectUri(),
      code_verifier: verifier,
    }).toString(),
  })

  if (!tokenRes.ok) throw new Error('Twitter token exchange failed')
  const tokenData = await tokenRes.json() as { access_token?: string }
  if (!tokenData.access_token) throw new Error('No access token returned')

  const userRes = await fetch('https://api.twitter.com/2/users/me', {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  })
  if (!userRes.ok) throw new Error('Failed to fetch Twitter user')
  const userData = await userRes.json() as { data?: { username?: string } }
  const username = userData?.data?.username
  if (!username) throw new Error('No username returned')

  return username
}
