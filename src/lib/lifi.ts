export function buildJumperFundingUrl(toAddress: string): string {
  const base = 'https://jumper.exchange'
  const params = new URLSearchParams({
    toChain: 'SOL',
    toToken: 'SOL',
    toAddress,
  })
  return `${base}/?${params.toString()}`
}

