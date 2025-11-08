import { ethers } from 'ethers';

/**
 * Check if MetaMask is installed
 */
export const isMetaMaskInstalled = () => {
    return typeof window !== 'undefined' && window.ethereum && window.ethereum.isMetaMask;
};

/**
 * Request account access from MetaMask
 */
export const connectWallet = async () => {
    if (!isMetaMaskInstalled()) {
        throw new Error('MetaMask is not installed. Please install MetaMask to continue.');
    }

    try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const accounts = await provider.send('eth_requestAccounts', []);

        if (accounts.length === 0) {
            throw new Error('No accounts found. Please unlock MetaMask.');
        }

        const signer = await provider.getSigner();
        const address = await signer.getAddress();
        const network = await provider.getNetwork();

        return {
            address,
            signer,
            provider,
            network: network.chainId.toString()
        };
    } catch (error) {
        if (error.code === 4001) {
            throw new Error('User rejected the connection request.');
        }
        throw error;
    }
};

/**
 * Get current connected account
 */
export const getCurrentAccount = async () => {
    if (!isMetaMaskInstalled()) {
        return null;
    }

    try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const accounts = await provider.send('eth_accounts', []);

        if (accounts.length === 0) {
            return null;
        }

        const signer = await provider.getSigner();
        const address = await signer.getAddress();

        return {
            address,
            signer,
            provider
        };
    } catch (error) {
        console.error('Error getting current account:', error);
        return null;
    }
};

/**
 * Listen for account changes
 */
export const onAccountsChanged = (callback) => {
    if (!isMetaMaskInstalled()) {
        return () => { };
    }

    window.ethereum.on('accountsChanged', callback);

    return () => {
        window.ethereum.removeListener('accountsChanged', callback);
    };
};

/**
 * Listen for chain changes
 */
export const onChainChanged = (callback) => {
    if (!isMetaMaskInstalled()) {
        return () => { };
    }

    window.ethereum.on('chainChanged', callback);

    return () => {
        window.ethereum.removeListener('chainChanged', callback);
    };
};

/**
 * Format address for display
 */
export const formatAddress = (address) => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

/**
 * Get network name from chain ID
 */
export const getNetworkName = (chainId) => {
    const networks = {
        '1': 'Ethereum Mainnet',
        '42161': 'Arbitrum One',
        '421614': 'Arbitrum Sepolia',
        '1337': 'Localhost',
    };
    return networks[chainId] || `Chain ${chainId}`;
};

