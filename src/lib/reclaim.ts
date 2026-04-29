import { ReclaimProofRequest } from '@reclaimprotocol/js-sdk'

const APP_ID = import.meta.env.VITE_RECLAIM_APP_ID as string | undefined
const APP_SECRET = import.meta.env.VITE_RECLAIM_APP_SECRET as string | undefined

export interface ReclaimProvider {
  id: string
  name: string
  description: string
}

export const RECLAIM_PROVIDERS: ReclaimProvider[] = [
  {
    id: '6d3f6753-7ee6-49ee-a545-62f1b1822ae5',
    name: 'GitHub',
    description: 'Prove you have a GitHub account',
  },
  {
    id: 'f9f383fd-32d9-4c54-942f-5e9fda349762',
    name: 'GitHub Stars',
    description: 'Prove your GitHub stars count',
  },
]

export async function startReclaimVerification(
  providerId: string,
  onSuccess: (stamp: string) => void,
  onFailure: (error: Error) => void,
): Promise<string> {
  if (!APP_ID || !APP_SECRET) throw new Error('Reclaim APP_ID / APP_SECRET not set')

  const request = await ReclaimProofRequest.init(APP_ID, APP_SECRET, providerId)
  const url = await request.getRequestUrl()

  request.startSession({
    onSuccess: (proofs) => {
      const proof = Array.isArray(proofs) ? proofs[0] : proofs
      const stamp = (proof as { claimData?: { provider?: string } })?.claimData?.provider ?? providerId
      onSuccess(stamp)
    },
    onFailure: (err: Error) => onFailure(err),
  })

  return url
}
