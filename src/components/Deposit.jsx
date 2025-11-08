import { useState, useEffect } from 'react';
import { useWallet } from '../hooks/useWallet';
import { getTokenBalance } from '../utils/token-balance';
import { depositWithApproval, getAllowance } from '../utils/deposit';
import { ArrowUpCircle, AlertCircle, CheckCircle, RefreshCw } from 'lucide-react';

const Deposit = () => {
    const { account, signer, chainId, isConnected, provider } = useWallet();
    const [amount, setAmount] = useState('');
    const [token, setToken] = useState('USDC');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
    const [tokenBalance, setTokenBalance] = useState(null);
    const [loadingBalance, setLoadingBalance] = useState(false);
    const [allowance, setAllowance] = useState(null);
    const [loadingAllowance, setLoadingAllowance] = useState(false);
    const [step, setStep] = useState(null); // 'approving' or 'depositing'

    // Fetch allowance for bridge
    const fetchAllowance = async () => {
        if (!account || !signer || !chainId) {
            setAllowance(null);
            return;
        }

        // Only fetch if on Arbitrum network
        const isArbitrum = chainId === '42161' || chainId === 42161 || chainId === '421614' || chainId === 421614;
        if (!isArbitrum) {
            setAllowance(null);
            return;
        }

        setLoadingAllowance(true);
        try {
            const currentAllowance = await getAllowance(signer, token);
            setAllowance(currentAllowance);
        } catch (err) {
            console.error('Error fetching allowance:', err);
            setAllowance('0');
        } finally {
            setLoadingAllowance(false);
        }
    };

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

    // Fetch balance and allowance when account, provider, chainId, or token changes
    useEffect(() => {
        fetchTokenBalance();
        fetchAllowance();
        if (account && provider && chainId) {
            const interval = setInterval(() => {
                fetchTokenBalance();
                fetchAllowance();
            }, 10000); // Refresh every 10 seconds
            return () => clearInterval(interval);
        }
    }, [account, provider, chainId, token]);

    const handleDeposit = async (e) => {
        e.preventDefault();

        if (!account || !signer || !chainId) {
            setError('Please connect your MetaMask wallet first');
            return;
        }

        // Check if on Arbitrum network
        const isArbitrum = chainId === '42161' || chainId === 42161 || chainId === '421614' || chainId === 421614;
        if (!isArbitrum) {
            setError('Please switch to Arbitrum network to deposit');
            return;
        }

        if (!amount || parseFloat(amount) <= 0) {
            setError('Please enter a valid amount');
            return;
        }

        // Check wallet balance
        if (tokenBalance && parseFloat(amount) > parseFloat(tokenBalance.formatted)) {
            setError(`Insufficient ${token} balance in wallet`);
            return;
        }

        setLoading(true);
        setError(null);
        setSuccess(false);
        setStep(null);

        try {
            // Check if approval is needed
            const currentAllowance = allowance || await getAllowance(signer, token);
            const { ethers } = await import('ethers');
            const amountInUnits = ethers.parseUnits(amount.toString(), 6); // USDC/USDT have 6 decimals

            if (BigInt(currentAllowance) < BigInt(amountInUnits.toString())) {
                setStep('approving');
                setSuccessMessage('Step 1/2: Approving token for bridge...');
            } else {
                setStep('depositing');
                setSuccessMessage('Depositing to Hyperliquid...');
            }

            // Deposit with automatic approval if needed
            const result = await depositWithApproval(signer, parseFloat(amount), token);

            if (result.status === 'ok') {
                const txHash = result.response?.txHash;
                setSuccessMessage(`Successfully deposited ${amount} ${token}!`);
                setSuccess(true);
                setAmount('');
                setStep(null);

                // Refresh balances after delays
                setTimeout(() => {
                    fetchTokenBalance();
                    fetchAllowance();
                }, 2000);

                // Show success message with transaction hash
                alert(`Deposit successful: ${amount} ${token}\n\nTransaction: ${txHash}\n\nYour ${token} should appear on Hyperliquid in ~30 seconds.`);
            } else {
                setError(result.response || 'Deposit failed');
            }
        } catch (err) {
            setError(err.message || 'Failed to process deposit');
            console.error('Deposit error:', err);
            setStep(null);
        } finally {
            setLoading(false);
            setTimeout(() => {
                setSuccess(false);
                setSuccessMessage('');
            }, 10000);
        }
    };

    if (!account) {
        return (
            <div className="bg-white rounded-lg shadow-lg p-6 text-center">
                <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">Please connect your wallet to deposit</p>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="flex items-center gap-3 mb-6">
                <ArrowUpCircle className="w-6 h-6 text-primary-600" />
                <h2 className="text-2xl font-bold text-gray-900">Deposit</h2>
            </div>

            {/* Network Check */}
            {chainId && chainId !== '42161' && chainId !== 42161 && chainId !== '421614' && chainId !== 421614 && (
                <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <div className="flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
                        <div className="flex-1">
                            <p className="font-medium text-yellow-900 mb-2">Wrong Network</p>
                            <p className="text-sm text-yellow-700">
                                Please switch to Arbitrum network to make deposits.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Token Balance Display */}
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

            <form onSubmit={handleDeposit} className="space-y-4">
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

                {step && (
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-2 text-blue-600">
                        <RefreshCw className="w-5 h-5 animate-spin" />
                        <span className="text-sm">{successMessage || (step === 'approving' ? 'Approving token...' : 'Depositing...')}</span>
                    </div>
                )}

                {success && successMessage && !step && (
                    <div className="p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-600">
                        <CheckCircle className="w-5 h-5" />
                        <span className="text-sm">{successMessage}</span>
                    </div>
                )}

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full px-6 py-3 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {loading ? 'Processing...' : 'Deposit'}
                </button>
            </form>

            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-xs text-blue-700">
                    <strong>Note:</strong> Deposit is a direct {token} transfer to the Hyperliquid bridge contract.
                    The bridge will automatically credit your Hyperliquid account in ~30 seconds after the transaction is confirmed.
                    Make sure you have sufficient {token} balance and ETH for gas fees.
                </p>
            </div>
        </div>
    );
};

export default Deposit;

