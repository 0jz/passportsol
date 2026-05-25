export interface EligibilityThresholds {
  humanMinScore: number
  minWalletAgeDays: number
  minSolForClaim: number
}

const IS_DEVNET = import.meta.env.VITE_SOLANA_NETWORK !== 'mainnet'

export const CAMPAIGN_PUBLIC_CONFIG: EligibilityThresholds = {
  humanMinScore: Number(import.meta.env.VITE_HUMAN_MIN_SCORE ?? 5),
  minWalletAgeDays: IS_DEVNET
    ? 0
    : Number(import.meta.env.VITE_MIN_WALLET_AGE_DAYS ?? 1),
  minSolForClaim: Number(import.meta.env.VITE_MIN_SOL_FOR_CLAIM ?? 0.002),
}

