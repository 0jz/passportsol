interface EthProvider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>
}

export function createVerificationMessage(ethAddress: string, solanaAddress: string): string {
  return [
    'Solana Passport — Verify Ethereum Identity',
    '',
    `ETH Address: ${ethAddress}`,
    `Solana Address: ${solanaAddress}`,
    `Timestamp: ${new Date().toISOString()}`,
    `Nonce: ${Math.random().toString(36).substring(2, 10)}`,
  ].join('\n')
}

export async function signWithMetaMask(
  message: string,
  address: string,
  provider?: EthProvider,
): Promise<string> {
  const p = provider ?? window.ethereum
  if (!p) throw new Error('Ethereum wallet not found')

  const hexMessage = '0x' + Array.from(new TextEncoder().encode(message))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')

  return p.request({
    method: 'personal_sign',
    params: [hexMessage, address],
  }) as Promise<string>
}
