import { useState, useEffect } from 'react';
import { getAllMids, getMarketMeta } from '../services/api';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

const MarketPrices = () => {
    const [prices, setPrices] = useState({});
    const [prevPrices, setPrevPrices] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [perpPairs, setPerpPairs] = useState([]);

    useEffect(() => {
        const fetchPrices = async () => {
            try {
                setError(null);

                // Get perpetual pairs from meta
                const meta = await getMarketMeta();
                if (meta && meta.universe) {
                    // Filter only perpetual pairs (universe contains perp pairs)
                    const perps = meta.universe
                        .map(item => item.name || item)
                        .filter(Boolean)
                        .sort();
                    setPerpPairs(perps);
                }

                // Get current prices
                const mids = await getAllMids();
                if (mids && mids.all_mids) {
                    // Store current prices as previous before updating
                    setPrices(currentPrices => {
                        // Save current prices as previous (if they exist)
                        if (Object.keys(currentPrices).length > 0) {
                            setPrevPrices({ ...currentPrices });
                        }
                        // Return new prices
                        return mids.all_mids;
                    });
                }
            } catch (err) {
                console.error('Failed to fetch prices:', err);
                setError('Failed to load market prices');
            } finally {
                setLoading(false);
            }
        };

        fetchPrices();
        // Update prices every 5 seconds
        const interval = setInterval(fetchPrices, 5000);
        return () => clearInterval(interval);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const getPriceChange = (coin) => {
        const current = parseFloat(prices[coin] || 0);
        const previous = parseFloat(prevPrices[coin] || 0);
        if (previous === 0) return null;
        const change = ((current - previous) / previous) * 100;
        return change;
    };

    const formatPrice = (price) => {
        if (!price) return 'N/A';
        const num = parseFloat(price);
        if (num >= 1000) return num.toLocaleString('en-US', { maximumFractionDigits: 2 });
        if (num >= 1) return num.toFixed(2);
        if (num >= 0.01) return num.toFixed(4);
        return num.toFixed(8);
    };

    // Filter to only show perpetual pairs
    const displayPairs = perpPairs.length > 0
        ? perpPairs.filter(coin => prices[coin] !== undefined)
        : Object.keys(prices).sort();

    return (
        <div className="bg-white rounded-lg shadow-lg p-4 h-full">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-primary-600" />
                    <h3 className="text-sm font-semibold text-gray-700">Perp Prices</h3>
                </div>
                {loading && (
                    <div className="w-4 h-4 border-2 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
                )}
            </div>

            {error && (
                <div className="mb-2 p-2 bg-red-50 border border-red-200 rounded text-red-600 text-xs">
                    {error}
                </div>
            )}

            {loading && Object.keys(prices).length === 0 ? (
                <div className="text-center py-8">
                    <p className="text-xs text-gray-500">Loading prices...</p>
                </div>
            ) : displayPairs.length === 0 ? (
                <div className="text-center py-8">
                    <p className="text-xs text-gray-500">No prices available</p>
                </div>
            ) : (
                <div className="max-h-[calc(100vh-250px)] overflow-y-auto">
                    <div className="space-y-1">
                        {displayPairs.map((coin) => {
                            const price = prices[coin];
                            const change = getPriceChange(coin);

                            return (
                                <div key={coin} className="flex items-center justify-between text-xs py-1.5 px-2 hover:bg-gray-50 rounded border-b border-gray-100 last:border-b-0">
                                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                        <span className="font-medium text-gray-700 truncate">{coin}</span>
                                        {change !== null && (
                                            <span className={`flex-shrink-0 ${change > 0 ? 'text-green-600' :
                                                change < 0 ? 'text-red-600' : 'text-gray-500'
                                                }`}>
                                                {change > 0 && <TrendingUp className="w-3 h-3" />}
                                                {change < 0 && <TrendingDown className="w-3 h-3" />}
                                                {change === 0 && <Minus className="w-3 h-3" />}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                        <span className="text-gray-600 font-mono">${formatPrice(price)}</span>
                                        {change !== null && (
                                            <span className={`text-xs font-medium ${change > 0 ? 'text-green-600' :
                                                change < 0 ? 'text-red-600' : 'text-gray-500'
                                                }`}>
                                                {change > 0 ? '+' : ''}{change.toFixed(2)}%
                                            </span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            <div className="mt-2 text-xs text-gray-400 text-center">
                Updates every 5s
            </div>
        </div>
    );
};

export default MarketPrices;

