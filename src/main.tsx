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
// After phantomConnect / phantomSignAndSend, Phantom redirects to our HTTPS URL.
// Android opens that in a new Chrome tab. We relay back into Phantom's browser by
// encoding the FULL callback URL (Phantom params included) as the inner URL of a
// Phantom browse intent. Phantom opens our app with params already in the URL, so
// handleDeeplinkReturn() reads them from window.location.search as usual.
//
// intent:// bypasses App Links disambiguation — Chrome opens app.phantom directly
// without first trying to load phantom.app as a website.
const _rlp = new URLSearchParams(window.location.search)
const _needRelay = _rlp.has('data') && _rlp.has('nonce') &&
  !(window as { phantom?: { solana?: unknown } }).phantom?.solana

if (_needRelay) {
  const _encodedUrl = encodeURIComponent(window.location.href)
  const _httpsUrl   = `https://phantom.app/ul/browse/${_encodedUrl}`
  const _intentUrl  = `intent://phantom.app/ul/browse/${_encodedUrl}` +
    `#Intent;scheme=https;package=app.phantom` +
    `;S.browser_fallback_url=${encodeURIComponent(_httpsUrl)};end`
  window.location.href = _intentUrl
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
