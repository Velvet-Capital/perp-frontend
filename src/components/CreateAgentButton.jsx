import { useState, useEffect } from 'react';
import { useWallet } from '../hooks/useWallet';
import { getAgent, saveAgent } from '../utils/agent-storage';
import { createAgentOnFrontend } from '../utils/agent-creation';
import { UserPlus, CheckCircle, AlertCircle, Loader, X } from 'lucide-react';

/**
 * Reusable Create Agent Button Component
 * Can be used anywhere in the app to create and set an agent
 */
const CreateAgentButton = ({ onAgentCreated, showInline = false, className = '' }) => {
    const { account, signer, chainId, isConnected } = useWallet();
    const [showForm, setShowForm] = useState(false);
    const [creatingAgent, setCreatingAgent] = useState(false);
    const [agentName, setAgentName] = useState('');
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(false);
    const [agentInfo, setAgentInfo] = useState(null);

    // Check if agent already exists
    useEffect(() => {
        if (account) {
            const agent = getAgent(account);
            if (agent) {
                setAgentInfo({
                    address: agent.agent_address,
                    name: agent.agent_name
                });
            } else {
                setAgentInfo(null);
            }
        }
    }, [account]);

    const handleCreateAgent = async (e) => {
        if (e) e.preventDefault();

        if (!account || !isConnected || !signer || !chainId) {
            setError('Please connect your MetaMask wallet first');
            return;
        }

        setCreatingAgent(true);
        setError(null);
        setSuccess(false);

        try {
            const result = await createAgentOnFrontend(
                signer,
                account,
                chainId,
                agentName || null
            );

            if (result.status === 'success') {
                const saved = saveAgent(
                    result.user_address,
                    result.agent_address,
                    result.agent_private_key,
                    result.agent_name
                );

                if (saved) {
                    setAgentName('');
                    setShowForm(false);
                    setSuccess(true);
                    setAgentInfo({
                        address: result.agent_address,
                        name: result.agent_name
                    });

                    // Call callback if provided
                    if (onAgentCreated) {
                        onAgentCreated(result);
                    }

                    // Auto-hide success message
                    setTimeout(() => {
                        setSuccess(false);
                    }, 5000);
                } else {
                    throw new Error('Failed to save agent to local storage');
                }
            } else {
                throw new Error(result.message || 'Failed to create agent');
            }
        } catch (err) {
            setError(err.message || 'Failed to create agent');
            console.error('Error creating agent:', err);
        } finally {
            setCreatingAgent(false);
        }
    };

    // If not connected, don't show anything
    if (!isConnected || !account) {
        return null;
    }

    // If agent exists and not inline, show status with button
    if (agentInfo && !showInline) {
        return (
            <div className={`relative flex items-center gap-3 ${className}`}>
                <div className="flex items-center gap-2 text-sm text-green-700">
                    <CheckCircle className="w-4 h-4" />
                    <span>
                        Agent: {agentInfo.address.slice(0, 6)}...{agentInfo.address.slice(-4)}
                        {agentInfo.name && ` (${agentInfo.name})`}
                    </span>
                </div>
                {!showForm ? (
                    <button
                        onClick={() => setShowForm(true)}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-primary-600 text-white rounded text-xs font-medium hover:bg-primary-700 transition"
                    >
                        <UserPlus className="w-3 h-3" />
                        New
                    </button>
                ) : (
                    <div className="absolute right-0 top-full mt-2 p-4 bg-blue-50 border border-blue-200 rounded-lg shadow-lg z-50 min-w-[300px]">
                        <div className="flex items-start justify-between mb-3">
                            <div>
                                <h3 className="font-medium text-blue-900 mb-1 text-sm">Create New Agent</h3>
                                <p className="text-xs text-blue-700">
                                    Create an additional agent for deposits and trading.
                                </p>
                            </div>
                            <button
                                onClick={() => {
                                    setShowForm(false);
                                    setAgentName('');
                                    setError(null);
                                }}
                                className="text-blue-600 hover:text-blue-800"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <form onSubmit={handleCreateAgent} className="space-y-2">
                            <input
                                type="text"
                                value={agentName}
                                onChange={(e) => setAgentName(e.target.value)}
                                placeholder="Agent Name (Optional)"
                                className="w-full px-2 py-1.5 border border-blue-300 rounded text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                            />
                            {error && (
                                <div className="p-1.5 bg-red-50 border border-red-200 rounded text-xs text-red-600">
                                    {error}
                                </div>
                            )}
                            {success && (
                                <div className="p-1.5 bg-green-50 border border-green-200 rounded text-xs text-green-600">
                                    Agent created successfully!
                                </div>
                            )}
                            <button
                                type="submit"
                                disabled={creatingAgent}
                                className="w-full px-3 py-1.5 bg-primary-600 text-white rounded text-xs font-medium hover:bg-primary-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1"
                            >
                                {creatingAgent ? (
                                    <>
                                        <Loader className="w-3 h-3 animate-spin" />
                                        <span>Creating...</span>
                                    </>
                                ) : (
                                    <>
                                        <UserPlus className="w-3 h-3" />
                                        <span>Create Agent</span>
                                    </>
                                )}
                            </button>
                        </form>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className={`relative ${className}`}>
            {!showForm ? (
                <button
                    onClick={() => setShowForm(true)}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition"
                >
                    <UserPlus className="w-4 h-4" />
                    {agentInfo ? 'Create New Agent' : 'Create Agent'}
                </button>
            ) : (
                <div className={`p-4 bg-blue-50 border border-blue-200 rounded-lg ${showInline ? '' : 'min-w-[300px]'}`}>
                    <div className="flex items-start justify-between mb-3">
                        <div>
                            <h3 className="font-medium text-blue-900 mb-1">Create New Agent</h3>
                            <p className="text-sm text-blue-700">
                                Create an agent to enable deposits and trading operations.
                            </p>
                        </div>
                        <button
                            onClick={() => {
                                setShowForm(false);
                                setAgentName('');
                                setError(null);
                            }}
                            className="text-blue-600 hover:text-blue-800"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                    <form onSubmit={handleCreateAgent} className="space-y-3">
                        <div>
                            <input
                                type="text"
                                value={agentName}
                                onChange={(e) => setAgentName(e.target.value)}
                                placeholder="Agent Name (Optional)"
                                className="w-full px-3 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
                            />
                        </div>
                        {error && (
                            <div className="p-2 bg-red-50 border border-red-200 rounded text-sm text-red-600">
                                {error}
                            </div>
                        )}
                        {success && (
                            <div className="p-2 bg-green-50 border border-green-200 rounded text-sm text-green-600">
                                Agent created and set successfully!
                            </div>
                        )}
                        <button
                            type="submit"
                            disabled={creatingAgent}
                            className="w-full px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {creatingAgent ? (
                                <>
                                    <Loader className="w-4 h-4 animate-spin" />
                                    <span>Creating Agent...</span>
                                </>
                            ) : (
                                <>
                                    <UserPlus className="w-4 h-4" />
                                    <span>Create & Set Agent</span>
                                </>
                            )}
                        </button>
                    </form>
                </div>
            )}
        </div>
    );
};

export default CreateAgentButton;

