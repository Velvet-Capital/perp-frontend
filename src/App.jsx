import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import Orders from './components/Orders';
import PlaceOrder from './components/PlaceOrder';
import Positions from './components/Positions';
import Balance from './components/Balance';
import Withdraw from './components/Withdraw';
import Deposit from './components/Deposit';
import CreateAgent from './components/CreateAgent';
import CreateAgentButton from './components/CreateAgentButton';
import MarketPrices from './components/MarketPrices';
import { useWallet } from './hooks/useWallet';
import { Wallet, ShoppingCart, TrendingUp, DollarSign, ArrowDownCircle, ArrowUpCircle, Plus, UserPlus } from 'lucide-react';

const Navigation = () => {
    const location = useLocation();
    const { isConnected } = useWallet();

    const navItems = [
        { path: '/', label: 'Balance', icon: DollarSign },
        { path: '/place-order', label: 'Place Order', icon: Plus },
        { path: '/orders', label: 'Orders', icon: ShoppingCart },
        { path: '/positions', label: 'Positions', icon: TrendingUp },
        { path: '/deposit', label: 'Deposit', icon: ArrowUpCircle },
        { path: '/withdraw', label: 'Withdraw', icon: ArrowDownCircle },
        { path: '/create-agent', label: 'Create Agent', icon: UserPlus },
    ];

    return (
        <nav className="bg-white shadow-lg rounded-lg p-4 mb-6">
            <div className="flex flex-wrap items-center gap-2">
                {navItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = location.pathname === item.path;
                    return (
                        <Link
                            key={item.path}
                            to={item.path}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition ${isActive
                                ? 'bg-primary-600 text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                        >
                            <Icon className="w-4 h-4" />
                            <span className="font-medium">{item.label}</span>
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
};

const App = () => {
    const { account, isConnected, connect, isConnecting, error: walletError } = useWallet();

    return (
        <Router>
            <div className="min-h-screen bg-gradient-to-br from-purple-600 via-blue-600 to-indigo-700">
                <div className="container mx-auto px-4 py-8">
                    <div className="mb-8 text-center">
                        <h1 className="text-4xl font-bold text-white mb-2">Hyperliquid Trading Dashboard</h1>
                        <p className="text-blue-100">Manage your perpetual trading positions</p>
                    </div>

                    {isConnected && account && (
                        <div className="mb-6 bg-white rounded-lg shadow-lg p-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                                        <Wallet className="w-5 h-5 text-green-600" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-gray-900">
                                            {account.slice(0, 6)}...{account.slice(-4)}
                                        </p>
                                        <p className="text-xs text-gray-500">Connected via MetaMask</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <CreateAgentButton />
                                </div>
                            </div>
                        </div>
                    )}

                    {isConnected && (
                        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                            {/* Perpetual Market Prices Sidebar - Left */}
                            <div className="lg:col-span-1">
                                <div className="sticky top-4">
                                    <MarketPrices />
                                </div>
                            </div>

                            {/* Main Content - Right */}
                            <div className="lg:col-span-3">
                                <Navigation />
                                <Routes>
                                    <Route path="/" element={<Balance />} />
                                    <Route path="/place-order" element={<PlaceOrder />} />
                                    <Route path="/orders" element={<Orders />} />
                                    <Route path="/positions" element={<Positions />} />
                                    <Route path="/deposit" element={<Deposit />} />
                                    <Route path="/withdraw" element={<Withdraw />} />
                                    <Route path="/create-agent" element={<CreateAgent />} />
                                </Routes>
                            </div>
                        </div>
                    )}

                    {!isConnected && (
                        <div className="bg-white rounded-lg shadow-lg p-8 text-center">
                            <Wallet className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                            <h2 className="text-2xl font-bold text-gray-900 mb-2">Welcome to Hyperliquid Trading</h2>
                            <p className="text-gray-600 mb-4">
                                Please connect your MetaMask wallet to get started.
                            </p>
                            {walletError && (
                                <p className="text-red-600 text-sm mb-4">{walletError}</p>
                            )}
                            <button
                                onClick={connect}
                                disabled={isConnecting}
                                className="px-6 py-3 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isConnecting ? 'Connecting...' : 'Connect MetaMask'}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </Router>
    );
};

export default App;

