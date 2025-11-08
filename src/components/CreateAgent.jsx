import { useState } from 'react';
import { useWallet } from '../hooks/useWallet';
import { saveAgent } from '../utils/agent-storage';
import { createAgentOnFrontend } from '../utils/agent-creation';
import { UserPlus, CheckCircle, AlertCircle, Loader } from 'lucide-react';

const CreateAgent = () => {
    const { account, signer, isConnected, chainId } = useWallet();
    const [agentName, setAgentName] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(false);
    const [agentInfo, setAgentInfo] = useState(null);

    const handleCreateAgent = async (e) => {
        e.preventDefault();

        if (!account || !isConnected) {
            setError('Please connect your MetaMask wallet first');
            return;
        }

        if (!signer) {
            setError('Signer not available. Please ensure MetaMask is connected.');
            return;
        }

        if (!chainId) {
            setError('Chain ID not available. Please ensure your wallet is connected to a network.');
            return;
        }

        setLoading(true);
        setError(null);
        setSuccess(false);
        setAgentInfo(null);

        try {
            console.log('Creating agent on frontend with MetaMask wallet:', {
                user: account,
                chainId,
                agentName: agentName || null
            });

            // Create agent on frontend using MetaMask wallet
            const result = await createAgentOnFrontend(
                signer,
                account,
                chainId,
                agentName || null
            );

            if (result.status === 'success') {
                // Save agent to local storage
                const saved = saveAgent(
                    result.user_address,
                    result.agent_address,
                    result.agent_private_key,
                    result.agent_name
                );

                if (saved) {
                    setSuccess(true);
                    setAgentInfo({
                        address: result.agent_address,
                        name: result.agent_name,
                        user_address: result.user_address
                    });
                    setAgentName(''); // Clear form
                    console.log('Agent created and saved to local storage:', result.agent_address);
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
            setLoading(false);
        }
    };

    if (!isConnected || !account) {
        return (
            <div className="bg-white rounded-lg shadow-lg p-6 text-center">
                <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">Please connect your MetaMask wallet to create an agent</p>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="flex items-center gap-3 mb-6">
                <UserPlus className="w-6 h-6 text-primary-600" />
                <h2 className="text-2xl font-bold text-gray-900">Create Agent</h2>
            </div>

            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-700">
                    <strong>What is an Agent?</strong> An agent is a sub-account that can be used for deposits and trading.
                    The agent will be created and stored locally in your browser.
                </p>
            </div>

            {success && agentInfo && (
                <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-start gap-3">
                        <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                        <div className="flex-1">
                            <p className="font-medium text-green-900 mb-2">Agent Created Successfully!</p>
                            <div className="text-sm text-green-700 space-y-1">
                                <p><strong>Agent Address:</strong> {agentInfo.address}</p>
                                {agentInfo.name && <p><strong>Name:</strong> {agentInfo.name}</p>}
                                <p><strong>User:</strong> {agentInfo.user_address}</p>
                            </div>
                            <p className="text-xs text-green-600 mt-2">
                                Agent credentials have been saved to local storage and will be used for deposits.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            <form onSubmit={handleCreateAgent} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Agent Name (Optional)
                    </label>
                    <input
                        type="text"
                        value={agentName}
                        onChange={(e) => setAgentName(e.target.value)}
                        placeholder="My Trading Agent"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                        Give your agent a name to identify it (optional)
                    </p>
                </div>

                {error && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-600">
                        <AlertCircle className="w-5 h-5" />
                        <span className="text-sm">{error}</span>
                    </div>
                )}

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full px-6 py-3 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                    {loading ? (
                        <>
                            <Loader className="w-5 h-5 animate-spin" />
                            <span>Creating Agent...</span>
                        </>
                    ) : (
                        <>
                            <UserPlus className="w-5 h-5" />
                            <span>Create Agent</span>
                        </>
                    )}
                </button>
            </form>

            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-xs text-yellow-700">
                    <strong>Security Note:</strong> You will be asked to sign a message with MetaMask to authorize agent creation.
                    The agent private key will be stored in your browser's local storage. Keep your browser secure.
                </p>
            </div>
        </div>
    );
};

export default CreateAgent;

