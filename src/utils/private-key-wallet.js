/**
 * Private key wallet utility
 * 
 * Creates a wallet from a private key for signing orders.
 * WARNING: Storing private keys in frontend code is a security risk.
 * This should only be used for development/testing or with dedicated trading wallets.
 */

import { ethers } from 'ethers';

// Private key for signing orders
// WARNING: This is a security risk - never commit real private keys to version control
const TRADING_PRIVATE_KEY = '0xcf6a830b90ea896d73a0593e48c5c6ec8bd8253e15f565b23d7435c7a13879f0';

/**
 * Get wallet from private key
 * @returns {ethers.Wallet} Wallet instance
 */
export const getPrivateKeyWallet = () => {
    try {
        const wallet = new ethers.Wallet(TRADING_PRIVATE_KEY);
        return wallet;
    } catch (error) {
        throw new Error(`Failed to create wallet from private key: ${error.message}`);
    }
};

/**
 * Get address from private key wallet
 * @returns {string} Wallet address
 */
export const getPrivateKeyAddress = () => {
    const wallet = getPrivateKeyWallet();
    return wallet.address;
};

/**
 * Get signer from private key wallet
 * Note: For EIP-712 signing, we need a signer, not just a wallet
 * @param {ethers.Provider} provider - Optional provider (not needed for signing)
 * @returns {ethers.Wallet} Wallet that can be used as signer
 */
export const getPrivateKeySigner = (provider = null) => {
    const wallet = getPrivateKeyWallet();
    // If provider is provided, connect wallet to provider
    // Otherwise, return wallet directly (can still sign messages)
    return provider ? wallet.connect(provider) : wallet;
};

