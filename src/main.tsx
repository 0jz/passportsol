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

// Phantom relay + mobile auto-redirect ───────────────────────────────────────
// 1. Auto-redirect: mobile users who land in Chrome are sent straight to
//    Phantom's in-app browser so the whole session lives in Phantom.
// 2. Relay: after phantomConnect/signAndSendTransaction, Phantom redirects back
//    to our HTTPS URL and Chrome opens it in a new tab. We encode the full
//    callback URL (params included) into a Phantom browse intent so Phantom
//    opens our app with the params already in window.location.search.
//
// intent:// makes Chrome open app.phantom directly, bypassing the App Links
// disambiguation that would otherwise just load phantom.app as a website.
const _urlParams  = new URLSearchParams(window.location.search)
const _inPhantom  = !!(window as { phantom?: { solana?: unknown } }).phantom?.solana
const _isMobile   = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
const _isCallback = _urlParams.has('data') && _urlParams.has('nonce')

// Relay keeps params in URL; auto-redirect uses the clean origin URL
const _targetUrl    = _isCallback ? window.location.href : window.location.origin + window.location.pathname
const _needRedirect = !_inPhantom && (_isCallback || _isMobile)

if (_needRedirect) {
  const _enc   = encodeURIComponent(_targetUrl)
  const _https = `https://phantom.app/ul/browse/${_enc}`
  window.location.href =
    `intent://phantom.app/ul/browse/${_enc}` +
    `#Intent;scheme=https;package=app.phantom` +
    `;S.browser_fallback_url=${encodeURIComponent(_https)};end`
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

if (!_needRedirect) {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <Providers>
        <App />
      </Providers>
    </StrictMode>,
  )
}
