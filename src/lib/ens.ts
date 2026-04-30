import { JsonRpcProvider } from 'ethers'

const provider = new JsonRpcProvider('https://eth.llamarpc.com')

export async function lookupEns(ethAddress: string): Promise<string | null> {
  try {
    return await provider.lookupAddress(ethAddress)
  } catch {
    return null
  }
}
