import { JsonRpcProvider } from 'ethers'

const RPC_ENDPOINTS = [
  'https://ethereum.publicnode.com',
  'https://rpc.ankr.com/eth',
  'https://1rpc.io/eth',
  'https://eth.llamarpc.com',
]

export async function lookupEns(ethAddress: string): Promise<string | null> {
  for (const url of RPC_ENDPOINTS) {
    try {
      return await new JsonRpcProvider(url).lookupAddress(ethAddress)
    } catch {
      // rate limited or unavailable — try next
    }
  }
  return null
}
