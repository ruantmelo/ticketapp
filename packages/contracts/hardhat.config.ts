import '@nomicfoundation/hardhat-toolbox-viem';

const PRIVATE_KEY = process.env.PRIVATE_KEY;
const POLYGON_AMOY_RPC_URL = process.env.POLYGON_AMOY_RPC_URL;

export default {
  solidity: {
    version: '0.8.28',
    settings: {
      viaIR: true,
      evmVersion: 'cancun',
      optimizer: { enabled: true, runs: 200 },
    },
  },
  paths: {
    sources: './contracts',
    tests: './test',
    cache: './cache',
    artifacts: './artifacts',
  },
  networks: {
    hardhat: {},
    polygonAmoy: {
      url: POLYGON_AMOY_RPC_URL ?? '',
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
      chainId: 80002,
    },
  },
};
