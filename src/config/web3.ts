import { connectorsForWallets } from '@rainbow-me/rainbowkit';
import {
  metaMaskWallet,
  trustWallet,
  bitgetWallet,
} from '@rainbow-me/rainbowkit/wallets';
import { funWallet } from './funWallet';
import { createConfig, http } from 'wagmi';
import { mainnet, bsc } from 'wagmi/chains';
import { injected } from 'wagmi/connectors';

const projectId = (import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || '').trim();
// Always use publicnode.com for CORS-friendly BSC RPC
const bscRpcUrl = 'https://bsc-rpc.publicnode.com';

export const isWalletConnectConfigured = projectId.length > 0;

const connectors = isWalletConnectConfigured
  ? connectorsForWallets(
      [
        {
          groupName: 'Popular',
          wallets: [
            metaMaskWallet,
            trustWallet,
            bitgetWallet,
            funWallet,
          ],
        },
      ],
      {
        appName: 'F.U. Profile',
        projectId,
      }
    )
  : [
      injected({ target: 'metaMask' }),
      injected(),
    ];

if (!isWalletConnectConfigured) {
  console.warn('[web3] VITE_WALLETCONNECT_PROJECT_ID is missing. WalletConnect-based mobile deep links are disabled.');
}

export const config = createConfig({
  connectors,
  chains: [bsc, mainnet],
  transports: {
    [mainnet.id]: http(),
    [bsc.id]: http(bscRpcUrl),
  },
});
