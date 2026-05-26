import { Buffer } from 'buffer'
globalThis.Buffer = Buffer

import { StrictMode, useMemo } from 'react'
import { createRoot } from 'react-dom/client'
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react'
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base'
import {
  LedgerWalletAdapter,
  PhantomWalletAdapter,
  SolflareWalletAdapter,
} from '@solana/wallet-adapter-wallets'
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui'
import { clusterApiUrl } from '@solana/web3.js'
import '@solana/wallet-adapter-react-ui/styles.css'
import './index.css'
import App from './App.tsx'

const DEVNET_RPC_ENDPOINT = 'https://api.devnet.solana.com'

function Providers({ children }: { children: React.ReactNode }) {
  const solanaNetwork = WalletAdapterNetwork.Devnet
  const configuredRpc = import.meta.env.VITE_SOLANA_RPC_URL?.trim()

  const endpoint = useMemo(
    () => (
      configuredRpc && configuredRpc.toLowerCase().includes('devnet')
        ? configuredRpc
        : DEVNET_RPC_ENDPOINT || clusterApiUrl(solanaNetwork)
    ),
    [configuredRpc, solanaNetwork],
  )
  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter({ network: WalletAdapterNetwork.Devnet }),
      new LedgerWalletAdapter(),
    ],
    [],
  )

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect={false}>
        <WalletModalProvider>
          {children}
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Providers>
      <App />
    </Providers>
  </StrictMode>,
)
