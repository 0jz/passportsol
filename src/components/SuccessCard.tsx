import type { PassportData } from '../lib/gitcoin'
import PassportView from './PassportView'

interface Props {
  passport: PassportData
  txHash: string
  walletAgeDays: number
  solAddress?: string
}

export default function SuccessCard({ passport, txHash, walletAgeDays, solAddress }: Props) {
  return (
    <PassportView
      stamps={passport.stamps}
      score={passport.score}
      threshold={passport.threshold}
      solAddress={solAddress}
      ethAddress={passport.ethAddress}
      txHash={txHash}
      mintedAt={Math.floor(new Date(passport.lastUpdated).getTime() / 1000)}
      walletAgeDays={walletAgeDays}
    />
  )
}
