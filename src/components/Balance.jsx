import { useState, useEffect } from 'react';
import { getUserPerpBalance } from '../services/hyperliquid-api';
import { Wallet, RefreshCw, AlertCircle, DollarSign } from 'lucide-react';
import { useWallet } from '../hooks/useWallet';

const Balance = () => {
    const { account, isConnected, chainId } = useWallet();
    const [balance, setBalance] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchBalance = async () => {
        if (!account || !chainId) {
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            setError(null);
            // Fetch balance directly from Hyperliquid info endpoint
            const data = await getUserPerpBalance(account, chainId);
            setBalance(data);
        } catch (err) {
            setError(err.message || 'Failed to fetch balance');
            console.error('Error fetching balance:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchBalance();
        if (account && chainId) {
            const interval = setInterval(fetchBalance, 10000); // Refresh every 10 seconds
            return () => clearInterval(interval);
        }
    }, [account, chainId]);

    if (loading && !balance) {
        return (
            <div className="bg-white rounded-lg shadow-lg p-6">
                <div className="flex items-center justify-center py-8">
                    <RefreshCw className="w-6 h-6 text-primary-600 animate-spin" />
                    <span className="ml-2 text-gray-600">Loading balance...</span>
                </div>
            </div>
        );
    }

    if (error && !balance) {
        return (
            <div className="bg-white rounded-lg shadow-lg p-6">
                <div className="flex items-center gap-3 text-red-600">
                    <AlertCircle className="w-5 h-5" />
                    <span>{error}</span>
                </div>
            </div>
        );
    }

    if (!balance) {
        return null;
    }

    const accountValue = parseFloat(balance.account_value || 0);
    const totalCollateral = parseFloat(balance.total_collateral || 0);
    const totalMarginUsed = parseFloat(balance.total_margin_used || 0);
    const availableMargin = totalCollateral - totalMarginUsed;

    return (
        <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                    <Wallet className="w-6 h-6" />
                    Account Balance
                </h2>
                <button
                    onClick={fetchBalance}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition flex items-center gap-2"
                >
                    <RefreshCw className="w-4 h-4" />
                    Refresh
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-gradient-to-br from-primary-500 to-primary-600 rounded-lg p-6 text-white">
                    <div className="flex items-center justify-between mb-2">
                        <p className="text-primary-100 text-sm">Account Value</p>
                        <DollarSign className="w-5 h-5" />
                    </div>
                    <p className="text-3xl font-bold">${accountValue.toFixed(2)}</p>
                </div>

                <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg p-6 text-white">
                    <div className="flex items-center justify-between mb-2">
                        <p className="text-green-100 text-sm">Total Collateral</p>
                        <DollarSign className="w-5 h-5" />
                    </div>
                    <p className="text-3xl font-bold">${totalCollateral.toFixed(2)}</p>
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-gray-500 text-sm mb-1">Available Margin</p>
                    <p className="text-2xl font-bold text-gray-900">${availableMargin.toFixed(2)}</p>
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-gray-500 text-sm mb-1">Margin Used</p>
                    <p className="text-2xl font-bold text-gray-900">${totalMarginUsed.toFixed(2)}</p>
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-gray-500 text-sm mb-1">Total Notional Position</p>
                    <p className="text-2xl font-bold text-gray-900">${parseFloat(balance.total_ntl_pos || 0).toFixed(2)}</p>
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-gray-500 text-sm mb-1">Unrealized PnL</p>
                    <p className={`text-2xl font-bold ${parseFloat(balance.total_noid_pnl || 0) >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                        ${parseFloat(balance.total_noid_pnl || 0).toFixed(2)}
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Balance;

