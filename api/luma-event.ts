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

  const url = new URL(req.url).searchParams.get('url')
  if (!url) return new Response('Missing url', { status: 400 })

  let parsed: URL
  try { parsed = new URL(url) } catch { return new Response('Invalid URL', { status: 400 }) }
  if (!parsed.hostname.endsWith('lu.ma')) return new Response('Only lu.ma URLs allowed', { status: 403 })

  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; bot)' },
  })
  const html = await res.text()

  const title =
    html.match(/<meta\s+property="og:title"\s+content="([^"]+)"/i)?.[1] ??
    html.match(/<meta\s+content="([^"]+)"\s+property="og:title"/i)?.[1] ??
    html.match(/<meta\s+name="twitter:title"\s+content="([^"]+)"/i)?.[1] ??
    html.match(/<meta\s+content="([^"]+)"\s+name="twitter:title"/i)?.[1] ??
    html.match(/<title>([^<]+)<\/title>/i)?.[1]?.split(/[|\-–]/)[0].trim() ??
    null

  return new Response(JSON.stringify({ title, ok: res.ok, status: res.status }), {
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  })
}
export const config = { runtime: 'edge' }
