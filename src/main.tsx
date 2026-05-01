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
import './index.css'
import App from './App.tsx'

// Android deep-link relay ─────────────────────────────────────────────────────
// After phantomConnect / phantomSignAndSend, Phantom redirects back to our HTTPS
// URL. On Android this opens a NEW Chrome tab instead of staying in Phantom.
// Fix: detect the callback params in Chrome, stash them in localStorage, then
// immediately bounce back into Phantom's in-app browser via ul/browse/.
// handleDeeplinkReturn() reads from localStorage when running inside Phantom.
const _rlp = new URLSearchParams(window.location.search)
const _needRelay = _rlp.has('data') && _rlp.has('nonce') &&
  !(window as { phantom?: { solana?: unknown } }).phantom?.solana
if (_needRelay) {
  try { localStorage.setItem('__phantom_relay', JSON.stringify({ params: window.location.search, ts: Date.now() })) } catch { /* ignore */ }
  window.location.replace(`https://phantom.app/ul/browse/${encodeURIComponent(window.location.origin + window.location.pathname)}`)
}

function Providers({ children }: { children: React.ReactNode }) {
  const endpoint = useMemo(() => clusterApiUrl(WalletAdapterNetwork.Devnet), [])
  // WalletProvider auto-detects any Wallet Standard wallet (Phantom, Solflare, Backpack, etc.)
  // LedgerWalletAdapter is listed explicitly because Ledger doesn't implement the standard
  const wallets = useMemo(() => [new LedgerWalletAdapter()], [])

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

if (!_needRelay) {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <Providers>
        <App />
      </Providers>
    </StrictMode>,
  )
}
