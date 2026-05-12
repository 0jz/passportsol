import { Buffer } from 'buffer'
globalThis.Buffer = Buffer

import { StrictMode, useMemo } from 'react'
import { createRoot } from 'react-dom/client'
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react'
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base'
import { LedgerWalletAdapter } from '@solana/wallet-adapter-wallets'
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui'
import { clusterApiUrl } from '@solana/web3.js'
import '@solana/wallet-adapter-react-ui/styles.css'
import { WagmiProvider, createConfig, http } from 'wagmi'
import { mainnet, arbitrum, optimism, polygon, base } from 'wagmi/chains'
import { injected } from 'wagmi/connectors'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import App from './App.tsx'

// Ankr public RPCs — free, no API key, reliable CORS
const wagmiConfig = createConfig({
  chains: [mainnet, arbitrum, optimism, polygon, base],
  connectors: [injected()],
  transports: {
    [mainnet.id]:  http('https://rpc.ankr.com/eth'),
    [arbitrum.id]: http('https://rpc.ankr.com/arbitrum'),
    [optimism.id]: http('https://rpc.ankr.com/optimism'),
    [polygon.id]:  http('https://rpc.ankr.com/polygon'),
    [base.id]:     http('https://rpc.ankr.com/base'),
  },
})

const queryClient = new QueryClient()

function Providers({ children }: { children: React.ReactNode }) {
  const endpoint = useMemo(
    () => import.meta.env.VITE_SOLANA_RPC_URL || clusterApiUrl(WalletAdapterNetwork.Devnet),
    [],
  )
  const wallets = useMemo(() => [new LedgerWalletAdapter()], [])

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <ConnectionProvider endpoint={endpoint}>
          <WalletProvider wallets={wallets} autoConnect={false}>
            <WalletModalProvider>
              {children}
            </WalletModalProvider>
          </WalletProvider>
        </ConnectionProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Providers>
      <App />
    </Providers>
  </StrictMode>,
)
