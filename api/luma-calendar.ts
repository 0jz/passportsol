export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    })
  }
  if (req.method !== 'GET') return new Response('Method not allowed', { status: 405 })

  const url = new URL(req.url).searchParams.get('url')
  if (!url) return new Response('Missing url param', { status: 400 })

  // Only proxy lu.ma URLs
  let parsed: URL
  try { parsed = new URL(url) } catch { return new Response('Invalid URL', { status: 400 }) }
  if (!parsed.hostname.endsWith('lu.ma')) return new Response('Only lu.ma URLs allowed', { status: 403 })

  const res = await fetch(url, { headers: { Accept: 'text/calendar, */*' } })
  const text = await res.text()

  return new Response(text, {
    status: res.status,
    headers: { 'Content-Type': 'text/calendar', 'Access-Control-Allow-Origin': '*' },
  })
}
export const config = { runtime: 'edge' }
