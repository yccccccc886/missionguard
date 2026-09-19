import { defineConfig } from 'hardhat/config';
import hardhatEthers from '@nomicfoundation/hardhat-ethers';
export default defineConfig({
  plugins: [hardhatEthers],
  solidity: {
    version: '0.8.30',
    settings: { optimizer: { enabled: true, runs: 200 }, evmVersion: 'cancun' },
  },
  networks: {
    hardhat: { type: 'edr-simulated', chainType: 'l1', chainId: 31337 },
  },
});
