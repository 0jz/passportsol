import type { PassportData } from '../lib/gitcoin'
import PassportView from './PassportView'

interface Props {
  passport: PassportData
  txHash: string
  walletAgeDays: number
}

export default function SuccessCard({ passport, txHash, walletAgeDays }: Props) {
  return (
    <PassportView
      stamps={passport.stamps}
      score={passport.score}
      threshold={passport.threshold}
      ethAddress={passport.ethAddress}
      txHash={txHash}
      mintedAt={Math.floor(new Date(passport.lastUpdated).getTime() / 1000)}
      walletAgeDays={walletAgeDays}
    />
  )
}
