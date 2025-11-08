/**
 * Utility functions for creating Hyperliquid agents on the frontend
 * Uses MetaMask wallet to sign and create agents
 */

import { ethers } from 'ethers';
import { encode } from '@msgpack/msgpack';

/**
 * Convert Ethereum address to bytes
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
 * Keccak256 hash function (using ethers)
 */
const keccak = (data) => {
    return ethers.keccak256(data);
};

/**
 * Hashes an action using msgpack, nonce, vault address, and expiration
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
 */
const l1Payload = (phantomAgent, chainId) => {
    const chainIdNum = typeof chainId === 'string' ? parseInt(chainId, 10) : chainId;

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
 */
const signInner = async (signer, data) => {
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
 */
const signL1Action = async (signer, action, activePool, nonce, expiresAfter, isMainnet, chainId) => {
    const hash = actionHash(action, activePool, nonce, expiresAfter);
    const phantomAgent = constructPhantomAgent(hash, isMainnet);
    const data = l1Payload(phantomAgent, chainId);
    return signInner(signer, data);
};

/**
 * Creates EIP-712 payload for user-signed actions (like agent approval)
 */
const userSignedPayload = (primaryType, payloadTypes, action, networkChainId) => {
    // Use the actual network chainId (from MetaMask) for the domain
    // MetaMask requires the domain chainId to match the active network
    // The signatureChainId in the action is separate and used by Hyperliquid
    const chainId = networkChainId || 42161;

    // ethers v6 handles EIP712Domain automatically, so we don't include it in types
    // Build types object - use the primaryType as the key
    const types = {};
    types[primaryType] = payloadTypes;

    return {
        domain: {
            name: "HyperliquidSignTransaction",
            version: "1",
            chainId: chainId, // Use actual network chainId for MetaMask compatibility
            verifyingContract: "0x0000000000000000000000000000000000000000"
        },
        types: types,
        // Note: primaryType is not needed for ethers v6 signTypedData - it's inferred
        // But we'll keep it for compatibility
        primaryType: primaryType,
        message: action
    };
};

/**
 * Signs a user-signed action (for agent approval)
 */
const signUserSignedAction = async (signer, action, payloadTypes, primaryType, isMainnet, networkChainId) => {
    // Add required fields to action (matching SDK)
    // Use Arbitrum mainnet chain ID (42161 = 0xa4b1) for signatureChainId
    // This is used by Hyperliquid for signature validation, not for the EIP-712 domain
    action.signatureChainId = isMainnet ? "0xa4b1" : "0x66eee"; // Arbitrum mainnet (42161) or testnet
    action.hyperliquidChain = isMainnet ? "Mainnet" : "Testnet";

    // Get the actual network chainId from the signer/provider
    // MetaMask requires the domain chainId to match the active network
    let actualChainId = networkChainId;
    if (!actualChainId && signer.provider) {
        try {
            const network = await signer.provider.getNetwork();
            actualChainId = Number(network.chainId);
        } catch (e) {
            console.warn('Could not get chainId from provider:', e);
            actualChainId = 42161; // Default to Arbitrum One
        }
    }

    // Create EIP-712 payload with actual network chainId
    // Note: We use networkChainId for the domain (must match MetaMask)
    // But signatureChainId stays in the action (used by Hyperliquid)
    const data = userSignedPayload(primaryType, payloadTypes, action, actualChainId);

    // For ethers v6, ensure types object only contains the primary type
    // DO NOT include EIP712Domain - ethers v6 handles it automatically
    const cleanTypes = {};
    cleanTypes[primaryType] = payloadTypes;

    // Verify cleanTypes doesn't have EIP712Domain
    if (cleanTypes.EIP712Domain) {
        delete cleanTypes.EIP712Domain;
    }

    // Log signature parameters in detail
    console.log('='.repeat(60));
    console.log('SIGNATURE PARAMETERS (EIP-712):');
    console.log('='.repeat(60));
    console.log('Domain:', JSON.stringify(data.domain, null, 2));
    console.log('Types:', JSON.stringify(cleanTypes, null, 2));
    console.log('Types Keys:', Object.keys(cleanTypes));
    console.log('Primary Type:', primaryType);
    console.log('Message:', JSON.stringify(data.message, null, 2));
    console.log('Network Chain ID:', actualChainId);
    console.log('Signature Chain ID:', action.signatureChainId);
    console.log('Is Mainnet:', isMainnet);
    console.log('Action:', JSON.stringify(action, null, 2));
    console.log('Payload Types:', JSON.stringify(payloadTypes, null, 2));
    console.log('='.repeat(60));

    // Verify domain chainId matches network
    if (data.domain.chainId !== actualChainId) {
        console.warn(`Domain chainId (${data.domain.chainId}) doesn't match network (${actualChainId}), updating...`);
        data.domain.chainId = actualChainId;
    }

    // Log what we're about to sign
    console.log('='.repeat(60));
    console.log('CALLING signTypedData:');
    console.log('='.repeat(60));
    console.log('Domain:', JSON.stringify(data.domain, null, 2));
    console.log('Types:', JSON.stringify(cleanTypes, null, 2));
    console.log('Message:', JSON.stringify(data.message, null, 2));
    console.log('='.repeat(60));

    // Sign using signTypedData
    // Note: ethers v6 handles EIP712Domain automatically, so we don't include it
    // Also, ethers v6 infers primaryType from the types object (should have only one key)
    // The domain chainId must match the active MetaMask network
    const signature = await signer.signTypedData(
        data.domain,
        cleanTypes,
        data.message
    );

    console.log('='.repeat(60));
    console.log('SIGNATURE RECEIVED:');
    console.log('='.repeat(60));
    console.log('Raw Signature:', signature);
    console.log('='.repeat(60));

    // Parse signature
    const sigBytes = ethers.getBytes(signature);
    const r = ethers.hexlify(sigBytes.slice(0, 32));
    const s = ethers.hexlify(sigBytes.slice(32, 64));
    const v = sigBytes[64];

    const parsedSignature = {
        r: r.replace(/^0x/, ""),
        s: s.replace(/^0x/, ""),
        v: v
    };

    console.log('='.repeat(60));
    console.log('PARSED SIGNATURE:');
    console.log('='.repeat(60));
    console.log('r:', parsedSignature.r);
    console.log('s:', parsedSignature.s);
    console.log('v:', parsedSignature.v);
    console.log('Full Signature Object:', JSON.stringify(parsedSignature, null, 2));
    console.log('='.repeat(60));

    return parsedSignature;
};

/**
 * Creates a Hyperliquid agent using MetaMask wallet
 * @param {ethers.Signer} signer - MetaMask signer
 * @param {string} userAddress - User's MetaMask address
 * @param {string} chainId - Chain ID (e.g., '42161' for Arbitrum One)
 * @param {string|null} agentName - Optional agent name
 * @returns {Promise<Object>} Agent credentials (address and private key)
 */
export const createAgentOnFrontend = async (signer, userAddress, chainId, agentName = null) => {
    try {
        if (!signer) {
            throw new Error('Signer is required');
        }

        if (!userAddress) {
            throw new Error('User address is required');
        }

        // Determine if mainnet based on chainId
        const isMainnet = chainId === '1' || chainId === '42161' || chainId === 1 || chainId === 42161;

        // Get base URL
        const baseUrl = isMainnet
            ? 'https://api.hyperliquid.xyz'
            : 'https://api.hyperliquid-testnet.xyz';

        const exchangeUrl = `${baseUrl}/exchange`;

        // Generate a random wallet for the agent (matching SDK behavior)
        // SDK uses: agent_key = "0x" + secrets.token_hex(32)
        const agentWallet = ethers.Wallet.createRandom();
        const agentAddress = agentWallet.address;
        const agentPrivateKey = agentWallet.privateKey;

        // Get timestamp (nonce) - matching SDK's get_timestamp_ms()
        const timestamp = Date.now();

        // Create action structure (matching SDK's approve_agent)
        const action = {
            type: "approveAgent",
            agentAddress: agentAddress,
            agentName: agentName || "",
            nonce: timestamp
        };

        // Define payload types for EIP-712 signing (matching SDK)
        const payloadTypes = [
            { name: "hyperliquidChain", type: "string" },
            { name: "agentAddress", type: "address" },
            { name: "agentName", type: "string" },
            { name: "nonce", type: "uint64" },
        ];

        const primaryType = "HyperliquidTransaction:ApproveAgent";

        // Log signature parameters
        console.log('='.repeat(60));
        console.log('SIGNATURE PARAMETERS:');
        console.log('='.repeat(60));
        console.log('Action:', JSON.stringify(action, null, 2));
        console.log('Is Mainnet:', isMainnet);
        console.log('Chain ID:', chainId);
        console.log('Payload Types:', JSON.stringify(payloadTypes, null, 2));
        console.log('Primary Type:', primaryType);
        console.log('User Address:', userAddress);
        console.log('Agent Address:', agentAddress);
        console.log('Agent Name:', agentName || '(none)');
        console.log('Timestamp (nonce):', timestamp);
        console.log('='.repeat(60));

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

        console.log('Network Chain ID (for EIP-712 domain):', networkChainId);
        console.log('='.repeat(60));

        // Sign using user-signed action (different from L1 action signing)
        const signatureObj = await signUserSignedAction(
            signer,
            action,
            payloadTypes,
            primaryType,
            isMainnet,
            networkChainId
        );

        // Remove agentName if it's empty (matching SDK behavior)
        if (!agentName) {
            delete action.agentName;
        }

        // Create the signed payload to send to Hyperliquid
        // The SDK's _post_action sends: action, signature, and nonce
        const signedPayload = {
            action: action,
            signature: signatureObj,
            nonce: timestamp
        };

        // Log request parameters
        console.log('='.repeat(60));
        console.log('AGENT CREATION REQUEST PARAMS:');
        console.log('='.repeat(60));
        console.log('Exchange URL:', exchangeUrl);
        console.log('User Address:', userAddress);
        console.log('Agent Address:', agentAddress);
        console.log('Agent Name:', agentName || '(none)');
        console.log('Is Mainnet:', isMainnet);
        console.log('Network Chain ID:', networkChainId);
        console.log('Timestamp (nonce):', timestamp);
        console.log('Signed Payload:', JSON.stringify(signedPayload, null, 2));
        console.log('Action:', JSON.stringify(action, null, 2));
        console.log('Signature:', JSON.stringify(signatureObj, null, 2));
        console.log('='.repeat(60));

        // Prepare API call parameters
        const fetchOptions = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(signedPayload)
        };

        // Log API call parameters
        console.log('='.repeat(60));
        console.log('API CALL PARAMETERS:');
        console.log('='.repeat(60));
        console.log('URL:', exchangeUrl);
        console.log('Method:', fetchOptions.method);
        console.log('Headers:', JSON.stringify(fetchOptions.headers, null, 2));
        console.log('Body:', fetchOptions.body);
        console.log('Body (parsed):', JSON.stringify(signedPayload, null, 2));
        console.log('='.repeat(60));

        // Call Hyperliquid exchange API to create agent
        const response = await fetch(exchangeUrl, fetchOptions);

        // Log response details
        console.log('='.repeat(60));
        console.log('AGENT CREATION RESPONSE:');
        console.log('='.repeat(60));
        console.log('Status:', response.status);
        console.log('Status Text:', response.statusText);
        console.log('Response OK:', response.ok);
        console.log('Response Headers:', Object.fromEntries(response.headers.entries()));
        console.log('='.repeat(60));

        if (!response.ok) {
            const errorText = await response.text();
            console.error('='.repeat(60));
            console.error('HYPERLIQUID API ERROR:');
            console.error('='.repeat(60));
            console.error('Status:', response.status);
            console.error('Status Text:', response.statusText);
            console.error('Error Response:', errorText);
            console.error('='.repeat(60));
            throw new Error(`Hyperliquid API error: ${response.status} - ${errorText}`);
        }

        const result = await response.json();
        console.log('='.repeat(60));
        console.log('AGENT CREATION SUCCESS RESPONSE:');
        console.log('='.repeat(60));
        console.log('Full Response:', JSON.stringify(result, null, 2));
        console.log('Response Type:', typeof result);
        console.log('Response Keys:', result ? Object.keys(result) : 'null');
        console.log('='.repeat(60));

        // Log final return structure
        const returnData = {
            status: 'success',
            agent_address: agentAddress,
            agent_private_key: agentPrivateKey,
            user_address: userAddress,
            agent_name: agentName,
            api_response: result
        };

        console.log('='.repeat(60));
        console.log('AGENT CREATION RETURN DATA:');
        console.log('='.repeat(60));
        console.log('Return Data:', JSON.stringify(returnData, null, 2));
        console.log('Agent Address:', returnData.agent_address);
        console.log('User Address:', returnData.user_address);
        console.log('Agent Name:', returnData.agent_name || '(none)');
        console.log('API Response:', JSON.stringify(returnData.api_response, null, 2));
        console.log('='.repeat(60));

        // Return agent credentials (matching SDK's return structure)
        return returnData;
    } catch (error) {
        console.error('Error creating agent on frontend:', error);
        throw new Error(`Failed to create agent: ${error.message}`);
    }
};

