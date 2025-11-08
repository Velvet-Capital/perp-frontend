import { useState, useEffect } from 'react';
import { getOpenOrders, cancelOrder, cancelAllOrders, getErrorMessage } from '../services/api';
import { X, RefreshCw, AlertCircle } from 'lucide-react';
import { useWallet } from '../hooks/useWallet';
import { signCancelOrder, signCancelAllOrders } from '../utils/hyperliquid-signing';

const Orders = () => {
    const { account, signer, chainId, isConnected } = useWallet();
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [canceling, setCanceling] = useState(null);

    const fetchOrders = async () => {
        if (!account) {
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            setError(null);
            const data = await getOpenOrders(account);
            setOrders(data.open_orders || []);
        } catch (err) {
            const errorMessage = err.userMessage || getErrorMessage(err) || 'Failed to fetch orders';
            setError(errorMessage);
            console.error('Error fetching orders:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchOrders();
        if (account) {
            const interval = setInterval(fetchOrders, 10000); // Refresh every 10 seconds
            return () => clearInterval(interval);
        }
    }, [account]);

    const handleCancel = async (order) => {
        if (!account || !isConnected) {
            alert('Please connect your MetaMask wallet first');
            return;
        }

        if (!signer || !chainId) {
            alert('Signer or chain ID not available. Please ensure MetaMask is connected.');
            return;
        }

        try {
            setCanceling(order.oid);

            // Sign the cancel order using MetaMask wallet
            const signedCancelData = await signCancelOrder({
                coin: order.coin,
                oid: order.oid,
                cloid: order.cloid
            }, account, signer, chainId);

            // Log signed cancel data from frontend
            console.log('='.repeat(60));
            console.log('SIGNED CANCEL DATA FROM FRONTEND:');
            console.log('='.repeat(60));
            console.log('Full signedCancelData:', JSON.stringify(signedCancelData, null, 2));
            console.log('Signed Payload:', JSON.stringify(signedCancelData?.payload, null, 2));
            console.log('='.repeat(60));

            // Send signed cancel data to backend
            await cancelOrder({
                coin: order.coin,
                oid: order.oid,
                cloid: order.cloid
            }, signedCancelData);

            await fetchOrders();
        } catch (err) {
            const errorMessage = err.userMessage || getErrorMessage(err) || 'Failed to cancel order';
            alert(`Failed to cancel order: ${errorMessage}`);
        } finally {
            setCanceling(null);
        }
    };

    const handleCancelAll = async () => {
        if (!account || !isConnected) {
            alert('Please connect your MetaMask wallet first');
            return;
        }

        if (!signer || !chainId) {
            alert('Signer or chain ID not available. Please ensure MetaMask is connected.');
            return;
        }

        if (!window.confirm('Are you sure you want to cancel all orders?')) {
            return;
        }

        try {
            // Sign the cancel-all order using MetaMask wallet
            const signedCancelData = await signCancelAllOrders({
                coin: null
            }, account, signer, chainId);

            // Log signed cancel-all data from frontend
            console.log('='.repeat(60));
            console.log('SIGNED CANCEL-ALL DATA FROM FRONTEND:');
            console.log('='.repeat(60));
            console.log('Full signedCancelData:', JSON.stringify(signedCancelData, null, 2));
            console.log('Signed Payload:', JSON.stringify(signedCancelData?.payload, null, 2));
            console.log('='.repeat(60));

            // Send signed cancel-all data to backend
            await cancelAllOrders(null, signedCancelData);

            await fetchOrders();
        } catch (err) {
            const errorMessage = err.userMessage || getErrorMessage(err) || 'Failed to cancel all orders';
            alert(`Failed to cancel all orders: ${errorMessage}`);
        }
    };

    if (loading && orders.length === 0) {
        return (
            <div className="bg-white rounded-lg shadow-lg p-6">
                <div className="flex items-center justify-center py-8">
                    <RefreshCw className="w-6 h-6 text-primary-600 animate-spin" />
                    <span className="ml-2 text-gray-600">Loading orders...</span>
                </div>
            </div>
        );
    }

    if (error && orders.length === 0) {
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
        <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Open Orders</h2>
                <div className="flex gap-2">
                    <button
                        onClick={fetchOrders}
                        className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition flex items-center gap-2"
                    >
                        <RefreshCw className="w-4 h-4" />
                        Refresh
                    </button>
                    {orders.length > 0 && (
                        <button
                            onClick={handleCancelAll}
                            className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition"
                        >
                            Cancel All
                        </button>
                    )}
                </div>
            </div>

            {orders.length === 0 ? (
                <div className="text-center py-12">
                    <p className="text-gray-500">No open orders</p>
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-gray-200">
                                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Coin</th>
                                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Side</th>
                                <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Size</th>
                                <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Price</th>
                                <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {orders.map((order) => (
                                <tr key={order.oid || order.cloid} className="border-b border-gray-100 hover:bg-gray-50">
                                    <td className="py-3 px-4 text-sm font-medium text-gray-900">{order.coin}</td>
                                    <td className="py-3 px-4">
                                        <span className={`px-2 py-1 rounded text-xs font-medium ${order.side === 'B' || order.side === 'buy'
                                            ? 'bg-green-100 text-green-700'
                                            : 'bg-red-100 text-red-700'
                                            }`}>
                                            {order.side === 'B' || order.side === 'buy' ? 'Buy' : 'Sell'}
                                        </span>
                                    </td>
                                    <td className="py-3 px-4 text-sm text-gray-900 text-right">{order.sz}</td>
                                    <td className="py-3 px-4 text-sm text-gray-900 text-right">${parseFloat(order.limit_px).toFixed(2)}</td>
                                    <td className="py-3 px-4 text-right">
                                        <button
                                            onClick={() => handleCancel(order)}
                                            disabled={canceling === order.oid}
                                            className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 transition text-sm disabled:opacity-50"
                                        >
                                            {canceling === order.oid ? 'Canceling...' : 'Cancel'}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default Orders;

