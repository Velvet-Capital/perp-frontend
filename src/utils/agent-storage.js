/**
 * Utility functions for managing agent credentials in local storage
 */

const AGENT_STORAGE_KEY = 'hyperliquid_agent';

/**
 * Save agent credentials to local storage
 * @param {string} userAddress - User's MetaMask address
 * @param {string} agentAddress - Agent address
 * @param {string} agentPrivateKey - Agent private key
 * @param {string} agentName - Optional agent name
 */
export const saveAgent = (userAddress, agentAddress, agentPrivateKey, agentName = null) => {
    try {
        const agentData = {
            user_address: userAddress,
            agent_address: agentAddress,
            agent_private_key: agentPrivateKey,
            agent_name: agentName,
            created_at: new Date().toISOString()
        };

        localStorage.setItem(AGENT_STORAGE_KEY, JSON.stringify(agentData));
        console.log('Agent saved to local storage:', {
            user_address: userAddress,
            agent_address: agentAddress,
            agent_name: agentName
        });
        return true;
    } catch (error) {
        console.error('Error saving agent to local storage:', error);
        return false;
    }
};

/**
 * Get agent credentials from local storage
 * @param {string} userAddress - User's MetaMask address (optional, for validation)
 * @returns {Object|null} Agent data or null if not found
 */
export const getAgent = (userAddress = null) => {
    try {
        const stored = localStorage.getItem(AGENT_STORAGE_KEY);
        if (!stored) {
            return null;
        }

        const agentData = JSON.parse(stored);

        // If userAddress is provided, validate it matches
        if (userAddress && agentData.user_address?.toLowerCase() !== userAddress.toLowerCase()) {
            console.warn('Stored agent does not match current user address');
            return null;
        }

        return agentData;
    } catch (error) {
        console.error('Error reading agent from local storage:', error);
        return null;
    }
};

/**
 * Check if agent exists in local storage
 * @param {string} userAddress - User's MetaMask address (optional)
 * @returns {boolean} True if agent exists
 */
export const hasAgent = (userAddress = null) => {
    const agent = getAgent(userAddress);
    return agent !== null;
};

/**
 * Remove agent from local storage
 */
export const removeAgent = () => {
    try {
        localStorage.removeItem(AGENT_STORAGE_KEY);
        console.log('Agent removed from local storage');
        return true;
    } catch (error) {
        console.error('Error removing agent from local storage:', error);
        return false;
    }
};

/**
 * Get agent address from local storage
 * @param {string} userAddress - User's MetaMask address (optional)
 * @returns {string|null} Agent address or null
 */
export const getAgentAddress = (userAddress = null) => {
    const agent = getAgent(userAddress);
    return agent?.agent_address || null;
};

/**
 * Get agent private key from local storage
 * @param {string} userAddress - User's MetaMask address (optional)
 * @returns {string|null} Agent private key or null
 */
export const getAgentPrivateKey = (userAddress = null) => {
    const agent = getAgent(userAddress);
    return agent?.agent_private_key || null;
};

