import { useEffect } from 'react'
import { CAMPAIGN_PUBLIC_CONFIG } from '../config/campaign'

const IS_DEVNET = import.meta.env.VITE_SOLANA_NETWORK !== 'mainnet'

interface Props {
  solAddress: string
  solBalance: number | null
  onReady: () => void
  onBalanceRefresh: () => void
}

export default function FundingStep({
  solAddress,
  solBalance,
  onReady,
  onBalanceRefresh,
}: Props) {
  const isFunded =
    solBalance !== null && solBalance >= CAMPAIGN_PUBLIC_CONFIG.minSolForClaim

  useEffect(() => {
    if (isFunded) return
    const id = setInterval(onBalanceRefresh, 12000)
    return () => clearInterval(id)
  }, [isFunded, onBalanceRefresh])

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-zinc-700 bg-zinc-900 p-5 space-y-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-widest text-amber-400 border border-amber-400/40 rounded px-2 py-0.5">
            {IS_DEVNET ? 'DEV MODE' : 'FUNDING'}
          </span>
          <span className="text-xs text-zinc-400">
            {IS_DEVNET ? 'Solana Devnet' : 'Send SOL to continue'}
          </span>
        </div>

        <p className="text-zinc-300 text-sm">
          {IS_DEVNET
            ? 'Use the Solana faucet to add devnet SOL to this wallet.'
            : 'Send enough SOL to this wallet from Phantom, another Solana wallet, or an exchange.'}
        </p>

        <div className="space-y-1">
          <p className="text-xs text-zinc-500">
            {IS_DEVNET ? 'Your devnet address' : 'Your funding address'}
          </p>
          <p className="font-mono text-xs text-zinc-200 break-all bg-zinc-800 rounded-lg px-3 py-2 select-all">
            {solAddress}
          </p>
        </div>

        {IS_DEVNET ? (
          <>
            <a
              href={`https://faucet.solana.com/?address=${solAddress}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full text-center text-sm font-semibold px-4 py-2.5 rounded-xl transition-all"
              style={{ background: '#9945FF', color: '#fff' }}
            >
              Open Devnet Faucet {'->'}
            </a>
            <p className="text-[11px] text-zinc-600 text-center">
              Request 1-2 SOL from the faucet, then refresh your balance below.
            </p>
          </>
        ) : (
          <p className="text-[11px] text-zinc-600 text-center">
            After you send SOL, refresh the balance below to unlock the next step.
          </p>
        )}
      </div>

      <div className="flex items-center justify-between text-xs px-1">
        <span className="text-zinc-500">SOL balance{IS_DEVNET ? ' (devnet)' : ''}</span>
        <div className="flex items-center gap-2">
          <span className={isFunded ? 'text-emerald-400 font-medium' : 'text-amber-400'}>
            {solBalance === null
              ? 'checking...'
              : `${solBalance.toFixed(5)} SOL`}
          </span>
          <button
            onClick={onBalanceRefresh}
            className="text-zinc-600 hover:text-zinc-400 transition-colors"
            title="Refresh"
          >
            &#8635;
          </button>
        </div>
      </div>

      <button
        onClick={onReady}
        disabled={!isFunded}
        className="w-full text-sm font-semibold px-4 py-3 rounded-xl disabled:opacity-40 transition-all"
        style={{ background: '#14F195', color: '#081016' }}
      >
        {isFunded
          ? 'Wallet Funded - Continue ->'
          : `Waiting for funds (need ${CAMPAIGN_PUBLIC_CONFIG.minSolForClaim} SOL)...`}
      </button>

      <p className="text-[11px] text-zinc-600 text-center">
        {IS_DEVNET
          ? 'After you use the faucet, click refresh to re-check your devnet balance.'
          : 'After you send SOL, click refresh to re-check your balance.'}
      </p>
    </div>
  )
}
