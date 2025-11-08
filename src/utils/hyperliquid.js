/**
 * Utility functions for Hyperliquid integration with MetaMask
 * 
 * Note: MetaMask doesn't expose private keys for security reasons.
 * For Hyperliquid trading, users need to export their private key.
 * This is a security trade-off - consider using API wallets instead.
 */

import { ethers } from 'ethers';

/**
 * Get user's private key from MetaMask
 * 
 * WARNING: This requires the user to export their private key from MetaMask.
 * This is not ideal from a security perspective, but necessary for Hyperliquid
 * off-chain order signing.
 * 
 * Alternative: Use Hyperliquid API wallets which can be created separately.
 * 
 * @param {ethers.Signer} signer - MetaMask signer
 * @returns {Promise<string>} Private key (user must export from MetaMask)
 */
export const getPrivateKeyFromMetaMask = async (signer) => {
    // MetaMask doesn't expose private keys directly
    // Users need to export it manually or use a different approach

    // Option 1: User exports private key (not recommended for main wallet)
    // Option 2: Use API wallet with separate private key
    // Option 3: Use browser-based Hyperliquid SDK that works with MetaMask

    throw new Error(
        'MetaMask does not expose private keys. ' +
        'For Hyperliquid trading, you need to:\n' +
        '1. Export your private key from MetaMask (Settings > Security & Privacy > Show Private Key)\n' +
        '2. OR use a Hyperliquid API wallet (recommended): https://app.hyperliquid.xyz/API\n' +
        '3. OR use the Hyperliquid SDK directly in the browser'
    );
};

/**
 * Request user to provide their private key for Hyperliquid trading
 * This is a temporary solution - in production, consider using API wallets
 * 
 * @param {string} userAddress - User's wallet address
 * @returns {Promise<string>} User's private key
 */
export const requestPrivateKey = async (userAddress) => {
    // In a real implementation, you might:
    // 1. Show a modal asking user to paste their private key
    // 2. Store it temporarily in memory (never in localStorage!)
    // 3. Use it only for the current session
    // 4. Clear it when user disconnects

    const privateKey = prompt(
        `To trade on Hyperliquid, we need your private key for signing orders.\n\n` +
        `Address: ${userAddress}\n\n` +
        `⚠️ SECURITY WARNING:\n` +
        `- Only paste your private key if you trust this application\n` +
        `- Consider using a Hyperliquid API wallet instead: https://app.hyperliquid.xyz/API\n` +
        `- Your private key will be used only for this session\n\n` +
        `Enter your private key (or click Cancel to use API wallet):`
    );

    if (!privateKey) {
        throw new Error('Private key is required for trading. Consider using an API wallet instead.');
    }

    // Validate it's a valid private key format
    if (!/^0x[a-fA-F0-9]{64}$/.test(privateKey)) {
        throw new Error('Invalid private key format. Must be 0x followed by 64 hex characters.');
    }

    return privateKey;
};

/**
 * Alternative: Use Hyperliquid API wallet
 * Users can create API wallets on Hyperliquid that have separate private keys
 * This is more secure than using the main wallet's private key
 */
export const useApiWallet = () => {
    window.open('https://app.hyperliquid.xyz/API', '_blank');
    return {
        message: 'Please create an API wallet on Hyperliquid and use that private key instead of your main wallet key.'
    };
};

