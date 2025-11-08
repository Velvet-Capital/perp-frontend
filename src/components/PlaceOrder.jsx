import { useState, useEffect } from 'react';
import { placeOrder, getMarketMeta, getErrorMessage, setLeverage } from '../services/api';
import { getAllMids } from '../services/api';
import { getCoinLeverage } from '../services/hyperliquid-api';
import { ShoppingCart, AlertCircle, CheckCircle, Settings, RefreshCw } from 'lucide-react';
import { useWallet } from '../hooks/useWallet';
import { getAgentAddress, getAgentPrivateKey } from '../utils/agent-storage';

const PlaceOrder = () => {
    const { account, signer, chainId, isConnected } = useWallet();
    const [coin, setCoin] = useState('BTC');
    const [availableCoins, setAvailableCoins] = useState(['BTC', 'ETH', 'SOL']);
    const [perpCoins, setPerpCoins] = useState([]); // Store list of perpetual coins for validation
    const [isBuy, setIsBuy] = useState(true);
    const [usdcAmount, setUsdcAmount] = useState('');
    const [calculatedSize, setCalculatedSize] = useState(null);
    const [limitPrice, setLimitPrice] = useState('');
    const [orderType, setOrderType] = useState('Limit');
    const [reduceOnly, setReduceOnly] = useState(false);
    const [currentLeverage, setCurrentLeverage] = useState(1);
    const [leverageInput, setLeverageInput] = useState('1');
    const [isEditingLeverage, setIsEditingLeverage] = useState(false);
    const [loadingLeverage, setLoadingLeverage] = useState(false);
    const [savingLeverage, setSavingLeverage] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(false);

    // Fetch available perpetual coins on mount
    useEffect(() => {
        const fetchAvailableCoins = async () => {
            try {
                const meta = await getMarketMeta();
                if (meta && meta.universe) {
                    // Filter only perpetual pairs (universe contains perp pairs only)
                    const coins = meta.universe
                        .map(item => item.name || item)
                        .filter(Boolean)
                        .sort();
                    setAvailableCoins(coins);
                    setPerpCoins(coins); // Store for validation
                    // Set default to BTC (common perp pair) if available, otherwise first coin
                    if (coins.includes('BTC')) {
                        setCoin('BTC');
                    } else if (coins.length > 0) {
                        setCoin(coins[0]);
                    }
                }
            } catch (err) {
                console.error('Failed to fetch available perpetual coins:', err);
                // Keep default coins
            }
        };
        fetchAvailableCoins();
    }, []);

    // Calculate size from USDC amount when price or amount changes
    useEffect(() => {
        const calculateSize = async () => {
            if (!usdcAmount || parseFloat(usdcAmount) <= 0) {
                setCalculatedSize(null);
                return;
            }

            try {
                const allMids = await getAllMids();
                const currentPrice = limitPrice
                    ? parseFloat(limitPrice)
                    : parseFloat(allMids.all_mids[coin] || 0);

                if (currentPrice > 0) {
                    const usdc = parseFloat(usdcAmount);
                    // Size = USDC amount / price
                    // Leverage is set separately in Leverage Settings
                    const size = usdc / currentPrice;
                    setCalculatedSize(size);
                } else {
                    setCalculatedSize(null);
                }
            } catch (err) {
                console.error('Error calculating size:', err);
                setCalculatedSize(null);
            }
        };

        calculateSize();
    }, [usdcAmount, limitPrice, coin, orderType]);

    // Fetch leverage for the selected coin when it changes
    useEffect(() => {
        const fetchCoinLeverage = async () => {
            if (!account || !chainId || !coin) {
                setCurrentLeverage(1);
                setLeverageInput('1');
                return;
            }

            setLoadingLeverage(true);
            try {
                const leverageData = await getCoinLeverage(account, coin, chainId);

                if (leverageData) {
                    let leverageValue = null;

                    if (leverageData.leverage) {
                        leverageValue = typeof leverageData.leverage === 'object'
                            ? leverageData.leverage.value
                            : leverageData.leverage;
                    } else if (leverageData.isolatedLeverage) {
                        leverageValue = typeof leverageData.isolatedLeverage === 'object'
                            ? leverageData.isolatedLeverage.value
                            : leverageData.isolatedLeverage;
                    }

                    if (leverageValue && leverageValue > 0) {
                        setCurrentLeverage(leverageValue);
                        setLeverageInput(leverageValue.toString());
                    } else {
                        setCurrentLeverage(1);
                        setLeverageInput('1');
                    }
                } else {
                    setCurrentLeverage(1);
                    setLeverageInput('1');
                }
            } catch (err) {
                console.error(`Failed to fetch leverage for ${coin}:`, err);
                setCurrentLeverage(1);
                setLeverageInput('1');
            } finally {
                setLoadingLeverage(false);
            }
        };

        fetchCoinLeverage();
    }, [account, chainId, coin]);

    // Handle setting leverage for the selected coin
    const handleSetLeverage = async () => {
        if (!account || !isConnected) {
            setError('Please connect your MetaMask wallet first');
            return;
        }

        const agentAddress = getAgentAddress(account);
        const agentPrivateKey = getAgentPrivateKey(account);

        if (!agentAddress || !agentPrivateKey) {
            setError('No agent found. Please create an agent first.');
            return;
        }

        const leverage = parseInt(leverageInput || '1');
        if (leverage <= 0 || leverage > 50) {
            setError('Leverage must be between 1 and 50');
            return;
        }

        setSavingLeverage(true);
        setError(null);

        try {
            // Always use isolated margin (is_cross: false)
            await setLeverage(
                coin,
                leverage,
                false, // Always isolated margin
                agentAddress,
                agentPrivateKey
            );

            setCurrentLeverage(leverage);
            setIsEditingLeverage(false);
            setSuccess(`Leverage set to ${leverage}x for ${coin}`);
            setTimeout(() => setSuccess(false), 3000);
        } catch (err) {
            const errorMessage = err.userMessage || getErrorMessage(err) || 'Failed to set leverage';
            setError(`Failed to set leverage: ${errorMessage}`);
        } finally {
            setSavingLeverage(false);
        }
    };

    const handlePlaceOrder = async (e) => {
        e.preventDefault();

        if (!account || !isConnected) {
            setError('Please connect your MetaMask wallet first');
            return;
        }

        if (!usdcAmount || parseFloat(usdcAmount) <= 0) {
            setError('Please enter a valid USDC amount');
            return;
        }

        if (orderType === 'Limit' && (!limitPrice || parseFloat(limitPrice) <= 0)) {
            setError('Please enter a valid limit price for limit orders');
            return;
        }

        if (!calculatedSize || calculatedSize <= 0) {
            setError('Could not calculate order size. Please check your inputs.');
            return;
        }

        // Validate that the selected coin is a perpetual token
        if (perpCoins.length > 0 && !perpCoins.includes(coin)) {
            setError('Selected coin is not a perpetual token. Only perpetual contracts are supported for leveraged trading.');
            return;
        }

        // Check if agent exists
        const agentAddress = getAgentAddress(account);
        const agentPrivateKey = getAgentPrivateKey(account);

        if (!agentAddress || !agentPrivateKey) {
            setError('No agent found. Please create an agent first before placing orders.');
            return;
        }

        setLoading(true);
        setError(null);
        setSuccess(false);

        try {
            // Get market data
            const allMids = await getAllMids();
            let finalLimitPrice = parseFloat(limitPrice);

            // For market orders, use current mid price if no price provided
            if (orderType === 'Market' && !limitPrice) {
                finalLimitPrice = parseFloat(allMids.all_mids[coin] || 0);
                if (finalLimitPrice === 0) {
                    throw new Error(`Could not get market price for ${coin}`);
                }
            }

            // Calculate final size from USDC amount
            // Leverage is set separately in Leverage Settings and will be used automatically
            const usdc = parseFloat(usdcAmount);
            const finalSize = usdc / finalLimitPrice;

            // Send order to backend with agent credentials
            // Backend will initialize SDK and place the order
            // Leverage is already set for the coin in Leverage Settings
            const result = await placeOrder({
                coin,
                is_buy: isBuy,
                sz: finalSize,
                limit_px: finalLimitPrice,
                order_type: orderType,
                reduce_only: reduceOnly
            }, agentAddress, agentPrivateKey);

            setSuccess(true);
            setUsdcAmount('');
            setLimitPrice('');
            setCalculatedSize(null);

            // Clear success message after 3 seconds
            setTimeout(() => setSuccess(false), 3000);
        } catch (err) {
            // Extract error message from backend response
            const errorMessage = err.userMessage || getErrorMessage(err) || 'Failed to place order';
            setError(errorMessage);
            console.error('Error placing order:', err);
        } finally {
            setLoading(false);
        }
    };

    if (!account || !isConnected) {
        return (
            <div className="bg-white rounded-lg shadow-lg p-6 text-center">
                <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">Please connect your MetaMask wallet to place orders</p>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <ShoppingCart className="w-6 h-6 text-primary-600" />
                    <h2 className="text-2xl font-bold text-gray-900">Place Order</h2>
                </div>
                <span className="px-3 py-1 bg-purple-100 text-purple-700 text-xs font-semibold rounded-full">
                    PERPETUAL ONLY
                </span>
            </div>

            <form onSubmit={handlePlaceOrder} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Perpetual Coin
                        </label>
                        <select
                            value={coin}
                            onChange={(e) => setCoin(e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                            required
                        >
                            {availableCoins.map((coinOption) => (
                                <option key={coinOption} value={coinOption}>
                                    {coinOption} (Perp)
                                </option>
                            ))}
                        </select>
                        {availableCoins.length === 0 && (
                            <div className="text-sm text-gray-500 mt-2">
                                Loading perpetual markets...
                            </div>
                        )}
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Leverage (Isolated)
                        </label>
                        {isEditingLeverage ? (
                            <div className="space-y-2">
                                <div className="flex gap-2">
                                    <input
                                        type="number"
                                        min="1"
                                        max="50"
                                        step="0.1"
                                        value={leverageInput}
                                        onChange={(e) => setLeverageInput(e.target.value)}
                                        disabled={savingLeverage || loadingLeverage}
                                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                    />
                                    <span className="flex items-center text-gray-500">x</span>
                                    <button
                                        type="button"
                                        onClick={handleSetLeverage}
                                        disabled={savingLeverage || loadingLeverage}
                                        className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm"
                                    >
                                        {savingLeverage ? (
                                            <>
                                                <RefreshCw className="w-4 h-4 animate-spin" />
                                                Setting...
                                            </>
                                        ) : (
                                            'Set'
                                        )}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIsEditingLeverage(false);
                                            setLeverageInput(currentLeverage.toString());
                                            setError(null);
                                        }}
                                        disabled={savingLeverage}
                                        className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition disabled:opacity-50 text-sm"
                                    >
                                        Cancel
                                    </button>
                                </div>
                                <div className="flex gap-1">
                                    {[1, 2, 3, 5, 10, 20, 50].map((lev) => (
                                        <button
                                            key={lev}
                                            type="button"
                                            onClick={() => setLeverageInput(lev.toString())}
                                            disabled={savingLeverage}
                                            className={`px-2 py-1 text-xs rounded ${leverageInput === lev.toString()
                                                    ? 'bg-primary-600 text-white'
                                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                                }`}
                                        >
                                            {lev}x
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2">
                                <div className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 flex items-center justify-between">
                                    <span className="text-gray-700">
                                        {loadingLeverage ? (
                                            <span className="flex items-center gap-2">
                                                <RefreshCw className="w-4 h-4 animate-spin" />
                                                Loading...
                                            </span>
                                        ) : (
                                            <strong>{currentLeverage}x</strong>
                                        )}
                                    </span>
                                    <span className="px-2 py-1 bg-orange-100 text-orange-700 text-xs font-medium rounded">
                                        ISOLATED
                                    </span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setIsEditingLeverage(true)}
                                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition flex items-center gap-2 text-sm"
                                >
                                    <Settings className="w-4 h-4" />
                                    Set
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Order Type
                        </label>
                        <select
                            value={orderType}
                            onChange={(e) => setOrderType(e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        >
                            <option value="Limit">Limit</option>
                            <option value="Market">Market</option>
                        </select>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Side
                        </label>
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={() => setIsBuy(true)}
                                className={`flex-1 px-4 py-2 rounded-lg font-medium transition ${isBuy
                                    ? 'bg-green-500 text-white'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                    }`}
                            >
                                Buy
                            </button>
                            <button
                                type="button"
                                onClick={() => setIsBuy(false)}
                                className={`flex-1 px-4 py-2 rounded-lg font-medium transition ${!isBuy
                                    ? 'bg-red-500 text-white'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                    }`}
                            >
                                Sell
                            </button>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Amount (USDC)
                        </label>
                        <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={usdcAmount}
                            onChange={(e) => setUsdcAmount(e.target.value)}
                            placeholder="0.00"
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                            required
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Calculated Size
                    </label>
                    <div className="px-4 py-2 border border-gray-300 rounded-lg bg-gray-50">
                        <span className="text-gray-700">
                            {calculatedSize !== null
                                ? `${calculatedSize.toFixed(6)} ${coin}`
                                : 'Enter amount and price'
                            }
                        </span>
                    </div>
                    {calculatedSize !== null && (
                        <p className="text-xs text-gray-500 mt-1">
                            Notional: ${parseFloat(usdcAmount || 0).toFixed(2)} USDC
                        </p>
                    )}
                    <p className="text-xs text-blue-600 mt-2">
                        💡 Leverage is set separately in the <strong>Leverage Settings</strong> page
                    </p>
                </div>

                {orderType === 'Limit' && (
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Limit Price
                        </label>
                        <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={limitPrice}
                            onChange={(e) => setLimitPrice(e.target.value)}
                            placeholder="0.00"
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                            required
                        />
                    </div>
                )}

                <div className="flex items-center">
                    <input
                        type="checkbox"
                        id="reduceOnly"
                        checked={reduceOnly}
                        onChange={(e) => setReduceOnly(e.target.checked)}
                        className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                    />
                    <label htmlFor="reduceOnly" className="ml-2 text-sm text-gray-700">
                        Reduce Only
                    </label>
                </div>

                {error && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-600">
                        <AlertCircle className="w-5 h-5" />
                        <span className="text-sm">{error}</span>
                    </div>
                )}

                {success && (
                    <div className="p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-600">
                        <CheckCircle className="w-5 h-5" />
                        <span className="text-sm">Order placed successfully!</span>
                    </div>
                )}

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full px-6 py-3 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {loading ? 'Placing Order...' : 'Place Order'}
                </button>
            </form>

            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-xs text-blue-700">
                    <strong>Note:</strong> This order form is for <strong>perpetual contracts only</strong>. Enter the amount in USDC and the system will calculate the position size automatically. You can set the leverage for the selected coin directly above. All positions use <strong>isolated margin</strong> mode. Make sure you have created an agent before placing orders.
                </p>
            </div>
        </div>
    );
};

export default PlaceOrder;

