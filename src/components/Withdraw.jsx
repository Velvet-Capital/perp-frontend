import { useState, useEffect } from 'react';
import { useWallet } from '../hooks/useWallet';
import { getTokenBalance } from '../utils/token-balance';
import { getUserPerpBalance } from '../services/hyperliquid-api';
import { withdrawUSDC, withdrawUSDT } from '../utils/withdrawal';
import { ArrowDownCircle, AlertCircle, CheckCircle, RefreshCw } from 'lucide-react';

const Withdraw = () => {
    const { account, signer, chainId, provider } = useWallet();
    const [amount, setAmount] = useState('');
    const [token, setToken] = useState('USDC');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(false);
    const [tokenBalance, setTokenBalance] = useState(null);
    const [loadingBalance, setLoadingBalance] = useState(false);
    const [hyperliquidBalance, setHyperliquidBalance] = useState(null);
    const [loadingHyperliquidBalance, setLoadingHyperliquidBalance] = useState(false);

    // Fetch token balance on Arbitrum
    const fetchTokenBalance = async () => {
        if (!account || !provider || !chainId) {
            setTokenBalance(null);
            return;
        }

        // Only fetch if on Arbitrum network
        const isArbitrum = chainId === '42161' || chainId === 42161 || chainId === '421614' || chainId === 421614;
        if (!isArbitrum) {
            setTokenBalance(null);
            return;
        }

        setLoadingBalance(true);
        try {
            const balance = await getTokenBalance(token, account, provider, chainId);
            setTokenBalance(balance);
        } catch (err) {
            console.error('Error fetching token balance:', err);
            setTokenBalance(null);
        } finally {
            setLoadingBalance(false);
        }
    };

    // Fetch Hyperliquid balance (perp balance) directly from Hyperliquid API
    const fetchHyperliquidBalance = async () => {
        if (!account || !chainId) {
            setHyperliquidBalance(null);
            return;
        }

        setLoadingHyperliquidBalance(true);
        try {
            // Fetch balance directly from Hyperliquid info endpoint
            const balance = await getUserPerpBalance(account, chainId);
            console.log('Fetched Hyperliquid balance:', balance);
            // Always set balance, even if it's 0 or has a message
            setHyperliquidBalance(balance || {
                account_address: account,
                total_collateral: 0,
                total_margin_used: 0,
                message: 'Unable to fetch balance'
            });
        } catch (err) {
            console.error('Error fetching Hyperliquid balance:', err);
            // Set a default balance object so the UI still shows
            setHyperliquidBalance({
                account_address: account,
                total_collateral: 0,
                total_margin_used: 0,
                message: `Error: ${err.message || 'Failed to fetch balance'}`
            });
        } finally {
            setLoadingHyperliquidBalance(false);
        }
    };

    // Fetch balance when account, provider, chainId, or token changes
    useEffect(() => {
        fetchTokenBalance();
        fetchHyperliquidBalance();
        if (account && provider && chainId) {
            const interval = setInterval(() => {
                fetchTokenBalance();
                fetchHyperliquidBalance();
            }, 10000); // Refresh every 10 seconds
            return () => clearInterval(interval);
        }
    }, [account, provider, chainId, token]);

    const handleWithdraw = async (e) => {
        e.preventDefault();

        if (!account || !signer) {
            setError('Please connect your MetaMask wallet first');
            return;
        }

        if (!amount || parseFloat(amount) <= 0) {
            setError('Please enter a valid amount');
            return;
        }

        // Check if user has sufficient balance
        if (hyperliquidBalance) {
            const usdcBalance = parseFloat(hyperliquidBalance.usdc_balance || hyperliquidBalance.account_value || 0);
            const available = usdcBalance - parseFloat(hyperliquidBalance.total_margin_used || 0);
            if (parseFloat(amount) > available) {
                setError(`Insufficient balance. Available: $${available.toFixed(2)}`);
                return;
            }
        }

        setLoading(true);
        setError(null);
        setSuccess(false);

        try {
            // Withdraw directly from Hyperliquid using MetaMask signing
            let result;
            if (token === 'USDC') {
                result = await withdrawUSDC(signer, amount, account, chainId);
            } else if (token === 'USDT') {
                result = await withdrawUSDT(signer, amount, account, chainId);
            } else {
                throw new Error(`Unsupported token: ${token}`);
            }

            console.log('Withdrawal successful:', result);
            setSuccess(true);
            setAmount('');

            // Refresh balances after withdrawal
            setTimeout(() => {
                fetchTokenBalance();
                fetchHyperliquidBalance();
            }, 2000);

            // Show success message
            alert(`Withdrawal successful: ${amount} ${token}\n\nThe funds will be available on Arbitrum shortly.`);
        } catch (err) {
            setError(err.message || 'Failed to process withdrawal');
            console.error('Withdrawal error:', err);
        } finally {
            setLoading(false);
        }
    };

    if (!account) {
        return (
            <div className="bg-white rounded-lg shadow-lg p-6 text-center">
                <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">Please connect your wallet to withdraw</p>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="flex items-center gap-3 mb-6">
                <ArrowDownCircle className="w-6 h-6 text-primary-600" />
                <h2 className="text-2xl font-bold text-gray-900">Withdraw</h2>
            </div>

            {/* Hyperliquid Perp Balance Display */}
            <div className="mb-4 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-purple-900">
                            {token} Balance on Hyperliquid:
                        </span>
                        {loadingHyperliquidBalance ? (
                            <RefreshCw className="w-4 h-4 text-purple-600 animate-spin" />
                        ) : hyperliquidBalance ? (
                            <span className="text-sm font-bold text-purple-700">
                                ${parseFloat(hyperliquidBalance.usdc_balance || hyperliquidBalance.account_value || 0).toFixed(2)} {token}
                            </span>
                        ) : (
                            <span className="text-sm text-purple-600">Loading...</span>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        {hyperliquidBalance && (
                            <span className="text-xs text-purple-600">
                                Available: ${(parseFloat(hyperliquidBalance.usdc_balance || hyperliquidBalance.account_value || 0) - parseFloat(hyperliquidBalance.total_margin_used || 0)).toFixed(2)}
                            </span>
                        )}
                        <button
                            onClick={fetchHyperliquidBalance}
                            disabled={loadingHyperliquidBalance}
                            className="text-purple-600 hover:text-purple-800 transition"
                            title="Refresh balance"
                        >
                            <RefreshCw className={`w-4 h-4 ${loadingHyperliquidBalance ? 'animate-spin' : ''}`} />
                        </button>
                    </div>
                </div>
                {hyperliquidBalance?.message && (
                    <div className="mt-2 text-xs text-purple-600">
                        {hyperliquidBalance.message}
                    </div>
                )}
            </div>

            {/* Token Balance Display on Arbitrum */}
            {tokenBalance && (chainId === '42161' || chainId === 42161 || chainId === '421614' || chainId === 421614) && (
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-blue-900">
                                {token} Balance on Arbitrum:
                            </span>
                            {loadingBalance ? (
                                <RefreshCw className="w-4 h-4 text-blue-600 animate-spin" />
                            ) : (
                                <span className="text-sm font-bold text-blue-700">
                                    {tokenBalance.formatted} {tokenBalance.symbol}
                                </span>
                            )}
                        </div>
                        <button
                            onClick={fetchTokenBalance}
                            disabled={loadingBalance}
                            className="text-blue-600 hover:text-blue-800 transition"
                            title="Refresh balance"
                        >
                            <RefreshCw className={`w-4 h-4 ${loadingBalance ? 'animate-spin' : ''}`} />
                        </button>
                    </div>
                </div>
            )}

            <form onSubmit={handleWithdraw} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Token
                    </label>
                    <select
                        value={token}
                        onChange={(e) => setToken(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    >
                        <option value="USDC">USDC</option>
                        <option value="USDT">USDT</option>
                    </select>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Amount
                    </label>
                    <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="0.00"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        required
                    />
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
                        <span className="text-sm">Withdrawal initiated successfully!</span>
                    </div>
                )}

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full px-6 py-3 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {loading ? 'Processing...' : 'Withdraw'}
                </button>
            </form>

            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-xs text-blue-700">
                    <strong>Note:</strong> Withdrawal requires MetaMask transaction confirmation.
                    Make sure you have sufficient balance and gas fees.
                </p>
            </div>
        </div>
    );
};

export default Withdraw;

