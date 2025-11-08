/**
 * Hyperliquid withdrawal utility
 * Handles USDC/USDT withdrawals from Hyperliquid to Arbitrum
 */

import { ethers } from 'ethers';

/**
 * Split hex signature into {r, s, v} components
 * @param {string} signatureHex - Hex signature from signTypedData
 * @returns {Object} Signature object with r, s, v
 */
const splitSignature = (signatureHex) => {
    const sigBytes = ethers.getBytes(signatureHex);
    const r = ethers.hexlify(sigBytes.slice(0, 32));
    const s = ethers.hexlify(sigBytes.slice(32, 64));
    const v = sigBytes[64];

    return {
        r: r.replace(/^0x/, ""),
        s: s.replace(/^0x/, ""),
        v: v
    };
};

/**
 * Get Hyperliquid base URL based on chain ID
 * @param {string|number} chainId - Chain ID from MetaMask
 * @returns {string} Hyperliquid API base URL
 */
const getHyperliquidBaseUrl = (chainId) => {
    // Arbitrum One (42161) and Ethereum Mainnet (1) use mainnet
    // Arbitrum Sepolia (421614) uses testnet
    const isMainnet = chainId === '1' || chainId === 1 ||
        chainId === '42161' || chainId === 42161;

    return isMainnet
        ? 'https://api.hyperliquid.xyz'
        : 'https://api.hyperliquid-testnet.xyz';
};

/**
 * Withdraw USDC from Hyperliquid to Arbitrum
 * @param {ethers.Signer} signer - MetaMask signer
 * @param {string|number} amount - Amount to withdraw (as string or number)
 * @param {string} destination - Destination address on Arbitrum (defaults to signer address)
 * @param {string|number} chainId - Chain ID to determine mainnet/testnet
 * @returns {Promise<Object>} Withdrawal result
 */
export const withdrawUSDC = async (signer, amount, destination = null, chainId = '42161') => {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('💵 WITHDRAWING USDC FROM HYPERLIQUID');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    try {
        const timestamp = Date.now(); // number (uint64)
        const address = await signer.getAddress();
        const destinationAddress = destination || address;
        const amountStr = String(Number(amount)); // ensure string

        // Determine if mainnet
        const isMainnet = chainId === '1' || chainId === 1 ||
            chainId === '42161' || chainId === 42161;
        const baseUrl = getHyperliquidBaseUrl(chainId);
        const exchangeUrl = `${baseUrl}/exchange`;

        console.log('📝 Withdrawal Details:');
        console.log('  - Amount:', amountStr, 'USDC');
        console.log('  - From (Hyperliquid):', address);
        console.log('  - To (Arbitrum):', destinationAddress);
        console.log('  - Time (uint64):', timestamp);
        console.log('  - Is Mainnet:', isMainnet);
        console.log('  - Chain ID:', chainId);

        // ✅ Action struct to sign
        const action = {
            type: 'withdraw3',
            hyperliquidChain: isMainnet ? 'Mainnet' : 'Testnet',
            signatureChainId: isMainnet ? '0xa4b1' : '0x66eee', // Arbitrum mainnet (42161) or testnet
            amount: amountStr,
            time: timestamp, // Number (uint64)
            destination: ethers.getAddress(destinationAddress),
        };

        console.log('  - Action JSON:', JSON.stringify(action, null, 2));

        // Get network chainId for EIP-712 domain (must match MetaMask's active network)
        let networkChainId = chainId;
        if (typeof networkChainId === 'string') {
            networkChainId = parseInt(networkChainId, 10);
        }
        if (!networkChainId && signer.provider) {
            try {
                const network = await signer.provider.getNetwork();
                networkChainId = Number(network.chainId);
            } catch (e) {
                console.warn('Could not get chainId from provider:', e);
                networkChainId = 42161; // Default to Arbitrum One
            }
        }

        // ✅ EIP-712 signing domain and types
        const domain = {
            name: 'HyperliquidSignTransaction',
            version: '1',
            chainId: networkChainId, // Use actual network chainId for MetaMask compatibility
            verifyingContract: '0x0000000000000000000000000000000000000000',
        };

        const types = {
            "HyperliquidTransaction:Withdraw": [
                { "name": "hyperliquidChain", "type": "string" },
                { "name": "destination", "type": "string" },
                { "name": "amount", "type": "string" },
                { "name": "time", "type": "uint64" }
            ]
        };

        // EIP-712 message should only contain fields defined in types
        // signatureChainId and type are metadata, not part of the EIP-712 message
        const message = {
            hyperliquidChain: action.hyperliquidChain,
            destination: action.destination,
            amount: action.amount,
            time: action.time,
        };

        console.log('\n🔐 Signing withdrawal...');
        console.log('  - Domain:', JSON.stringify(domain, null, 2));
        console.log('  - Types:', JSON.stringify(types, null, 2));
        console.log('  - Message:', JSON.stringify(message, null, 2));

        const signatureHex = await signer.signTypedData(domain, types, message);
        console.log('✅ Signature obtained:', signatureHex);

        // Convert hex signature to object format {r, s, v}
        const signature = splitSignature(signatureHex);

        console.log('  - Parsed Signature:', JSON.stringify(signature, null, 2));

        // ✅ POST body
        const requestBody = {
            action,
            nonce: timestamp, // same as action.time
            signature,
        };

        console.log('\n📤 Sending to Hyperliquid API...');
        console.log('  - URL:', exchangeUrl);
        console.log('  - Request body:', JSON.stringify(requestBody, null, 2));

        const response = await fetch(exchangeUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
        });

        console.log('  - Response Status:', response.status, response.statusText);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ API Error Response:', errorText);
            throw new Error(`API Error (${response.status}): ${errorText}`);
        }

        // ✅ Parse response safely
        const contentType = response.headers.get('content-type');
        const result = contentType?.includes('application/json')
            ? await response.json()
            : await response.text();

        console.log('✅ Withdrawal Successful:', result);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        return result;
    } catch (error) {
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.error('❌ ERROR WITHDRAWING USDC');
        console.error('Error:', error.message);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        throw error;
    }
};

/**
 * Withdraw USDT from Hyperliquid to Arbitrum
 * @param {ethers.Signer} signer - MetaMask signer
 * @param {string|number} amount - Amount to withdraw (as string or number)
 * @param {string} destination - Destination address on Arbitrum (defaults to signer address)
 * @param {string|number} chainId - Chain ID to determine mainnet/testnet
 * @returns {Promise<Object>} Withdrawal result
 */
export const withdrawUSDT = async (signer, amount, destination = null, chainId = '42161') => {
    // USDT withdrawal uses the same structure as USDC
    // The token type is determined by Hyperliquid based on the action
    // For now, we'll use the same function but could extend it later
    return withdrawUSDC(signer, amount, destination, chainId);
};

