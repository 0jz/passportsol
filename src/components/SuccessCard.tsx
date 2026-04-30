import type { PassportData } from '../lib/gitcoin'
import PassportView from './PassportView'

interface Props {
  passport: PassportData
  txHash: string
}

export default function SuccessCard({ passport, txHash }: Props) {
  return (
    <PassportView
      stamps={passport.stamps}
      score={passport.score}
      threshold={passport.threshold}
      ethAddress={passport.ethAddress}
      txHash={txHash}
      mintedAt={Math.floor(new Date(passport.lastUpdated).getTime() / 1000)}
    />
  )
}
