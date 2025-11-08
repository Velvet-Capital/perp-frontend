/**
 * Direct Hyperliquid API client for frontend
 * Calls Hyperliquid endpoints directly without going through our backend
 */

/**
 * Get Hyperliquid API base URL based on chain ID
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
 * Get user state (clearinghouse state) from Hyperliquid info endpoint
 * This includes positions, balances, margin info, etc.
 * @param {string} address - User's wallet address
 * @param {string|number} chainId - Chain ID to determine mainnet/testnet
 * @returns {Promise<Object|null>} User state object or null on error
 */
export const getUserState = async (address, chainId = '42161') => {
    try {
        if (!address) {
            console.error('Address is required for getUserState');
            return null;
        }

        const baseUrl = getHyperliquidBaseUrl(chainId);
        const infoUrl = `${baseUrl}/info`;

        console.log('='.repeat(60));
        console.log('HYPERLIQUID API CALL - getUserState:');
        console.log('='.repeat(60));
        console.log('Address:', address);
        console.log('Chain ID:', chainId);
        console.log('Base URL:', baseUrl);
        console.log('Info URL:', infoUrl);
        console.log('='.repeat(60));

        const response = await fetch(infoUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                type: 'clearinghouseState',
                user: address
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('='.repeat(60));
            console.error('HYPERLIQUID API ERROR:');
            console.error('='.repeat(60));
            console.error('Status:', response.status);
            console.error('Status Text:', response.statusText);
            console.error('Error Response:', errorText);
            console.error('='.repeat(60));

            // Return null for 404 (user doesn't exist on Hyperliquid)
            if (response.status === 404) {
                return null;
            }

            throw new Error(`Hyperliquid API error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();

        console.log('='.repeat(60));
        console.log('HYPERLIQUID API RESPONSE:');
        console.log('='.repeat(60));
        console.log('Response:', JSON.stringify(data, null, 2));
        console.log('='.repeat(60));

        return data;
    } catch (error) {
        console.error('Error fetching user state from Hyperliquid:', error);
        return null;
    }
};

/**
 * Get user's perpetual balance from Hyperliquid
 * Extracts balance information from clearinghouse state
 * @param {string} address - User's wallet address
 * @param {string|number} chainId - Chain ID to determine mainnet/testnet
 * @returns {Promise<Object|null>} Balance object with total_collateral, account_value, etc.
 */
export const getUserPerpBalance = async (address, chainId = '42161') => {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🏦 CHECKING HYPERLIQUID BALANCE');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    try {
        console.log('📝 Fetching user state for:', address);

        const userState = await getUserState(address, chainId);

        if (!userState) {
            console.warn('⚠️ No user state returned');
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
            return {
                account_address: address,
                total_collateral: 0,
                total_noid_pnl: 0,
                total_raw_usd: 0,
                account_value: 0,
                total_margin_used: 0,
                total_ntl_pos: 0,
                usdc_balance: 0,
                message: 'Account not found on Hyperliquid'
            };
        }

        console.log('✅ User state received');
        console.log('📊 Margin Summary:', userState.marginSummary);

        // Extract balance information from user state
        // Hyperliquid returns marginSummary with these fields
        const marginSummary = userState.marginSummary || {};

        // Use accountValue as the USDC balance (as per user's example)
        const accountValue = parseFloat(marginSummary.accountValue || 0);
        const totalCollateral = parseFloat(marginSummary.totalCollateral || 0);
        const totalMarginUsed = parseFloat(marginSummary.totalMarginUsed || 0);

        console.log('💰 Hyperliquid Balance (accountValue):', accountValue, 'USDC');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        return {
            account_address: address,
            total_collateral: totalCollateral,
            total_noid_pnl: parseFloat(marginSummary.totalNoidPnl || 0),
            total_raw_usd: parseFloat(marginSummary.totalRawUsd || 0),
            account_value: accountValue,
            total_margin_used: totalMarginUsed,
            total_ntl_pos: parseFloat(marginSummary.totalNtlPos || 0),
            usdc_balance: accountValue, // USDC balance is the accountValue
            raw_data: userState // Include raw data for reference
        };
    } catch (error) {
        console.log('\n❌ ERROR FETCHING HYPERLIQUID BALANCE');
        console.error('Error:', error.message);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        return {
            account_address: address,
            total_collateral: 0,
            total_noid_pnl: 0,
            total_raw_usd: 0,
            account_value: 0,
            total_margin_used: 0,
            total_ntl_pos: 0,
            usdc_balance: 0,
            message: `Error: ${error.message || 'Failed to fetch balance'}`
        };
    }
};

/**
 * Get user's positions from Hyperliquid
 * @param {string} address - User's wallet address
 * @param {string|number} chainId - Chain ID to determine mainnet/testnet
 * @returns {Promise<Array>} Array of position objects
 */
export const getUserPositions = async (address, chainId = '42161') => {
    try {
        const userState = await getUserState(address, chainId);

        if (!userState || !userState.assetPositions) {
            return [];
        }

        const positions = [];
        userState.assetPositions.forEach((pos) => {
            const positionData = pos.position || {};
            const szi = parseFloat(positionData.szi || 0);

            if (szi !== 0) {
                positions.push({
                    coin: positionData.coin || '',
                    size: szi.toString(),
                    entry_px: parseFloat(positionData.entryPx || 0),
                    leverage: positionData.leverage?.value || 0,
                    unrealized_pnl: parseFloat(positionData.unrealizedPnl || 0),
                    liquidation_px: parseFloat(positionData.liquidationPx || 0)
                });
            }
        });

        return positions;
    } catch (error) {
        console.error('Error getting user positions:', error);
        return [];
    }
};

/**
 * Get leverage settings for a specific coin
 * @param {string} address - User's wallet address
 * @param {string} coin - Coin symbol (e.g., 'BTC')
 * @param {string|number} chainId - Chain ID to determine mainnet/testnet
 * @returns {Promise<Object|null>} Leverage data or null
 */
export const getCoinLeverage = async (address, coin, chainId = '42161') => {
    try {
        const baseUrl = getHyperliquidBaseUrl(chainId);
        const infoUrl = `${baseUrl}/info`;

        const response = await fetch(infoUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                type: 'activeAssetData',
                user: address,
                coin: coin
            }),
        });

        if (!response.ok) {
            if (response.status === 404) {
                return null;
            }
            throw new Error(`Hyperliquid API error: ${response.status}`);
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error(`Error getting leverage for ${coin}:`, error);
        return null;
    }
};

/**
 * Get leverage settings for all coins
 * @param {string} address - User's wallet address
 * @param {Array<string>} coins - Array of coin symbols
 * @param {string|number} chainId - Chain ID to determine mainnet/testnet
 * @returns {Promise<Object>} Map of coin -> leverage value
 */
export const getAllCoinLeverages = async (address, coins, chainId = '42161') => {
    const leverages = {};

    // Fetch leverage for each coin sequentially with delay to avoid rate limiting
    for (let i = 0; i < coins.length; i++) {
        const coin = coins[i];
        try {
            const leverageData = await getCoinLeverage(address, coin, chainId);
            console.log(`Leverage data for ${coin}:`, leverageData);

            if (leverageData) {
                let leverageValue = null;

                // Check different possible structures
                if (leverageData.leverage) {
                    leverageValue = typeof leverageData.leverage === 'object'
                        ? leverageData.leverage.value
                        : leverageData.leverage;
                } else if (leverageData.isolatedLeverage) {
                    leverageValue = typeof leverageData.isolatedLeverage === 'object'
                        ? leverageData.isolatedLeverage.value
                        : leverageData.isolatedLeverage;
                } else if (leverageData.crossLeverage) {
                    leverageValue = typeof leverageData.crossLeverage === 'object'
                        ? leverageData.crossLeverage.value
                        : leverageData.crossLeverage;
                }

                if (leverageValue && leverageValue > 0) {
                    leverages[coin] = leverageValue;
                    console.log(`Set leverage for ${coin} to ${leverageValue}x`);
                } else {
                    console.log(`No valid leverage found for ${coin}, data:`, leverageData);
                }
            }

            // Add delay between requests to avoid rate limiting (429 errors)
            // Only delay if not the last coin
            if (i < coins.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 500)); // 500ms delay to avoid rate limits
            }
        } catch (error) {
            console.error(`Error fetching leverage for ${coin}:`, error);
            // If we get a 429 error, wait longer before continuing
            if (error.message && error.message.includes('429')) {
                console.log('Rate limited, waiting 2 seconds before continuing...');
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
    }

    console.log('All leverages:', leverages);
    return leverages;
};

/**
 * Get user's open orders from Hyperliquid
 * @param {string} address - User's wallet address
 * @param {string|number} chainId - Chain ID to determine mainnet/testnet
 * @returns {Promise<Array>} Array of open order objects
 */
export const getUserOpenOrders = async (address, chainId = '42161') => {
    try {
        const baseUrl = getHyperliquidBaseUrl(chainId);
        const infoUrl = `${baseUrl}/info`;

        const response = await fetch(infoUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                type: 'openOrders',
                user: address
            }),
        });

        if (!response.ok) {
            if (response.status === 404) {
                return [];
            }
            throw new Error(`Hyperliquid API error: ${response.status}`);
        }

        const data = await response.json();
        return Array.isArray(data) ? data : [];
    } catch (error) {
        console.error('Error getting user open orders:', error);
        return [];
    }
};

