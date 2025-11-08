import { useState, useEffect } from 'react';
import { setLeverage, getMarketMeta, getErrorMessage } from '../services/api';
import { getAllCoinLeverages } from '../services/hyperliquid-api';
import { Settings, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { useWallet } from '../hooks/useWallet';
import { getAgentAddress, getAgentPrivateKey } from '../utils/agent-storage';

const LeverageSettings = () => {
    const { account, isConnected, chainId } = useWallet();
    const [perpCoins, setPerpCoins] = useState([]);
    const [coinLeverages, setCoinLeverages] = useState({}); // coin -> current leverage
    const [editingCoin, setEditingCoin] = useState(null); // coin being edited
    const [leverageInputs, setLeverageInputs] = useState({}); // coin -> input value
    const [loading, setLoading] = useState(true);
    const [loadingLeverages, setLoadingLeverages] = useState(false);
    const [saving, setSaving] = useState({}); // coin -> saving state
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);

    // Fetch available perpetual coins
    useEffect(() => {
        const fetchCoins = async () => {
            setLoading(true);
            try {
                const meta = await getMarketMeta();
                if (meta && meta.universe) {
                    const coins = meta.universe
                        .map(item => item.name || item)
                        .filter(Boolean)
                        .sort();
                    setPerpCoins(coins);

                    // Initialize leverage inputs for each coin
                    const initialLeverages = {};
                    const initialInputs = {};
                    coins.forEach(coin => {
                        initialLeverages[coin] = 1; // Default leverage
                        initialInputs[coin] = '1';
                    });
                    setCoinLeverages(initialLeverages);
                    setLeverageInputs(initialInputs);
                } else {
                    console.error('No universe data in market meta:', meta);
                    setError('Failed to load perpetual markets. Please try refreshing.');
                }
            } catch (err) {
                console.error('Failed to fetch perpetual coins:', err);
                setError(`Failed to load perpetual markets: ${err.message || 'Unknown error'}`);
            } finally {
                setLoading(false);
            }
        };
        fetchCoins();
    }, []);

    // Initialize with defaults - don't fetch leverage automatically to avoid rate limits
    useEffect(() => {
        if (perpCoins.length > 0 && Object.keys(coinLeverages).length === 0) {
            const defaults = {};
            const defaultInputs = {};
            perpCoins.forEach(coin => {
                defaults[coin] = 1;
                defaultInputs[coin] = '1';
            });
            setCoinLeverages(defaults);
            setLeverageInputs(defaultInputs);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [perpCoins.length]);

    // Function to manually refresh leverage for all coins
    const handleRefreshLeverages = async () => {
        if (!account || !chainId || perpCoins.length === 0) {
            setError('Please connect your wallet to refresh leverage settings');
            return;
        }

        setLoadingLeverages(true);
        setError(null);
        try {
            // Fetch leverage for all coins using activeAssetData endpoint
            const leverages = await getAllCoinLeverages(account, perpCoins, chainId);

            // Build inputs map
            const inputs = {};

            // Initialize with defaults or fetched values
            perpCoins.forEach(coin => {
                if (leverages[coin] && leverages[coin] > 0) {
                    inputs[coin] = leverages[coin].toString();
                } else {
                    leverages[coin] = leverages[coin] || 1; // Use fetched or default to 1x
                    inputs[coin] = leverages[coin].toString();
                }
            });

            setCoinLeverages(leverages);
            setLeverageInputs(prev => ({ ...prev, ...inputs }));
            setSuccess('Leverage settings refreshed successfully');
            setTimeout(() => setSuccess(null), 3000);
        } catch (err) {
            console.error('Failed to fetch current leverage:', err);
            const errorMessage = err.userMessage || err.message || 'Failed to refresh leverage settings';
            setError(`Failed to refresh leverage: ${errorMessage}. Please try again later.`);
        } finally {
            setLoadingLeverages(false);
        }
    };

    // Fetch leverage for a single coin when user clicks to edit
    const fetchCoinLeverage = async (coin) => {
        if (!account || !chainId) return;

        try {
            const { getCoinLeverage } = await import('../services/hyperliquid-api');
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
                    setCoinLeverages(prev => ({ ...prev, [coin]: leverageValue }));
                    setLeverageInputs(prev => ({ ...prev, [coin]: leverageValue.toString() }));
                }
            }
        } catch (err) {
            console.error(`Failed to fetch leverage for ${coin}:`, err);
            // Silently fail - use existing value
        }
    };

    const handleSetLeverage = async (coin) => {
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

        const leverage = parseInt(leverageInputs[coin] || '1');
        if (leverage <= 0 || leverage > 50) {
            setError('Leverage must be between 1 and 50');
            return;
        }

        setSaving({ ...saving, [coin]: true });
        setError(null);
        setSuccess(null);

        try {
            // Always use isolated margin (is_cross: false)
            const result = await setLeverage(
                coin,
                leverage,
                false, // Always isolated margin
                agentAddress,
                agentPrivateKey
            );

            // Update the leverage for this coin
            setCoinLeverages({ ...coinLeverages, [coin]: leverage });
            setEditingCoin(null);
            setSuccess(`Leverage set to ${leverage}x for ${coin}`);

            // Clear success message after 3 seconds
            setTimeout(() => setSuccess(null), 3000);
        } catch (err) {
            const errorMessage = err.userMessage || getErrorMessage(err) || 'Failed to set leverage';
            setError(`${coin}: ${errorMessage}`);
        } finally {
            setSaving({ ...saving, [coin]: false });
        }
    };

    const handleLeverageChange = (coin, value) => {
        setLeverageInputs({ ...leverageInputs, [coin]: value });
    };

    if (!account || !isConnected) {
        return (
            <div className="bg-white rounded-lg shadow-lg p-6 text-center">
                <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">Please connect your MetaMask wallet to manage leverage settings</p>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <Settings className="w-6 h-6 text-primary-600" />
                    <h2 className="text-2xl font-bold text-gray-900">Leverage Settings</h2>
                </div>
                <div className="flex items-center gap-3">
                    {account && (
                        <button
                            onClick={handleRefreshLeverages}
                            disabled={loadingLeverages}
                            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm"
                        >
                            <RefreshCw className={`w-4 h-4 ${loadingLeverages ? 'animate-spin' : ''}`} />
                            {loadingLeverages ? 'Refreshing...' : 'Refresh Leverage'}
                        </button>
                    )}
                    <span className="px-3 py-1 bg-orange-100 text-orange-700 text-xs font-semibold rounded-full">
                        ISOLATED MARGIN ONLY
                    </span>
                </div>
            </div>

            {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-600">
                    <AlertCircle className="w-5 h-5" />
                    <span className="text-sm">{error}</span>
                </div>
            )}

            {success && (
                <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-600">
                    <CheckCircle className="w-5 h-5" />
                    <span className="text-sm">{success}</span>
                </div>
            )}

            <div className="space-y-4">
                {loading ? (
                    <div className="text-center py-8 text-gray-500">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
                        Loading perpetual markets...
                    </div>
                ) : perpCoins.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                        No perpetual markets available
                    </div>
                ) : (
                    perpCoins.map((coin) => {
                        const currentLeverage = coinLeverages[coin] || 1;
                        const isEditing = editingCoin === coin;
                        const isSaving = saving[coin] || false;
                        const leverageValue = leverageInputs[coin] || currentLeverage.toString();

                        return (
                            <div
                                key={coin}
                                className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition"
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            <h3 className="font-semibold text-gray-900">{coin}</h3>
                                            <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs font-medium rounded">
                                                PERP
                                            </span>
                                            <span className="px-2 py-1 bg-orange-100 text-orange-700 text-xs font-medium rounded">
                                                ISOLATED
                                            </span>
                                            {!isEditing && (
                                                <span className="text-sm text-gray-600">
                                                    Current: <strong>{currentLeverage}x</strong>
                                                </span>
                                            )}
                                        </div>

                                        {isEditing ? (
                                            <div className="space-y-3 mt-3">
                                                <div className="flex items-center gap-3">
                                                    <div className="flex-1">
                                                        <label className="block text-xs font-medium text-gray-700 mb-1">
                                                            Leverage (1-50x)
                                                        </label>
                                                        <div className="flex gap-2">
                                                            <input
                                                                type="number"
                                                                min="1"
                                                                max="50"
                                                                step="0.1"
                                                                value={leverageValue}
                                                                onChange={(e) => handleLeverageChange(coin, e.target.value)}
                                                                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                                                disabled={isSaving}
                                                            />
                                                            <span className="flex items-center text-gray-500">x</span>
                                                        </div>
                                                        <div className="flex gap-1 mt-2">
                                                            {[1, 2, 3, 5, 10, 20, 50].map((lev) => (
                                                                <button
                                                                    key={lev}
                                                                    type="button"
                                                                    onClick={() => handleLeverageChange(coin, lev.toString())}
                                                                    disabled={isSaving}
                                                                    className={`px-2 py-1 text-xs rounded ${leverageValue === lev.toString()
                                                                        ? 'bg-primary-600 text-white'
                                                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                                                        }`}
                                                                >
                                                                    {lev}x
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => handleSetLeverage(coin)}
                                                        disabled={isSaving}
                                                        className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                                    >
                                                        {isSaving ? (
                                                            <>
                                                                <RefreshCw className="w-4 h-4 animate-spin" />
                                                                Setting...
                                                            </>
                                                        ) : (
                                                            'Set Leverage'
                                                        )}
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            setEditingCoin(null);
                                                            setLeverageInputs({ ...leverageInputs, [coin]: currentLeverage.toString() });
                                                            setError(null);
                                                        }}
                                                        disabled={isSaving}
                                                        className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition disabled:opacity-50"
                                                    >
                                                        Cancel
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => {
                                                        // Fetch current leverage when user clicks to edit
                                                        fetchCoinLeverage(coin);
                                                        setEditingCoin(coin);
                                                    }}
                                                    className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition"
                                                >
                                                    Set Leverage
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            <div className="mt-6 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-xs text-blue-700">
                    <strong>Note:</strong> Leverage settings apply to future positions. Setting leverage for a coin will use that leverage for all new orders in that perpetual contract. All positions use <strong>isolated margin</strong> mode, which uses only the margin allocated to that specific position.
                </p>
            </div>
        </div>
    );
};

export default LeverageSettings;

