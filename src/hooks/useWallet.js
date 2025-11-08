import { useState, useEffect, useCallback } from 'react';
import {
    connectWallet,
    getCurrentAccount,
    onAccountsChanged,
    onChainChanged,
    isMetaMaskInstalled
} from '../utils/wallet';

export const useWallet = () => {
    const [account, setAccount] = useState(null);
    const [signer, setSigner] = useState(null);
    const [provider, setProvider] = useState(null);
    const [chainId, setChainId] = useState(null);
    const [isConnecting, setIsConnecting] = useState(false);
    const [error, setError] = useState(null);

    // Check for existing connection on mount
    useEffect(() => {
        const checkConnection = async () => {
            try {
                const wallet = await getCurrentAccount();
                if (wallet) {
                    setAccount(wallet.address);
                    setSigner(wallet.signer);
                    setProvider(wallet.provider);
                    const network = await wallet.provider.getNetwork();
                    setChainId(network.chainId.toString());
                }
            } catch (err) {
                console.error('Error checking wallet connection:', err);
            }
        };

        checkConnection();
    }, []);

    // Listen for account changes
    useEffect(() => {
        const handleAccountsChanged = async (accounts) => {
            if (accounts.length === 0) {
                setAccount(null);
                setSigner(null);
                setProvider(null);
                setChainId(null);
            } else {
                try {
                    const wallet = await getCurrentAccount();
                    if (wallet) {
                        setAccount(wallet.address);
                        setSigner(wallet.signer);
                        setProvider(wallet.provider);
                        const network = await wallet.provider.getNetwork();
                        setChainId(network.chainId.toString());
                    }
                } catch (err) {
                    console.error('Error handling account change:', err);
                }
            }
        };

        const cleanupAccounts = onAccountsChanged(handleAccountsChanged);
        return cleanupAccounts;
    }, []);

    // Listen for chain changes
    useEffect(() => {
        const handleChainChanged = async (chainIdHex) => {
            const newChainId = parseInt(chainIdHex, 16).toString();
            setChainId(newChainId);
            // Reload page on chain change (MetaMask recommendation)
            window.location.reload();
        };

        const cleanupChain = onChainChanged(handleChainChanged);
        return cleanupChain;
    }, []);

    const connect = useCallback(async () => {
        if (!isMetaMaskInstalled()) {
            setError('MetaMask is not installed. Please install MetaMask to continue.');
            return;
        }

        setIsConnecting(true);
        setError(null);

        try {
            const wallet = await connectWallet();
            setAccount(wallet.address);
            setSigner(wallet.signer);
            setProvider(wallet.provider);
            setChainId(wallet.network);
        } catch (err) {
            setError(err.message || 'Failed to connect wallet');
            console.error('Wallet connection error:', err);
        } finally {
            setIsConnecting(false);
        }
    }, []);

    const disconnect = useCallback(() => {
        setAccount(null);
        setSigner(null);
        setProvider(null);
        setChainId(null);
        setError(null);
    }, []);

    return {
        account,
        signer,
        provider,
        chainId,
        isConnected: !!account,
        isConnecting,
        error,
        connect,
        disconnect,
        isMetaMaskInstalled: isMetaMaskInstalled()
    };
};

