import { useWallet } from '../hooks/useWallet';
import { formatAddress, getNetworkName } from '../utils/wallet';
import { Wallet, LogOut, AlertCircle } from 'lucide-react';

const WalletConnect = () => {
    const { account, chainId, isConnected, isConnecting, error, connect, disconnect, isMetaMaskInstalled } = useWallet();

    if (!isMetaMaskInstalled) {
        return (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-yellow-600" />
                <div>
                    <p className="text-sm font-medium text-yellow-800">MetaMask not installed</p>
                    <p className="text-xs text-yellow-600">Please install MetaMask to connect your wallet</p>
                </div>
                <a
                    href="https://metamask.io/download/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-auto px-4 py-2 bg-yellow-600 text-white rounded-lg text-sm font-medium hover:bg-yellow-700 transition"
                >
                    Install MetaMask
                </a>
            </div>
        );
    }

    if (isConnected) {
        return (
            <div className="bg-white rounded-lg shadow-lg p-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                            <Wallet className="w-5 h-5 text-green-600" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-gray-900">{formatAddress(account)}</p>
                            <p className="text-xs text-gray-500">{chainId ? getNetworkName(chainId) : 'Unknown Network'}</p>
                        </div>
                    </div>
                    <button
                        onClick={disconnect}
                        className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition text-sm font-medium"
                    >
                        <LogOut className="w-4 h-4" />
                        Disconnect
                    </button>
                </div>
                {error && (
                    <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-600">
                        {error}
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="bg-white rounded-lg shadow-lg p-6 text-center">
            <Wallet className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Connect Your Wallet</h3>
            <p className="text-sm text-gray-600 mb-4">Connect your MetaMask wallet to view your trading data</p>
            <button
                onClick={connect}
                disabled={isConnecting}
                className="w-full px-6 py-3 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {isConnecting ? 'Connecting...' : 'Connect MetaMask'}
            </button>
            {error && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-600">
                    {error}
                </div>
            )}
        </div>
    );
};

export default WalletConnect;

