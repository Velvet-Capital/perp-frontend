import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://hyperliquid-demo.velvetdao.xyz';

const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Helper function to extract error message from axios error
export const getErrorMessage = (error) => {
    if (error.response?.data) {
        const data = error.response.data;
        // Check for message field
        if (data.message) {
            return data.message;
        }
        // Check for hyperliquid_errors array
        if (data.hyperliquid_errors && Array.isArray(data.hyperliquid_errors) && data.hyperliquid_errors.length > 0) {
            return data.hyperliquid_errors[0];
        }
        // Check for error field
        if (data.error) {
            return typeof data.error === 'string' ? data.error : JSON.stringify(data.error);
        }
    }
    return error.message || 'An unexpected error occurred';
};

// Add response interceptor to log status for every API call
api.interceptors.response.use(
    (response) => {
        // Log successful responses
        console.log(`[API Response] ${response.config.method?.toUpperCase()} ${response.config.url} - Status: ${response.status}`);
        return response;
    },
    (error) => {
        // Extract error message from response
        const errorMessage = getErrorMessage(error);

        // Log error responses with detailed information
        if (error.response) {
            console.log(`[API Error] ${error.config?.method?.toUpperCase()} ${error.config?.url} - Status: ${error.response.status}`);
            console.log(`[API Error] Message: ${errorMessage}`);
            if (error.response.data) {
                console.log(`[API Error] Response Data:`, error.response.data);
            }
            // Enhance error object with extracted message
            error.userMessage = errorMessage;
        } else if (error.request) {
            console.log(`[API Error] ${error.config?.method?.toUpperCase()} ${error.config?.url} - No response received`);
        } else {
            console.log(`[API Error] ${error.config?.method?.toUpperCase()} ${error.config?.url} - Error: ${error.message}`);
        }
        return Promise.reject(error);
    }
);

// Health check
export const healthCheck = async () => {
    const response = await api.get('/health');
    return response.data;
};

// Account endpoints - now accept user_address parameter
export const getAccountInfo = async (userAddress) => {
    const response = await api.get('/account/info', {
        params: { user_address: userAddress }
    });
    return response.data;
};

export const getPositions = async (userAddress) => {
    const response = await api.get('/account/positions', {
        params: { user_address: userAddress }
    });
    return response.data;
};

export const getBalance = async (userAddress) => {
    const response = await api.get('/account/balance', {
        params: { user_address: userAddress }
    });
    return response.data;
};

// Market endpoints
export const getMarketMeta = async () => {
    const response = await api.get('/market/meta');
    return response.data;
};

export const getAssetIndex = async (coin) => {
    const response = await api.get(`/market/asset-index/${coin}`);
    return response.data;
};

export const getAllMids = async () => {
    const response = await api.get('/market/all-mids');
    return response.data;
};

export const getTicker = async (coin) => {
    const response = await api.get(`/market/ticker/${coin}`);
    return response.data;
};

// Order endpoints - now accept user credentials
export const getOpenOrders = async (userAddress) => {
    const response = await api.get('/orders/open', {
        params: { user_address: userAddress }
    });
    return response.data;
};

export const placeOrder = async (orderData, agentAddress, agentPrivateKey) => {
    // Log what we're sending to backend
    console.log('='.repeat(60));
    console.log('SENDING TO BACKEND /orders/place:');
    console.log('='.repeat(60));
    console.log('Order Data:', JSON.stringify(orderData, null, 2));
    console.log('Agent Address:', agentAddress);
    console.log('='.repeat(60));

    // Send order data with agent credentials
    const response = await api.post('/orders/place', {
        ...orderData,
        agent_address: agentAddress,
        agent_private_key: agentPrivateKey
    });

    // Log backend response
    console.log('='.repeat(60));
    console.log('BACKEND RESPONSE:');
    console.log('='.repeat(60));
    console.log('Response:', JSON.stringify(response.data, null, 2));
    console.log('='.repeat(60));

    return response.data;
};

export const cancelOrder = async (cancelData, signedCancelData) => {
    // Log what we're sending to backend
    console.log('='.repeat(60));
    console.log('SENDING TO BACKEND /orders/cancel:');
    console.log('='.repeat(60));
    console.log('Cancel Data:', JSON.stringify(cancelData, null, 2));
    console.log('Signed Cancel Data:', JSON.stringify(signedCancelData, null, 2));
    console.log('='.repeat(60));

    // Send cancel data with signed payload from frontend
    const response = await api.post('/orders/cancel', {
        ...cancelData,
        signed_cancel_data: signedCancelData
    });

    // Log backend response
    console.log('BACKEND RESPONSE:', JSON.stringify(response.data, null, 2));

    return response.data;
};

export const cancelAllOrders = async (coin, signedCancelData) => {
    // Log what we're sending to backend
    console.log('='.repeat(60));
    console.log('SENDING TO BACKEND /orders/cancel-all:');
    console.log('='.repeat(60));
    console.log('Coin:', coin);
    console.log('Signed Cancel Data:', JSON.stringify(signedCancelData, null, 2));
    console.log('='.repeat(60));

    // Send cancel-all data with signed payload from frontend
    const response = await api.post('/orders/cancel-all', {
        coin,
        signed_cancel_data: signedCancelData
    });

    // Log backend response
    console.log('BACKEND RESPONSE:', JSON.stringify(response.data, null, 2));

    return response.data;
};

// Withdraw/Deposit endpoints
export const withdraw = async (amount, token = 'USDC') => {
    const response = await api.post('/account/withdraw', { amount, token });
    return response.data;
};

export const deposit = async (amount, token = 'USDC', agentAddress = null, agentPrivateKey = null) => {
    const response = await api.post('/account/deposit', {
        amount,
        token,
        agent_address: agentAddress,
        agent_private_key: agentPrivateKey
    });
    return response.data;
};

// Agent management endpoints
// Note: Agent creation is now done on the frontend using MetaMask
// This endpoint is kept for backward compatibility but is deprecated
export const createAgent = async (userAddress, agentName = null) => {
    const response = await api.post('/agents/create', {
        user_address: userAddress,
        agent_name: agentName
    });
    return response.data;
};

export const getUserAgents = async (userAddress) => {
    const response = await api.post('/agents/list', {
        user_address: userAddress
    });
    return response.data;
};

export const closePosition = async (coin, agentAddress, agentPrivateKey, userAddress = null, sz = null, px = null, slippage = 0.01) => {
    // Log request parameters
    console.log('='.repeat(60));
    console.log('API CALL - closePosition:');
    console.log('='.repeat(60));
    console.log('Coin:', coin);
    console.log('Agent Address:', agentAddress);
    console.log('User Address:', userAddress);
    console.log('Size:', sz || 'Full position');
    console.log('Price Limit:', px || 'Market price');
    console.log('Slippage:', slippage);
    console.log('='.repeat(60));

    const requestBody = {
        coin,
        agent_address: agentAddress,
        agent_private_key: agentPrivateKey,
        user_address: userAddress, // User's main address to check for positions
        sz: sz,
        px: px,
        slippage: slippage
    };

    console.log('Request Body:', JSON.stringify(requestBody, null, 2));
    console.log('='.repeat(60));

    const response = await api.post('/positions/close', requestBody);

    console.log('Response:', JSON.stringify(response.data, null, 2));
    console.log('='.repeat(60));

    return response.data;
};

// Set leverage for a coin
export const setLeverage = async (coin, leverage, isCross, agentAddress, agentPrivateKey) => {
    // Log what we're sending to backend
    console.log('='.repeat(60));
    console.log('SENDING TO BACKEND /account/set-leverage:');
    console.log('='.repeat(60));
    console.log('Coin:', coin);
    console.log('Leverage:', leverage);
    console.log('Is Cross:', isCross);
    console.log('Agent Address:', agentAddress);
    console.log('='.repeat(60));

    const response = await api.post('/account/set-leverage', {
        coin,
        leverage: parseInt(leverage),
        is_cross: isCross,
        agent_address: agentAddress,
        agent_private_key: agentPrivateKey
    });

    // Log backend response
    console.log('='.repeat(60));
    console.log('BACKEND RESPONSE:');
    console.log('='.repeat(60));
    console.log('Response:', JSON.stringify(response.data, null, 2));
    console.log('='.repeat(60));

    return response.data;
};

export default api;

