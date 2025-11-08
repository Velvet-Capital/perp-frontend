import { useState, useEffect } from 'react';
import { closePosition, getAllMids, getMarketMeta, getErrorMessage } from '../services/api';
import { getUserPositions, getUserOpenOrders } from '../services/hyperliquid-api';
import { TrendingUp, TrendingDown, RefreshCw, AlertCircle, X } from 'lucide-react';
import { useWallet } from '../hooks/useWallet';
import { getAgentAddress, getAgentPrivateKey } from '../utils/agent-storage';

const Positions = () => {
    const { account, isConnected, chainId } = useWallet();
    const [positions, setPositions] = useState([]);
    const [openOrders, setOpenOrders] = useState({}); // Map of coin -> orders
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [closingPosition, setClosingPosition] = useState(null);
    const [closeError, setCloseError] = useState(null);
    const [closeSuccess, setCloseSuccess] = useState(null);
    const [perpPrices, setPerpPrices] = useState({});
    const [loadingPrices, setLoadingPrices] = useState(false);

    const fetchPositions = async () => {
        if (!account || !chainId) {
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            setError(null);

            // Fetch positions directly from Hyperliquid info endpoint
            const positionsData = await getUserPositions(account, chainId);
            setPositions(positionsData || []);

            // Also fetch open orders directly from Hyperliquid
            try {
                const orders = await getUserOpenOrders(account, chainId);

                // Group orders by coin
                const ordersByCoin = {};
                orders.forEach(order => {
                    const coin = order.coin;
                    if (!ordersByCoin[coin]) {
                        ordersByCoin[coin] = [];
                    }
                    ordersByCoin[coin].push(order);
                });
                setOpenOrders(ordersByCoin);
            } catch (err) {
                console.error('Error fetching open orders:', err);
                setOpenOrders({});
            }
        } catch (err) {
            setError(err.message || 'Failed to fetch positions');
            console.error('Error fetching positions:', err);
        } finally {
            setLoading(false);
        }
    };

    // Fetch all perpetual prices
    const fetchPerpPrices = async () => {
        setLoadingPrices(true);
        try {
            const [meta, mids] = await Promise.all([
                getMarketMeta(),
                getAllMids()
            ]);

            if (meta && meta.universe && mids && mids.all_mids) {
                const prices = {};
                meta.universe.forEach((item) => {
                    const coinName = item.name || item;
                    if (mids.all_mids[coinName]) {
                        prices[coinName] = parseFloat(mids.all_mids[coinName]);
                    }
                });
                setPerpPrices(prices);
            }
        } catch (err) {
            console.error('Error fetching perpetual prices:', err);
            setPerpPrices({});
        } finally {
            setLoadingPrices(false);
        }
    };

    useEffect(() => {
        fetchPositions();
        fetchPerpPrices();
        if (account && chainId) {
            const interval = setInterval(() => {
                fetchPositions();
                fetchPerpPrices();
            }, 10000); // Refresh every 10 seconds
            return () => clearInterval(interval);
        }
    }, [account, chainId]);

    const handleClosePosition = async (coin) => {
        if (!account) {
            setCloseError('Please connect your MetaMask wallet first');
            return;
        }

        // Check if agent exists
        const agentAddress = getAgentAddress(account);
        const agentPrivateKey = getAgentPrivateKey(account);

        if (!agentAddress || !agentPrivateKey) {
            setCloseError('No agent found. Please create an agent first before closing positions.');
            return;
        }

        setClosingPosition(coin);
        setCloseError(null);
        setCloseSuccess(null);

        try {
            // Close the position (full position, market price with default slippage)
            console.log('='.repeat(60));
            console.log('CLOSING POSITION - REQUEST PARAMS:');
            console.log('='.repeat(60));
            console.log('Coin:', coin);
            console.log('User Address (MetaMask):', account);
            console.log('Agent Address:', agentAddress);
            console.log('='.repeat(60));

            const result = await closePosition(
                coin,
                agentAddress,
                agentPrivateKey,
                account, // userAddress - check positions for user's main address
                null, // sz - null means close full position
                null, // px - null means use market price
                0.01  // slippage - 1% default
            );

            console.log('='.repeat(60));
            console.log('CLOSE POSITION RESPONSE:');
            console.log('='.repeat(60));
            console.log('Result:', result);
            console.log('='.repeat(60));

            setCloseSuccess(result.message || `Position closed successfully for ${coin}`);
            // Refresh positions and orders after closing
            setTimeout(() => {
                fetchPositions();
                setCloseSuccess(null);
            }, 2000);
        } catch (err) {
            const errorMessage = err.userMessage || getErrorMessage(err) || 'Failed to close position';
            setCloseError(errorMessage);
            console.error('Error closing position:', err);
        } finally {
            setClosingPosition(null);
        }
    };

    if (loading && positions.length === 0) {
        return (
            <div className="bg-white rounded-lg shadow-lg p-6">
                <div className="flex items-center justify-center py-8">
                    <RefreshCw className="w-6 h-6 text-primary-600 animate-spin" />
                    <span className="ml-2 text-gray-600">Loading positions...</span>
                </div>
            </div>
        );
    }

    if (error && positions.length === 0) {
        return (
            <div className="bg-white rounded-lg shadow-lg p-6">
                <div className="flex items-center gap-3 text-red-600">
                    <AlertCircle className="w-5 h-5" />
                    <span>{error}</span>
                </div>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            {/* Perpetual Prices Sidebar - Left */}
            <div className="lg:col-span-1">
                <div className="bg-white rounded-lg shadow-lg p-4 sticky top-4">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-semibold text-gray-700">Perp Prices</h3>
                        <button
                            onClick={fetchPerpPrices}
                            disabled={loadingPrices}
                            className="text-gray-600 hover:text-gray-800 transition"
                            title="Refresh prices"
                        >
                            <RefreshCw className={`w-4 h-4 ${loadingPrices ? 'animate-spin' : ''}`} />
                        </button>
                    </div>
                    <div className="max-h-[calc(100vh-200px)] overflow-y-auto space-y-1">
                        {loadingPrices ? (
                            <div className="text-xs text-gray-500 text-center py-4">Loading...</div>
                        ) : Object.keys(perpPrices).length > 0 ? (
                            Object.entries(perpPrices)
                                .sort(([a], [b]) => a.localeCompare(b))
                                .map(([coin, price]) => {
                                    // Format price based on value
                                    const formatPrice = (p) => {
                                        if (p >= 1000) return p.toLocaleString('en-US', { maximumFractionDigits: 2 });
                                        if (p >= 1) return p.toFixed(2);
                                        if (p >= 0.01) return p.toFixed(4);
                                        return p.toFixed(8);
                                    };
                                    return (
                                        <div key={coin} className="flex items-center justify-between text-xs py-1.5 px-2 hover:bg-gray-50 rounded border-b border-gray-100 last:border-b-0">
                                            <span className="text-gray-700 font-medium">{coin}</span>
                                            <span className="text-gray-600 font-mono">${formatPrice(price)}</span>
                                        </div>
                                    );
                                })
                        ) : (
                            <div className="text-xs text-gray-500 text-center py-4">No prices available</div>
                        )}
                    </div>
                </div>
            </div>

            {/* Positions Content - Right */}
            <div className="lg:col-span-3">
                <div className="bg-white rounded-lg shadow-lg p-6">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-2xl font-bold text-gray-900">Positions</h2>
                        <button
                            onClick={fetchPositions}
                            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition flex items-center gap-2"
                        >
                            <RefreshCw className="w-4 h-4" />
                            Refresh
                        </button>
                    </div>

                    {closeError && (
                        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-600">
                            <AlertCircle className="w-5 h-5" />
                            <span className="text-sm">{closeError}</span>
                        </div>
                    )}

                    {closeSuccess && (
                        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-600">
                            <span className="text-sm">{closeSuccess}</span>
                        </div>
                    )}

                    {positions.length === 0 ? (
                        <div className="text-center py-12">
                            <p className="text-gray-500">No open positions</p>
                        </div>
                    ) : (
                        <div className="grid gap-4">
                            {positions.map((position, index) => {
                                const isLong = parseFloat(position.size) > 0;
                                const pnl = parseFloat(position.unrealized_pnl || 0);
                                const pnlColor = pnl >= 0 ? 'text-green-600' : 'text-red-600';

                                return (
                                    <div key={index} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition">
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center gap-3">
                                                <span className="text-lg font-bold text-gray-900">{position.coin}</span>
                                                <span className={`px-2 py-1 rounded text-xs font-medium ${isLong ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                                    }`}>
                                                    {isLong ? 'Long' : 'Short'}
                                                </span>
                                            </div>
                                            <div className={`flex items-center gap-1 font-semibold ${pnlColor}`}>
                                                {pnl >= 0 ? (
                                                    <TrendingUp className="w-4 h-4" />
                                                ) : (
                                                    <TrendingDown className="w-4 h-4" />
                                                )}
                                                <span>${pnl.toFixed(2)}</span>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-3">
                                            <div>
                                                <p className="text-gray-500">Size</p>
                                                <p className="font-medium text-gray-900">{Math.abs(position.size)}</p>
                                            </div>
                                            <div>
                                                <p className="text-gray-500">Entry Price</p>
                                                <p className="font-medium text-gray-900">${parseFloat(position.entry_px || 0).toFixed(2)}</p>
                                            </div>
                                            <div>
                                                <p className="text-gray-500">Leverage</p>
                                                <p className="font-medium text-gray-900">{position.leverage}x</p>
                                            </div>
                                            <div>
                                                <p className="text-gray-500">Liq. Price</p>
                                                <p className="font-medium text-gray-900">${parseFloat(position.liquidation_px || 0).toFixed(2)}</p>
                                            </div>
                                        </div>

                                        {/* Display open orders for this coin */}
                                        {openOrders[position.coin] && openOrders[position.coin].length > 0 && (
                                            <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                                <p className="text-xs font-medium text-blue-900 mb-2">
                                                    Open Orders ({openOrders[position.coin].length})
                                                </p>
                                                <div className="space-y-1">
                                                    {openOrders[position.coin].map((order, orderIdx) => (
                                                        <div key={orderIdx} className="text-xs text-blue-700 flex items-center justify-between">
                                                            <span>
                                                                {order.side === 'A' ? 'Sell' : 'Buy'} {order.sz} @ ${parseFloat(order.limit_px || 0).toFixed(2)}
                                                            </span>
                                                            {order.oid && (
                                                                <span className="text-blue-500">OID: {order.oid}</span>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        <div className="flex justify-end">
                                            <button
                                                onClick={() => handleClosePosition(position.coin)}
                                                disabled={closingPosition === position.coin}
                                                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm font-medium"
                                            >
                                                {closingPosition === position.coin ? (
                                                    <>
                                                        <RefreshCw className="w-4 h-4 animate-spin" />
                                                        <span>Closing...</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <X className="w-4 h-4" />
                                                        <span>Close Position</span>
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Positions;

