/**
 * Hyperliquid deposit utility
 * Handles USDC/USDT deposits to Hyperliquid via bridge contract
 */

import { ethers } from 'ethers';

// Contract Addresses (Arbitrum One Mainnet)
const USDC_ADDRESS = '0xaf88d065e77c8cC2239327C5EDb3A432268e5831'; // USDC on Arbitrum One
const USDT_ADDRESS = '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9'; // USDT on Arbitrum One
const HYPERLIQUID_BRIDGE_ADDRESS = '0x2Df1c51E09aECF9cacB7bc98cB1742757f163dF7'; // Hyperliquid Bridge

// ERC20 ABI (minimal - just what we need)
const ERC20_ABI = [
    {
        constant: false,
        inputs: [
            { name: '_spender', type: 'address' },
            { name: '_value', type: 'uint256' }
        ],
        name: 'approve',
        outputs: [{ name: '', type: 'bool' }],
        type: 'function'
    },
    {
        constant: true,
        inputs: [{ name: '_owner', type: 'address' }],
        name: 'balanceOf',
        outputs: [{ name: 'balance', type: 'uint256' }],
        type: 'function'
    },
    {
        constant: true,
        inputs: [],
        name: 'decimals',
        outputs: [{ name: '', type: 'uint8' }],
        type: 'function'
    },
    {
        constant: true,
        inputs: [
            { name: '_owner', type: 'address' },
            { name: '_spender', type: 'address' }
        ],
        name: 'allowance',
        outputs: [{ name: '', type: 'uint256' }],
        type: 'function'
    },
    {
        constant: false,
        inputs: [
            { name: '_to', type: 'address' },
            { name: '_value', type: 'uint256' }
        ],
        name: 'transfer',
        outputs: [{ name: '', type: 'bool' }],
        type: 'function'
    }
];

/**
 * Get token contract address
 * @param {string} token - Token symbol ('USDC' or 'USDT')
 * @returns {string} Token contract address
 */
const getTokenAddress = (token) => {
    if (token === 'USDC') {
        return USDC_ADDRESS;
    } else if (token === 'USDT') {
        return USDT_ADDRESS;
    }
    throw new Error(`Unsupported token: ${token}`);
};

/**
 * Get token decimals
 * @param {string} token - Token symbol ('USDC' or 'USDT')
 * @returns {number} Token decimals (USDC: 6, USDT: 6)
 */
const getTokenDecimals = (token) => {
    // Both USDC and USDT on Arbitrum have 6 decimals
    return 6;
};

/**
 * Check allowance for bridge
 * @param {ethers.Signer} signer - MetaMask signer
 * @param {string} token - Token symbol ('USDC' or 'USDT')
 * @returns {Promise<string>} Current allowance as string
 */
export const getAllowance = async (signer, token) => {
    try {
        const tokenAddress = getTokenAddress(token);
        const contract = new ethers.Contract(tokenAddress, ERC20_ABI, signer);
        const address = await signer.getAddress();

        const allowance = await contract.allowance(address, HYPERLIQUID_BRIDGE_ADDRESS);
        return allowance.toString();
    } catch (error) {
        console.error('Error getting allowance:', error);
        return '0';
    }
};

/**
 * Approve token for bridge
 * @param {ethers.Signer} signer - MetaMask signer
 * @param {string} token - Token symbol ('USDC' or 'USDT')
 * @param {string|number} amount - Amount to approve
 * @returns {Promise<Object>} Transaction result
 */
export const approveToken = async (signer, token, amount) => {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ APPROVING', token, 'FOR HYPERLIQUID BRIDGE');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    try {
        const tokenAddress = getTokenAddress(token);
        const contract = new ethers.Contract(tokenAddress, ERC20_ABI, signer);
        const decimals = getTokenDecimals(token);
        const amountInUnits = ethers.parseUnits(amount.toString(), decimals);

        console.log('📝 Approval Details:');
        console.log('  - Token:', token);
        console.log('  - Amount:', amount, token);
        console.log('  - Amount (units):', amountInUnits.toString());
        console.log('  - Bridge Address:', HYPERLIQUID_BRIDGE_ADDRESS);

        const tx = await contract.approve(HYPERLIQUID_BRIDGE_ADDRESS, amountInUnits);
        console.log('✅ Approval transaction sent!');
        console.log('  - Transaction hash:', tx.hash);
        console.log('  - Waiting for confirmation...');

        const receipt = await tx.wait();
        console.log('✅ Approval confirmed!');
        console.log('  - Block number:', receipt.blockNumber);
        console.log('  - Status:', receipt.status === 1 ? 'Success' : 'Failed');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        return {
            success: true,
            txHash: tx.hash,
            blockNumber: receipt.blockNumber
        };
    } catch (error) {
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.error('❌ ERROR APPROVING', token);
        console.error('Error:', error.message);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        throw error;
    }
};

/**
 * Deposit USDC to Hyperliquid (Simple USDC Transfer to Bridge)
 * @param {ethers.Signer} signer - MetaMask signer
 * @param {string|number} amount - Amount to deposit
 * @param {string} token - Token symbol ('USDC' or 'USDT')
 * @returns {Promise<Object>} Deposit result
 */
export const depositUSDC = async (signer, amount, token = 'USDC') => {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('💸 DEPOSITING', token, 'TO HYPERLIQUID');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    try {
        const address = await signer.getAddress();
        const tokenAddress = getTokenAddress(token);
        const decimals = getTokenDecimals(token);

        // Convert amount to token units (6 decimals for USDC/USDT)
        const amountInUnits = ethers.parseUnits(amount.toString(), decimals);

        console.log('📝 Deposit Details:');
        console.log('  - Amount:', amount, token);
        console.log('  - Amount (units):', amountInUnits.toString());
        console.log('  - From:', address);
        console.log('  - To (Bridge):', HYPERLIQUID_BRIDGE_ADDRESS);
        console.log('  - Token Address:', tokenAddress);

        // Get token contract
        const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, signer);

        console.log('\n💳 Transferring', token, 'to Hyperliquid Bridge...');
        console.log('  - This is a simple', token, 'transfer');
        console.log('  - Bridge will automatically credit your Hyperliquid account');

        // Transfer token to bridge address
        const tx = await tokenContract.transfer(HYPERLIQUID_BRIDGE_ADDRESS, amountInUnits);

        console.log('✅ Transaction sent!');
        console.log('  - Transaction hash:', tx.hash);
        console.log('  - Waiting for confirmation...');

        // Wait for transaction confirmation
        const receipt = await tx.wait();

        console.log('✅ Transaction confirmed!');
        console.log('  - Block number:', receipt.blockNumber);
        console.log('  - Gas used:', receipt.gasUsed.toString());
        console.log('  - Status:', receipt.status === 1 ? 'Success' : 'Failed');

        console.log('\n💡 Your', token, 'should appear on Hyperliquid in ~30 seconds');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        return {
            status: 'ok',
            response: {
                txHash: tx.hash,
                blockNumber: receipt.blockNumber,
                gasUsed: receipt.gasUsed.toString(),
            }
        };
    } catch (error) {
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.error('❌ ERROR DEPOSITING', token);
        console.error('Error type:', error.name);
        console.error('Error message:', error.message);

        // Check for common errors
        if (error.message.includes('insufficient funds')) {
            console.error('💡 You need more ETH for gas fees');
        } else if (error.message.includes('exceeds balance')) {
            console.error('💡 You don\'t have enough', token);
        } else if (error.message.includes('user rejected')) {
            console.error('💡 Transaction was rejected in MetaMask');
        }

        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        throw error;
    }
};

/**
 * Deposit with automatic approval if needed
 * @param {ethers.Signer} signer - MetaMask signer
 * @param {string|number} amount - Amount to deposit
 * @param {string} token - Token symbol ('USDC' or 'USDT')
 * @returns {Promise<Object>} Deposit result
 */
export const depositWithApproval = async (signer, amount, token = 'USDC') => {
    try {
        // Check current allowance
        const currentAllowance = await getAllowance(signer, token);
        const decimals = getTokenDecimals(token);
        const amountInUnits = ethers.parseUnits(amount.toString(), decimals);

        // If allowance is insufficient, approve first
        if (BigInt(currentAllowance) < BigInt(amountInUnits.toString())) {
            console.log('⚠️ Insufficient allowance. Approving first...');
            await approveToken(signer, token, amount);

            // Wait a bit for approval to be confirmed
            await new Promise(resolve => setTimeout(resolve, 2000));
        }

        // Now deposit
        return await depositUSDC(signer, amount, token);
    } catch (error) {
        console.error('Error in depositWithApproval:', error);
        throw error;
    }
};

