# Hyperliquid Trading Dashboard - Frontend

A modern React frontend with MetaMask integration for managing Hyperliquid perpetual trading positions, orders, deposits, and withdrawals.

## Features

- 🔐 **MetaMask Wallet Integration** - Connect and manage your wallet
- 📊 **Real-time Dashboard** - View account balance, positions, and orders
- 📈 **Position Management** - Monitor open positions with PnL tracking
- 🛒 **Order Management** - View and cancel open orders
- 💰 **Deposit & Withdraw** - Manage funds (requires backend integration)
- 🎨 **Modern UI** - Beautiful, responsive design with Tailwind CSS

## Prerequisites

- Node.js 18+ and npm/yarn
- MetaMask browser extension installed
- Backend server running (see main README.md)

## Installation

1. Navigate to the frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
# or
yarn install
```

3. Create environment file (optional):
```bash
cp .env.example .env
```

Edit `.env` if you need to change the API URL:
```env
VITE_API_URL=http://localhost:5001
```

## Running the Development Server

```bash
npm run dev
# or
yarn dev
```

The frontend will start on `http://localhost:3000`

## Building for Production

```bash
npm run build
# or
yarn build
```

The built files will be in the `dist` directory.

## Project Structure

```
frontend/
├── src/
│   ├── components/          # React components
│   │   ├── WalletConnect.jsx
│   │   ├── Orders.jsx
│   │   ├── Positions.jsx
│   │   ├── Balance.jsx
│   │   ├── Deposit.jsx
│   │   └── Withdraw.jsx
│   ├── hooks/               # Custom React hooks
│   │   └── useWallet.js
│   ├── services/            # API services
│   │   └── api.js
│   ├── utils/               # Utility functions
│   │   └── wallet.js
│   ├── App.jsx              # Main app component
│   ├── main.jsx             # Entry point
│   └── index.css            # Global styles
├── index.html
├── package.json
├── vite.config.js
└── tailwind.config.js
```

## Usage

### Connecting Your Wallet

1. Make sure MetaMask is installed in your browser
2. Click "Connect MetaMask" button
3. Approve the connection request in MetaMask
4. Your wallet address will be displayed

### Viewing Balance

- Navigate to the "Balance" tab (default)
- View your account value, collateral, margin used, and PnL
- Data refreshes automatically every 10 seconds

### Managing Orders

- Navigate to the "Orders" tab
- View all open orders with details (coin, side, size, price)
- Cancel individual orders or cancel all orders at once
- Orders refresh automatically every 10 seconds

### Viewing Positions

- Navigate to the "Positions" tab
- See all open positions with:
  - Entry price
  - Position size
  - Leverage
  - Unrealized PnL
  - Liquidation price
- Positions refresh automatically every 10 seconds

### Depositing Funds

- Navigate to the "Deposit" tab
- Select token (USDC/USDT)
- Enter amount
- Click "Deposit"
- Sign the transaction in MetaMask

**Note**: Deposit functionality requires backend integration with Hyperliquid smart contracts. The current implementation is a placeholder UI.

### Withdrawing Funds

- Navigate to the "Withdraw" tab
- Select token (USDC/USDT)
- Enter amount
- Click "Withdraw"
- Sign the transaction in MetaMask

**Note**: Withdrawal functionality requires backend integration with Hyperliquid smart contracts. The current implementation is a placeholder UI.

## Technologies Used

- **React 18** - UI framework
- **Vite** - Build tool and dev server
- **React Router** - Client-side routing
- **Ethers.js** - Ethereum library for MetaMask integration
- **Axios** - HTTP client for API calls
- **Tailwind CSS** - Utility-first CSS framework
- **Lucide React** - Icon library

## API Integration

The frontend connects to the backend API at `http://localhost:5001` by default. The API endpoints used are:

- `GET /health` - Health check
- `GET /account/info` - Account information
- `GET /account/balance` - Account balance
- `GET /account/positions` - Open positions
- `GET /orders/open` - Open orders
- `POST /orders/place` - Place order
- `POST /orders/cancel` - Cancel order
- `POST /orders/cancel-all` - Cancel all orders
- `POST /account/deposit` - Initiate deposit
- `POST /account/withdraw` - Initiate withdrawal

## MetaMask Integration

The app uses MetaMask for wallet connection and transaction signing:

- **Wallet Connection**: Uses `ethers.BrowserProvider` to connect to MetaMask
- **Account Management**: Listens for account and chain changes
- **Transaction Signing**: Ready for deposit/withdraw transactions (requires contract integration)

## Development

### Adding New Features

1. Create components in `src/components/`
2. Add API calls in `src/services/api.js`
3. Update routing in `src/App.jsx`
4. Add styles using Tailwind CSS classes

### Styling

The app uses Tailwind CSS. Customize colors and theme in `tailwind.config.js`.

## Troubleshooting

### MetaMask Not Detected

- Ensure MetaMask extension is installed
- Refresh the page
- Check browser console for errors

### API Connection Errors

- Verify backend server is running on port 5001
- Check CORS settings in backend
- Verify API URL in `.env` file

### Transaction Failures

- Ensure sufficient gas fees
- Check network connection
- Verify account has sufficient balance

## Security Notes

- Never commit `.env` files with sensitive data
- Always verify transaction details before signing
- Use testnet for testing
- Keep MetaMask secure with strong password

## License

MIT

## Support

For issues related to:
- Frontend: Check this repository
- Backend: See main README.md
- Hyperliquid: Check [Hyperliquid Documentation](https://hyperliquid.gitbook.io/)

# perp-frontend
