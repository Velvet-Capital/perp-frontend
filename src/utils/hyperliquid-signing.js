/**
 * Client-side Hyperliquid order signing
 * 
 * This module handles signing orders in the browser using MetaMask wallet.
 * Implements Hyperliquid's signing mechanism using EIP-712 typed data signing (matching the Python SDK)
 * 
 * All signing operations require a connected MetaMask wallet.
 */

import { ethers } from 'ethers';
import { encode } from '@msgpack/msgpack';
import { getMarketMeta } from '../services/api';

/**
 * Convert Ethereum address to integer (as Hyperliquid expects)
 * Hyperliquid uses integer representation of addresses
 */
const addressToInt = (address) => {
    // Remove 0x prefix and convert to BigInt
    return BigInt(address);
};

/**
 * Converts an Ethereum address to bytes
 */
const addressToBytes = (address) => {
    const hex = address.startsWith('0x') ? address.slice(2) : address;
    const bytes = new Uint8Array(20);
    for (let i = 0; i < 20; i++) {
        bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    }
    return bytes;
};

/**
 * Hashes an action using msgpack, nonce, vault address, and expiration
 * (TypeScript implementation of sign_l1_action from hyperliquid-python-sdk)
 */
const actionHash = (action, vaultAddress, nonce, expiresAfter) => {
    // Serialize action using msgpack
    const actionBytes = encode(action);
    let data = new Uint8Array(actionBytes);

    // Append nonce as 8 bytes (big-endian, unsigned)
    const nonceBytes = new Uint8Array(8);
    let nonceValue = typeof nonce === 'bigint' ? nonce : BigInt(nonce);
    if (nonceValue < 0n) {
        throw new Error('Nonce must be non-negative');
    }
    // Write big-endian 64-bit unsigned integer
    for (let i = 7; i >= 0; i--) {
        nonceBytes[i] = Number(nonceValue & 0xFFn);
        nonceValue = nonceValue >> 8n;
    }

    data = new Uint8Array([...data, ...nonceBytes]);

    // Append vault address flag and address if present
    if (vaultAddress === null || vaultAddress === undefined) {
        data = new Uint8Array([...data, 0x00]);
    } else {
        const vaultBytes = addressToBytes(vaultAddress);
        data = new Uint8Array([...data, 0x01, ...vaultBytes]);
    }

    // Append expiration if present
    if (expiresAfter !== null && expiresAfter !== undefined) {
        const expiresBytes = new Uint8Array(8);
        let expiresValue = typeof expiresAfter === 'bigint' ? expiresAfter : BigInt(expiresAfter);
        if (expiresValue < 0n) {
            throw new Error('ExpiresAfter must be non-negative');
        }
        for (let i = 7; i >= 0; i--) {
            expiresBytes[i] = Number(expiresValue & 0xFFn);
            expiresValue = expiresValue >> 8n;
        }
        data = new Uint8Array([...data, 0x00, ...expiresBytes]);
    }

    // Hash using keccak256
    // Convert Uint8Array to hex string for keccak
    const hexString = '0x' + Array.from(data).map(b => b.toString(16).padStart(2, '0')).join('');
    return ethers.keccak256(hexString);
};

/**
 * Constructs a phantom agent from a hash and network flag
 */
const constructPhantomAgent = (hash, isMainnet) => {
    return {
        source: isMainnet ? "a" : "b",
        connectionId: hash
    };
};

/**
 * Creates the EIP-712 payload for L1 actions
 * Note: chainId is hardcoded to 1337 in the original, but we'll use the provided chainId
 */
const l1Payload = (phantomAgent, chainId) => {
    // Convert chainId to number if it's a string
    const chainIdNum = typeof chainId === 'string' ? parseInt(chainId, 10) : chainId;

    console.log(`[l1Payload] Using chainId: ${chainIdNum} (${typeof chainIdNum}) for EIP-712 domain`);

    return {
        domain: {
            chainId: chainIdNum,
            name: "Exchange",
            verifyingContract: "0x0000000000000000000000000000000000000000",
            version: "1",
        },
        types: {
            Agent: [
                { name: "source", type: "string" },
                { name: "connectionId", type: "bytes32" },
            ],
        },
        primaryType: "Agent",
        message: phantomAgent,
    };
};

/**
 * Signs an EIP-712 typed data message
 * Note: ethers v6 handles EIP712Domain automatically, so we don't include it in types
 */
const signInner = async (signer, data) => {
    // ethers v6 doesn't need EIP712Domain in types and doesn't need primaryType
    // It's inferred automatically
    const signature = await signer.signTypedData(
        data.domain,
        data.types,
        data.message
    );

    // Parse the signature (ethers v6)
    const sigBytes = ethers.getBytes(signature);
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
 * Signs an L1 action for Hyperliquid exchange
 * (TypeScript implementation of sign_l1_action from hyperliquid-python-sdk)
 * 
 * @param {ethers.Signer|ethers.Wallet} signer - The signer to sign with
 * @param {Object} action - The action object to sign (will be msgpack serialized)
 * @param {string|null} activePool - The vault address (null if not using a vault)
 * @param {number|bigint} nonce - The nonce for the action
 * @param {number|bigint|null} expiresAfter - Optional expiration timestamp
 * @param {boolean} isMainnet - Whether this is for mainnet (true) or testnet (false)
 * @returns {Promise<Object>} Promise resolving to signature object with r, s, v fields
 */
const signL1Action = async (signer, action, activePool, nonce, expiresAfter, isMainnet, chainId) => {
    const hash = actionHash(action, activePool, nonce, expiresAfter);
    const phantomAgent = constructPhantomAgent(hash, isMainnet);
    const data = l1Payload(phantomAgent, chainId);
    return signInner(signer, data);
};

/**
 * Sign a Hyperliquid order using private key wallet or MetaMask signer
 * Based on Hyperliquid Python SDK's signing mechanism
 * 
 * @param {Object} orderParams - Order parameters
 * @param {string} orderParams.coin - Trading pair (e.g., 'BTC')
 * @param {boolean} orderParams.is_buy - True for buy, false for sell
 * @param {number} orderParams.sz - Order size
 * @param {number} orderParams.limit_px - Limit price
 * @param {string} orderParams.order_type - 'Limit' or 'Market'
 * @param {boolean} orderParams.reduce_only - Reduce only flag
 * @param {string} orderParams.cloid - Client order ID (optional)
 * @param {string} userAddress - User's MetaMask wallet address (required)
 * @param {ethers.Signer} signer - MetaMask signer (required)
 * @param {string|number} chainId - The chain ID (required for EIP-712)
 * @returns {Promise<Object>} Signed order data ready to send to backend
 */
export const signOrder = async (orderParams, userAddress = null, signer = null, chainId = null) => {
    try {
        // Signer and userAddress must be provided (from MetaMask)
        if (!signer) {
            throw new Error('Signer is required. Please connect your MetaMask wallet.');
        }

        if (!userAddress) {
            throw new Error('User address is required. Please connect your MetaMask wallet.');
        }

        // ChainId must be provided
        if (!chainId) {
            throw new Error('Chain ID is required. Please ensure your wallet is connected to a network.');
        }

        const {
            coin,
            is_buy,
            sz,
            limit_px,
            order_type,
            reduce_only,
            cloid
        } = orderParams;

        // Validate inputs
        if (!coin || sz <= 0 || !limit_px || limit_px <= 0) {
            throw new Error('Invalid order parameters');
        }

        if (!userAddress) {
            throw new Error('User address is required');
        }

        // Get asset index from meta (fetched earlier, includes coin_to_asset_index map)
        // For perps: a is the index in meta.universe (a small integer)
        // For spot: a = 10000 + index in spotMeta.universe
        const { getMarketMeta } = await import('../services/api');
        const metaData = await getMarketMeta();

        if (!metaData || !metaData.coin_to_asset_index) {
            throw new Error('Market metadata with coin_to_asset_index is required for signing');
        }

        const assetId = metaData.coin_to_asset_index[coin];

        if (assetId === undefined) {
            throw new Error(`Coin ${coin} not found in asset index map. Available coins: ${Object.keys(metaData.coin_to_asset_index).join(', ')}`);
        }

        // Create order wire structure matching Hyperliquid SDK format
        // Note: Hyperliquid is strict about field types and null values
        // a must be a Number (asset id), not a string
        const orderWire = {
            a: assetId, // Number, not string - this is the asset index
            b: is_buy,
            p: limit_px.toString(), // Price as string
            s: sz.toString(), // Size as string
            r: reduce_only || false,
            t: order_type === 'Market'
                ? { limit: { tif: 'Ioc' } }  // Immediate or Cancel for market
                : { limit: { tif: 'Gtc' } }, // Good Till Cancel for limit
        };

        // Only add 'c' field if cloid is provided (don't send null)
        if (cloid) {
            orderWire.c = cloid.toString();
        }

        // Create the action structure (Hyperliquid format)
        const action = {
            type: 'order',
            orders: [orderWire],
            grouping: 'na'
        };

        // Hyperliquid signing: use signL1Action (matching Python SDK)
        // Get nonce (timestamp in milliseconds)
        const nonce = Date.now();

        // Vault address is null for regular accounts
        const activePool = null;

        // Expires after is null (not using expiration)
        const expiresAfter = null;

        // Determine if mainnet based on chainId
        // Arbitrum One (42161) and Ethereum Mainnet (1) are considered mainnet
        const isMainnet = chainId === '1' || chainId === '42161' || chainId === 1 || chainId === 42161;

        // Validate chainId is provided
        if (!chainId) {
            throw new Error('Chain ID is required. Please ensure your wallet is connected.');
        }

        // Sign using signL1Action (matching Python SDK's sign_l1_action)
        if (!signer) {
            throw new Error('Signer is required. Please provide a signer or use private key wallet.');
        }

        console.log('='.repeat(60));
        console.log('SIGNING WITH signL1Action:');
        console.log('='.repeat(60));
        console.log('Action:', JSON.stringify(action, null, 2));
        console.log('Nonce:', nonce);
        console.log('IsMainnet:', isMainnet);
        console.log('ChainId (for EIP-712 domain):', chainId, `(${typeof chainId})`);
        console.log('ActivePool (vault):', activePool);
        console.log('ExpiresAfter:', expiresAfter);
        console.log('='.repeat(60));

        const signatureObj = await signL1Action(
            signer,
            action,
            activePool,
            nonce,
            expiresAfter,
            isMainnet,
            chainId
        );

        console.log('Signature:', signatureObj);

        // Create the signed payload in Hyperliquid format (matching SDK's _post_action)
        // The SDK's _post_action sends:
        // - action: the order action
        // - nonce: timestamp
        // - signature: {r, s, v}
        // - vaultAddress: optional, omit if not used (don't send null)
        // - expiresAfter: optional, omit if not used (don't send null)
        // Note: connectionId is NOT in the payload - it's only used in the EIP-712 signing
        const W = {
            action: action,
            nonce: nonce,
            signature: signatureObj // Use r, s, v format
        };

        // Only include vaultAddress if it's not null (for regular accounts, omit it)
        // SDK only includes it if action type is not in ["usdClassTransfer", "sendAsset"]
        // Since we're doing orders, we omit it

        // Only include expiresAfter if it's set (not null)
        // Since we're not using expiration, we omit it

        // Console log the payload for debugging
        console.log('=== Signed Order Payload (Frontend) ===');
        console.log('Payload:', JSON.stringify(signedPayload, null, 2));
        console.log('Payload keys:', Object.keys(signedPayload));
        console.log('Action:', signedPayload.action);
        console.log('Action orders[0].a (assetId):', signedPayload.action?.orders?.[0]?.a, '(should be a number)');
        console.log('Nonce:', signedPayload.nonce);
        console.log('Signature:', signedPayload.signature);

        return {
            signed: true,
            payload: signedPayload,
            user_address: userAddress
        };
    } catch (error) {
        console.error('Error signing order:', error);
        throw new Error(`Failed to sign order: ${error.message}`);
    }
};

/**
 * Sign a cancel order request using private key wallet or MetaMask signer with EIP-712
 * 
 * @param {Object} cancelParams - Cancel parameters
 * @param {string} cancelParams.coin - Trading pair (required for asset index)
 * @param {number} cancelParams.oid - Order ID to cancel (optional)
 * @param {string} cancelParams.cloid - Client order ID to cancel (optional)
 * @param {string} userAddress - User's MetaMask wallet address (required)
 * @param {ethers.Signer} signer - MetaMask signer (required)
 * @param {string|number} chainId - The chain ID (required for EIP-712)
 * @returns {Promise<Object>} Signed cancel data ready to send to backend
 */
export const signCancelOrder = async (cancelParams, userAddress = null, signer = null, chainId = null) => {
    try {
        // Signer and userAddress must be provided (from MetaMask)
        if (!signer) {
            throw new Error('Signer is required. Please connect your MetaMask wallet.');
        }

        if (!userAddress) {
            throw new Error('User address is required. Please connect your MetaMask wallet.');
        }

        // ChainId must be provided
        if (!chainId) {
            throw new Error('Chain ID is required. Please ensure your wallet is connected to a network.');
        }

        const { coin, oid, cloid } = cancelParams;

        // Get asset index from meta (fetched earlier, includes coin_to_asset_index map)
        // For perps: a is the index in meta.universe
        if (!coin) {
            throw new Error('Coin is required for cancel orders to get asset index');
        }

        const { getMarketMeta } = await import('../services/api');
        const metaData = await getMarketMeta();

        if (!metaData || !metaData.coin_to_asset_index) {
            throw new Error('Market metadata with coin_to_asset_index is required for signing');
        }

        const assetId = metaData.coin_to_asset_index[coin];

        if (assetId === undefined) {
            throw new Error(`Coin ${coin} not found in asset index map for cancel order`);
        }

        if (!userAddress) {
            throw new Error('User address is required');
        }

        // Create cancel action
        // a must be a Number (asset id), not a string
        const cancelEntry = {
            a: assetId // Number - asset index, not address
        };

        if (oid) {
            cancelEntry.o = oid; // Should be number, not string
        }
        if (cloid) {
            cancelEntry.c = cloid.toString();
        }

        const action = {
            type: 'cancel',
            cancels: [cancelEntry]
        };

        // Validate chainId is provided
        if (!chainId) {
            throw new Error('Chain ID is required. Please ensure your wallet is connected.');
        }

        // Vault address is null for regular accounts
        const activePool = null;
        const expiresAfter = null;
        const nonce = Date.now();

        // Determine if mainnet based on chainId
        const isMainnet = chainId === '1' || chainId === '42161' || chainId === 1 || chainId === 42161;

        // Sign using signL1Action (matching Python SDK's sign_l1_action)
        if (!signer) {
            throw new Error('Signer is required. Please provide a signer or use private key wallet.');
        }

        console.log('Signing cancel with signL1Action:');
        console.log('Action:', JSON.stringify(action, null, 2));
        console.log('Nonce:', nonce);

        const signatureObj = await signL1Action(
            signer,
            action,
            activePool,
            nonce,
            expiresAfter,
            isMainnet,
            chainId
        );

        // Create payload - omit optional fields if null
        const cancelPayload = {
            action: action,
            nonce: nonce,
            signature: signatureObj
        };

        // Only include optional fields if they're not null
        // (For cancel orders, we typically don't need vaultAddress or expiresAfter)

        return {
            signed: true,
            payload: cancelPayload,
            user_address: userAddress
        };
    } catch (error) {
        console.error('Error signing cancel order:', error);
        throw new Error(`Failed to sign cancel order: ${error.message}`);
    }
};

/**
 * Sign a cancel all orders request using MetaMask signer with EIP-712
 * 
 * @param {Object} cancelAllParams - Cancel all parameters
 * @param {string} cancelAllParams.coin - Trading pair (optional, null cancels all)
 * @param {string} userAddress - User's MetaMask wallet address (required)
 * @param {ethers.Signer} signer - MetaMask signer (required)
 * @param {string|number} chainId - The chain ID (required for EIP-712)
 * @returns {Promise<Object>} Signed cancel-all data ready to send to backend
 */
export const signCancelAllOrders = async (cancelAllParams, userAddress = null, signer = null, chainId = null) => {
    try {
        // Signer and userAddress must be provided (from MetaMask)
        if (!signer) {
            throw new Error('Signer is required. Please connect your MetaMask wallet.');
        }

        if (!userAddress) {
            throw new Error('User address is required. Please connect your MetaMask wallet.');
        }

        // ChainId must be provided
        if (!chainId) {
            throw new Error('Chain ID is required. Please ensure your wallet is connected to a network.');
        }

        const { coin } = cancelAllParams;

        if (!userAddress) {
            throw new Error('User address is required');
        }

        // Create cancel all action
        const action = {
            type: 'cancel',
            cancels: [{
                a: addressToInt(userAddress).toString()
                // Note: o and c are null, but we don't include null values in the action
            }]
        };

        // Vault address is null for regular accounts
        const activePool = null;
        const expiresAfter = null;
        const nonce = Date.now();

        // Determine if mainnet based on chainId
        const isMainnet = chainId === '1' || chainId === '42161' || chainId === 1 || chainId === 42161;

        // Sign using signL1Action (matching Python SDK's sign_l1_action)
        if (!signer) {
            throw new Error('Signer is required. Please provide a signer or use private key wallet.');
        }

        console.log('Signing cancel-all with signL1Action:');
        console.log('Action:', JSON.stringify(action, null, 2));
        console.log('Nonce:', nonce);

        const signatureObj = await signL1Action(
            signer,
            action,
            activePool,
            nonce,
            expiresAfter,
            isMainnet,
            chainId
        );

        // Create payload - omit optional fields if null
        const cancelAllPayload = {
            action: action,
            nonce: nonce,
            signature: signatureObj
        };

        // Only include optional fields if they're not null
        // (For cancel all orders, we typically don't need vaultAddress or expiresAfter)

        return {
            signed: true,
            payload: cancelAllPayload,
            user_address: userAddress,
            coin: coin || null
        };
    } catch (error) {
        console.error('Error signing cancel all orders:', error);
        throw new Error(`Failed to sign cancel all orders: ${error.message}`);
    }
};

// Note: Private key signing has been replaced with MetaMask signer
// All signing now uses MetaMask's signMessage method via the signer from useWallet hook
// This is more secure as users never need to expose their private keys

/**
 * Get market metadata for order validation
 */
export const getMetaForOrder = async () => {
    try {
        const meta = await getMarketMeta();
        return meta.meta || meta;
    } catch (error) {
        console.error('Error fetching market meta:', error);
        throw error;
    }
};
