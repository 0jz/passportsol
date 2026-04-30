const CLIENT_ID = import.meta.env.VITE_GITHUB_CLIENT_ID as string | undefined

export interface DeviceCodeResponse {
  device_code: string
  user_code: string
  verification_uri: string
  expires_in: number
  interval: number
}

export interface GithubUser {
  login: string
  followers: number
  public_repos: number
}

export async function requestDeviceCode(): Promise<DeviceCodeResponse> {
  if (!CLIENT_ID) throw new Error('VITE_GITHUB_CLIENT_ID not set')

  const res = await fetch('https://github.com/login/device/code', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: CLIENT_ID, scope: 'read:user' }),
  })

  if (!res.ok) throw new Error('Failed to request device code')
  return res.json()
}

export async function pollForToken(deviceCode: string, intervalSecs: number): Promise<string> {
  if (!CLIENT_ID) throw new Error('VITE_GITHUB_CLIENT_ID not set')

  const delay = (ms: number) => new Promise(r => setTimeout(r, ms))
  let interval = intervalSecs
  const deadline = Date.now() + 15 * 60 * 1000

  while (Date.now() < deadline) {
    await delay(interval * 1000)

    const res = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: CLIENT_ID,
        device_code: deviceCode,
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      }),
    })

    const data = await res.json() as { access_token?: string; error?: string }

    if (data.access_token) return data.access_token
    if (data.error === 'access_denied') throw new Error('Access denied')
    if (data.error === 'expired_token') throw new Error('Code expired, try again')
    if (data.error === 'slow_down') interval += 5
    // 'authorization_pending' → keep polling
  }

  throw new Error('Timed out waiting for authorization')
}

export async function fetchGithubUser(token: string): Promise<GithubUser> {
  const res = await fetch('https://api.github.com/user', {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error('Failed to fetch GitHub profile')
  return res.json()
}
