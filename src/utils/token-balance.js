import { ethers } from 'ethers';

// USDC contract addresses on Arbitrum
const USDC_ADDRESSES = {
    // Arbitrum One - Native USDC
    '42161': '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    // Arbitrum One - Bridged USDC (legacy)
    // '42161': '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8',
    // Arbitrum Sepolia Testnet
    '421614': '0x75faf114eafb1BDbe2F0316DF893fd58cE89AF7E6',
};

// ERC20 ABI for balanceOf
const ERC20_ABI = [
    {
        constant: true,
        inputs: [{ name: '_owner', type: 'address' }],
        name: 'balanceOf',
        outputs: [{ name: 'balance', type: 'uint256' }],
        type: 'function',
    },
    {
        constant: true,
        inputs: [],
        name: 'decimals',
        outputs: [{ name: '', type: 'uint8' }],
        type: 'function',
    },
];

/**
 * Get USDC token balance on Arbitrum for a given address
 * @param {string} address - Wallet address
 * @param {ethers.Provider} provider - Ethers provider (from MetaMask)
 * @param {string|number} chainId - Chain ID (default: 42161 for Arbitrum One)
 * @returns {Promise<{balance: string, formatted: string, symbol: string}>}
 */
export const getUSDCBalance = async (address, provider, chainId = '42161') => {
    try {
        if (!address || !provider) {
            return { balance: '0', formatted: '0.00', symbol: 'USDC' };
        }

        // Get USDC contract address for the chain
        const usdcAddress = USDC_ADDRESSES[chainId.toString()];
        if (!usdcAddress) {
            console.warn(`USDC not configured for chain ${chainId}`);
            return { balance: '0', formatted: '0.00', symbol: 'USDC' };
        }

        // Create contract instance
        const contract = new ethers.Contract(usdcAddress, ERC20_ABI, provider);

        // Get balance and decimals
        const [balance, decimals] = await Promise.all([
            contract.balanceOf(address),
            contract.decimals(),
        ]);

        // Format balance
        const formatted = ethers.formatUnits(balance, decimals);

        return {
            balance: balance.toString(),
            formatted: parseFloat(formatted).toFixed(2),
            symbol: 'USDC',
        };
    } catch (error) {
        console.error('Error fetching USDC balance:', error);
        return { balance: '0', formatted: '0.00', symbol: 'USDC', error: error.message };
    }
};

/**
 * Get USDT token balance on Arbitrum for a given address
 * @param {string} address - Wallet address
 * @param {ethers.Provider} provider - Ethers provider (from MetaMask)
 * @param {string|number} chainId - Chain ID (default: 42161 for Arbitrum One)
 * @returns {Promise<{balance: string, formatted: string, symbol: string}>}
 */
export const getUSDTBalance = async (address, provider, chainId = '42161') => {
    try {
        if (!address || !provider) {
            return { balance: '0', formatted: '0.00', symbol: 'USDT' };
        }

        // USDT contract address on Arbitrum One
        const USDT_ADDRESS = '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9';

        // Create contract instance
        const contract = new ethers.Contract(USDT_ADDRESS, ERC20_ABI, provider);

        // Get balance and decimals
        const [balance, decimals] = await Promise.all([
            contract.balanceOf(address),
            contract.decimals(),
        ]);

        // Format balance
        const formatted = ethers.formatUnits(balance, decimals);

        return {
            balance: balance.toString(),
            formatted: parseFloat(formatted).toFixed(2),
            symbol: 'USDT',
        };
    } catch (error) {
        console.error('Error fetching USDT balance:', error);
        return { balance: '0', formatted: '0.00', symbol: 'USDT', error: error.message };
    }
};

/**
 * Get token balance (USDC or USDT) on Arbitrum
 * @param {string} token - Token symbol ('USDC' or 'USDT')
 * @param {string} address - Wallet address
 * @param {ethers.Provider} provider - Ethers provider
 * @param {string|number} chainId - Chain ID
 * @returns {Promise<{balance: string, formatted: string, symbol: string}>}
 */
export const getTokenBalance = async (token, address, provider, chainId = '42161') => {
    if (token === 'USDC') {
        return getUSDCBalance(address, provider, chainId);
    } else if (token === 'USDT') {
        return getUSDTBalance(address, provider, chainId);
    }
    return { balance: '0', formatted: '0.00', symbol: token };
};

