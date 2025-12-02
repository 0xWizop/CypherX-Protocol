export interface DocSection {
  id: string;
  title: string;
  content: string;
  subsections?: DocSubsection[];
}

export interface DocSubsection {
  id: string;
  title: string;
  content: string;
  codeExamples?: CodeExample[];
}

export interface CodeExample {
  language: string;
  code: string;
  description: string;
}

export const documentationSections: DocSection[] = [
  {
    id: "overview",
    title: "Overview",
    content: `
      CypherX is a comprehensive decentralized trading platform built on Base Chain that provides 
      real-time analytics, advanced charting, and lightning-fast swap executions. Our platform 
      combines cutting-edge technology with user-friendly design to create an unparalleled 
      trading experience for both beginners and advanced users.
      
      ## Key Features
      
      - **Real-time Trading**: Execute swaps with sub-second confirmation times
      - **Advanced Charting**: Professional-grade charts with multiple timeframes and indicators
      - **Self-custodial Wallet**: Secure wallet with backup and recovery features
      - **Whale Watching**: Track large transactions and market-moving activities
      - **Market Analytics**: Comprehensive data and insights for informed trading
      - **News Integration**: Stay updated with the latest Base Chain developments
    `
  },
  {
    id: "getting-started",
    title: "Getting Started",
    content: `
      Get started with CypherX quickly and efficiently. This section covers everything you need 
      to know to begin using our platform effectively.
    `,
    subsections: [
      {
        id: "introduction",
        title: "Introduction to CypherX",
        content: `
          Welcome to CypherX! This guide will help you get started with our platform and 
          understand its core features.
          
          ## What is CypherX?
          
          CypherX is a decentralized trading platform that provides:
          
          - **Token Trading**: Swap tokens with minimal slippage and fast execution
          - **Real-time Charts**: Professional charting with technical indicators
          - **Wallet Integration**: Secure self-custodial wallet
          - **Market Analytics**: Comprehensive market data and insights
          - **Whale Watching**: Track large transactions and market movements
          
          ## Platform Architecture
          
          CypherX is built on Base Chain and integrates with multiple DEXs including:
          
          - Uniswap V3
          - Aerodrome
          - BaseSwap
          - PancakeSwap V3
          
          This multi-DEX approach ensures you always get the best prices and liquidity.
        `
      },
      {
        id: "quick-start",
        title: "Quick Start Guide",
        content: `
          Get up and running with CypherX in just a few minutes.
          
          ## Step 1: Connect Your Wallet
          
          1. Click the "Connect Wallet" button in the header
          2. Choose between MetaMask or our self-custodial wallet
          3. Approve the connection
          
          ## Step 2: Explore the Platform
          
          - **Trade Page**: Browse and trade tokens
          - **Radar**: Discover trending tokens
          - **Charts**: View detailed price charts
          
          ## Step 3: Make Your First Trade
          
          1. Navigate to the Trade page
          2. Select a token pair
          3. Enter the amount you want to swap
          4. Review the transaction details
          5. Confirm the swap
          
          ## Step 4: Explore Advanced Features
          
          - Set up price alerts
          - Create watchlists
          - Use advanced chart indicators
          - Monitor whale movements
        `
      },
      {
        id: "installation",
        title: "Installation & Setup",
        content: `
          CypherX is a web-based platform that works in any modern browser. No installation required!
          
          ## Browser Requirements
          
          - Chrome 90+
          - Firefox 88+
          - Safari 14+
          - Edge 90+
          
          ## Recommended Setup
          
          ### 1. Install MetaMask
          
          For the best experience, we recommend installing MetaMask:
          
          1. Visit [metamask.io](https://metamask.io)
          2. Install the browser extension
          3. Create a new wallet or import existing
          4. Add Base Chain network
          
          ### 2. Add Base Chain to MetaMask
          
          Network Details:
          - Network Name: Base
          - RPC URL: https://mainnet.base.org
          - Chain ID: 8453
          - Currency Symbol: ETH
          - Block Explorer: https://basescan.org
          
          ### 3. Get Some ETH
          
          You'll need ETH on Base Chain for:
          - Trading fees
          - Gas costs
          - Token swaps
          
          You can bridge ETH from Ethereum mainnet or buy directly on Base.
        `
      },
      {
        id: "first-steps",
        title: "First Steps",
        content: `
          Now that you're set up, let's explore the essential features of CypherX.
          
          ## Understanding the Interface
          
          ### Header Navigation
          
          - **Trade**: Main trading interface
          - **Radar**: Token discovery and trending
          - **Explorer**: Block and transaction explorer
          
          ### Key Components
          
          - **Global Search**: Search for tokens, addresses, transactions
          - **Wallet Display**: View balance and manage wallet
          - **User Profile**: Access settings and preferences
          
          ## Essential Features
          
          ### 1. Token Trading
          
          The core feature of CypherX:
          
          - Browse available tokens
          - View real-time prices
          - Execute swaps with minimal slippage
          - Track transaction history
          
          ### 2. Real-time Charts
          
          Professional charting capabilities:
          
          - Multiple timeframes (1m to 1d)
          - Technical indicators
          - Drawing tools
          - Price alerts
          
          ### 3. Market Analytics
          
          Comprehensive market data:
          
          - Market cap rankings
          - Volume analysis
          - Price change tracking
          - Liquidity information
          
          ### 4. Whale Watching
          
          Monitor large transactions:
          
          - Real-time whale alerts
          - Transaction analysis
          - Market impact assessment
          - Historical whale data
        `
      }
    ]
  },
  {
    id: "core-features",
    title: "Core Features",
    content: `
      Explore the core features that make CypherX a powerful trading platform. From basic trading 
      to advanced analytics, discover everything our platform has to offer.
    `,
    subsections: [
      {
        id: "token-trading",
        title: "Token Trading",
        content: `
          CypherX provides a seamless trading experience with lightning-fast execution and minimal slippage.
          
          ## Trading Interface
          
          ### Token Selection
          
          - Browse trending tokens
          - Search by name or address
          - View token information
          - Check liquidity and volume
          
          ### Swap Execution
          
          1. **Select Token Pair**: Choose the tokens you want to swap
          2. **Enter Amount**: Specify the amount to trade
          3. **Review Details**: Check price impact and fees
          4. **Confirm Swap**: Execute the transaction
          
          ## Advanced Trading Features
          
          ### Slippage Protection
          
          - Set custom slippage tolerance
          - Automatic slippage optimization
          - Transaction failure protection
          
          ### Price Impact Analysis
          
          - Real-time price impact calculation
          - Liquidity depth visualization
          - Optimal trade size recommendations
          
          ### Multi-DEX Routing
          
          - Automatic best price routing
          - Split trades across multiple DEXs
          - Optimized gas usage
          
          ## Trading Strategies
          
          ### Basic Trading
          
          - Market orders
          - Limit orders (coming soon)
          - Stop-loss orders (coming soon)
          
          ### Advanced Strategies
          
          - DCA (Dollar Cost Averaging)
          - Arbitrage opportunities
          - MEV protection
        `,
        codeExamples: [
          {
            language: "javascript",
            code: `// Example: Basic swap function
async function executeSwap(tokenIn, tokenOut, amount) {
  const swapParams = {
    tokenIn: tokenIn.address,
    tokenOut: tokenOut.address,
    amount: amount,
    slippage: 0.5, // 0.5% slippage
    deadline: Math.floor(Date.now() / 1000) + 1200 // 20 minutes
  };
  
  const tx = await router.exactInputSingle(swapParams);
  return await tx.wait();
}`,
            description: "Basic swap execution with slippage protection"
          }
        ]
      },
      {
        id: "charts",
        title: "Real-time Charts",
        content: `
          Professional-grade charting with multiple timeframes, technical indicators, and real-time data.
          
          ## Chart Features
          
          ### Timeframes
          
          - 1 minute (1m)
          - 5 minutes (5m)
          - 15 minutes (15m)
          - 1 hour (1h)
          - 4 hours (4h)
          - 1 day (1d)
          
          ### Chart Types
          
          - **Candlestick**: Traditional OHLCV display
          - **Line**: Simple price line
          - **Area**: Filled price area
          - **Volume**: Trading volume bars
          
          ### Technical Indicators
          
          - **Moving Averages**: SMA, EMA, WMA
          - **Oscillators**: RSI, MACD, Stochastic
          - **Trend Indicators**: Bollinger Bands, Parabolic SAR
          - **Volume Indicators**: OBV, VWAP
          
          ## Advanced Charting
          
          ### Drawing Tools
          
          - Trend lines
          - Fibonacci retracements
          - Support/resistance levels
          - Price channels
          
          ### Analysis Tools
          
          - Pattern recognition
          - Price projections
          - Risk/reward calculations
          - Portfolio tracking
          
          ### Real-time Updates
          
          - Live price feeds
          - WebSocket connections
          - Instant chart updates
          - Transaction integration
        `,
        codeExamples: [
          {
            language: "javascript",
            code: `// Example: Chart configuration
const chartConfig = {
  type: 'candlestick',
  timeframe: '1h',
  indicators: [
    { type: 'sma', period: 20, color: '#3B82F6' },
    { type: 'rsi', period: 14, color: '#EF4444' }
  ],
  drawingTools: ['trendline', 'fibonacci'],
  realtime: true
};`,
            description: "Chart configuration with indicators and drawing tools"
          }
        ]
      },
      {
        id: "wallet",
        title: "Wallet Integration",
        content: `
          Secure self-custodial wallet with advanced features for managing your digital assets.
          
          ## Wallet Features
          
          ### Self-Custodial Security
          
          - **Private Key Control**: You own your private keys
          - **Local Storage**: Keys stored securely in your browser
          - **Backup & Recovery**: Export/import wallet functionality
          - **No Server Storage**: Keys never leave your device
          
          ### Multi-Asset Support
          
          - **ETH**: Native Base Chain token
          - **ERC-20 Tokens**: All Base Chain tokens
          - **NFTs**: ERC-721 and ERC-1155 support
          - **Custom Tokens**: Add any token by address
          
          ## Wallet Management
          
          ### Creating a Wallet
          
          1. Click "Create Wallet" in the wallet dropdown
          2. Save your backup phrase securely
          3. Verify your backup
          4. Set a strong password
          
          ### Importing a Wallet
          
          1. Click "Import Wallet"
          2. Enter your private key or backup file
          3. Verify the wallet address
          4. Access your funds
          
          ### Backup & Recovery
          
          - **Backup File**: Encrypted JSON file
          - **Private Key**: 64-character hexadecimal string
          - **Recovery Phrase**: 12 or 24-word mnemonic
          
          ## Security Best Practices
          
          ### Key Management
          
          - Store backups in multiple secure locations
          - Use hardware wallets for large amounts
          - Never share private keys
          - Regular security audits
          
          ### Transaction Security
          
          - Verify transaction details
          - Check gas fees
          - Confirm recipient addresses
          - Use trusted networks only
        `,
        codeExamples: [
          {
            language: "javascript",
            code: `// Example: Wallet creation
import { ethers } from 'ethers';

const createWallet = () => {
  const wallet = ethers.Wallet.createRandom();
  
  return {
    address: wallet.address,
    privateKey: wallet.privateKey,
    mnemonic: wallet.mnemonic.phrase
  };
};

// Example: Wallet backup
const backupWallet = (walletData) => {
  const backup = {
    address: walletData.address,
    privateKey: walletData.privateKey,
    mnemonic: walletData.mnemonic,
    timestamp: Date.now(),
    version: '1.0'
  };
  
  return JSON.stringify(backup, null, 2);
};`,
            description: "Wallet creation and backup functionality"
          }
        ]
      },
      {
        id: "analytics",
        title: "Market Analytics",
        content: `
          Comprehensive market data and analytics to help you make informed trading decisions.
          
          ## Market Data
          
          ### Price Information
          
          - **Real-time Prices**: Live price feeds from multiple sources
          - **Price History**: Historical price data with charts
          - **Price Alerts**: Custom price notifications
          - **Price Comparisons**: Compare multiple tokens
          
          ### Market Metrics
          
          - **Market Cap**: Total token value
          - **Volume**: 24h trading volume
          - **Liquidity**: Available trading liquidity
          - **Holders**: Number of token holders
          - **Transactions**: Recent transaction count
          
          ## Advanced Analytics
          
          ### Technical Analysis
          
          - **Trend Analysis**: Identify market trends
          - **Support/Resistance**: Key price levels
          - **Pattern Recognition**: Chart patterns
          - **Momentum Indicators**: Price momentum
          
          ### Fundamental Analysis
          
          - **Token Metrics**: Supply, distribution, utility
          - **Project Information**: Team, roadmap, partnerships
          - **Social Sentiment**: Community engagement
          - **Development Activity**: GitHub activity
          
          ### Risk Assessment
          
          - **Liquidity Risk**: Low liquidity warnings
          - **Volatility Analysis**: Price volatility metrics
          - **Concentration Risk**: Large holder analysis
          - **Smart Contract Risk**: Security assessments
        `,
        codeExamples: [
          {
            language: "javascript",
            code: `// Example: Market data API
const getMarketData = async (tokenAddress) => {
  const response = await fetch(\`/api/token-data/\${tokenAddress}\`);
  const data = await response.json();
  
  return {
    price: data.priceUsd,
    marketCap: data.marketCap,
    volume24h: data.volume24h,
    liquidity: data.liquidity,
    priceChange24h: data.priceChange24h,
    holders: data.holders
  };
};

// Example: Price alert
const setPriceAlert = (tokenAddress, targetPrice, condition) => {
  return {
    tokenAddress,
    targetPrice,
    condition, // 'above' or 'below'
    active: true,
    createdAt: Date.now()
  };
};`,
            description: "Market data retrieval and price alert functionality"
          }
        ]
      },
      {
        id: "whale-watching",
        title: "Whale Watching",
        content: `
          Track large transactions and identify market-moving activities in real-time.
          
          ## Whale Detection
          
          ### Transaction Monitoring
          
          - **Large Transactions**: Monitor transactions above threshold
          - **Whale Wallets**: Track known whale addresses
          - **Pattern Recognition**: Identify trading patterns
          - **Real-time Alerts**: Instant notifications
          
          ### Market Impact Analysis
          
          - **Price Impact**: Calculate price movement from large trades
          - **Liquidity Impact**: Assess liquidity changes
          - **Market Sentiment**: Analyze whale behavior
          - **Historical Data**: Track whale activity over time
          
          ## Whale Features
          
          ### Transaction Filters
          
          - **Amount Thresholds**: Set minimum transaction sizes
          - **Token Filters**: Focus on specific tokens
          - **Time Ranges**: Historical and real-time data
          - **Transaction Types**: Buys, sells, transfers
          
          ### Alert System
          
          - **Real-time Notifications**: Instant whale alerts
          - **Custom Thresholds**: Set your own alert levels
          - **Multiple Channels**: Email, push, in-app
          - **Alert History**: Track past alerts
          
          ### Analytics Dashboard
          
          - **Whale Activity**: Daily/weekly/monthly summaries
          - **Top Whales**: Most active whale addresses
          - **Token Analysis**: Whale activity by token
          - **Market Correlation**: Whale activity vs price
        `,
        codeExamples: [
          {
            language: "javascript",
            code: `// Example: Whale detection
const detectWhaleTransaction = (transaction) => {
  const whaleThreshold = 10000; // $10,000 USD
  const usdValue = transaction.amount * transaction.priceUsd;
  
  if (usdValue >= whaleThreshold) {
    return {
      isWhale: true,
      whaleSize: usdValue,
      impact: calculatePriceImpact(transaction),
      alert: generateWhaleAlert(transaction)
    };
  }
  
  return { isWhale: false };
};

// Example: Whale alert
const generateWhaleAlert = (transaction) => {
  return {
    type: 'whale_transaction',
    token: transaction.tokenSymbol,
    amount: transaction.amount,
    usdValue: transaction.amount * transaction.priceUsd,
    direction: transaction.type, // 'buy' or 'sell'
    timestamp: transaction.timestamp,
    wallet: transaction.from
  };
};`,
            description: "Whale transaction detection and alert generation"
          }
        ]
      },
      {
        id: "news",
        title: "Insights & Events",
        content: `
          Stay updated with the latest Base Chain developments, project announcements, and market news.
          
          ## News Features
          
          ### Content Sources
          
          - **Official Announcements**: Project team updates
          - **Community News**: Community-driven content
          - **Market Analysis**: Professional market insights
          - **Event Coverage**: Conference and meetup coverage
          
          ### Content Types
          
          - **Articles**: In-depth analysis and reports
          - **News Briefs**: Quick updates and announcements
          - **Event Calendars**: Upcoming events and deadlines
          - **Video Content**: Interviews and presentations
          
          ## Event Tracking
          
          ### Calendar Integration
          
          - **Token Launches**: New token releases
          - **Protocol Updates**: Network upgrades
          - **Governance Votes**: DAO proposals
          - **Partnership Announcements**: Strategic partnerships
          
          ### Event Alerts
          
          - **Custom Reminders**: Set event notifications
          - **Countdown Timers**: Time until events
          - **Live Coverage**: Real-time event updates
          - **Post-Event Analysis**: Event impact assessment
          
          ## Content Management
          
          ### Personalization
          
          - **Interest Tags**: Follow specific topics
          - **Custom Feeds**: Personalized news streams
          - **Reading History**: Track read articles
          - **Bookmarks**: Save important content
          
          ### Social Features
          
          - **Comments**: Community discussions
          - **Sharing**: Share articles on social media
          - **Ratings**: Rate article quality
          - **Recommendations**: AI-powered content suggestions
        `,
        codeExamples: [
          {
            language: "javascript",
            code: `// Example: News feed API
const getNewsFeed = async (filters = {}) => {
  const response = await fetch('/api/news', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(filters)
  });
  
  return await response.json();
};

// Example: Event tracking
const trackEvent = (event) => {
  return {
    id: event.id,
    title: event.title,
    description: event.description,
    startDate: event.startDate,
    endDate: event.endDate,
    type: event.type, // 'launch', 'update', 'vote', etc.
    tokens: event.relatedTokens,
    alerts: event.alerts
  };
};`,
            description: "News feed retrieval and event tracking functionality"
          }
        ]
      }
    ]
  },
  {
    id: "advanced",
    title: "Advanced Features",
    content: `
      Dive deep into advanced features and integrations. Learn about APIs, WebSocket feeds, 
      and other technical capabilities that power CypherX.
    `,
    subsections: [
      {
        id: "api",
        title: "API Reference",
        content: `
          Integrate CypherX data and functionality into your applications with our comprehensive API.
          
          ## API Overview
          
          ### Base URL
          \`\`\`
          https://api.cypherx.io/v1
          \`\`\`
          
          ### Authentication
          
          API requests require authentication using API keys:
          
          \`\`\`http
          Authorization: Bearer YOUR_API_KEY
          \`\`\`
          
          ### Rate Limits
          
          - **Free Tier**: 1,000 requests/hour
          - **Pro Tier**: 10,000 requests/hour
          - **Enterprise**: Custom limits
          
          ## Endpoints
          
          ### Market Data
          
          \`\`\`http
          GET /tokens
          GET /tokens/{address}
          GET /tokens/{address}/price
          GET /tokens/{address}/chart
          \`\`\`
          
          ### Trading
          
          \`\`\`http
          POST /swap/quote
          POST /swap/execute
          GET /swap/history
          \`\`\`
          
          ### Analytics
          
          \`\`\`http
          GET /analytics/whale-transactions
          GET /analytics/market-metrics
          GET /analytics/token-metrics
          \`\`\`
          
          ### News & Events
          
          \`\`\`http
          GET /news
          GET /events
          GET /events/{id}
          \`\`\`
        `,
        codeExamples: [
          {
            language: "javascript",
            code: `// Example: API client
class CypherXAPI {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseURL = 'https://api.cypherx.io/v1';
  }
  
  async request(endpoint, options = {}) {
    const response = await fetch(\`\${this.baseURL}\${endpoint}\`, {
      ...options,
      headers: {
        'Authorization': \`Bearer \${this.apiKey}\`,
        'Content-Type': 'application/json',
        ...options.headers
      }
    });
    
    return await response.json();
  }
  
  async getTokenPrice(address) {
    return this.request(\`/tokens/\${address}/price\`);
  }
  
  async getSwapQuote(params) {
    return this.request('/swap/quote', {
      method: 'POST',
      body: JSON.stringify(params)
    });
  }
}

// Usage
const api = new CypherXAPI('your-api-key');
const price = await api.getTokenPrice('0x...');`,
            description: "Complete API client implementation"
          }
        ]
      },
      {
        id: "websocket",
        title: "WebSocket Feeds",
        content: `
          Real-time data feeds for live market updates, price changes, and transaction monitoring.
          
          ## WebSocket Connection
          
          ### Connection URL
          \`\`\`
          wss://ws.cypherx.io/v1
          \`\`\`
          
          ### Authentication
          
          \`\`\`javascript
          const ws = new WebSocket('wss://ws.cypherx.io/v1');
          
          ws.onopen = () => {
            ws.send(JSON.stringify({
              type: 'auth',
              apiKey: 'your-api-key'
            }));
          };
          \`\`\`
          
          ## Available Feeds
          
          ### Price Feeds
          
          Subscribe to real-time price updates:
          
          \`\`\`javascript
          {
            "type": "subscribe",
            "channel": "price",
            "tokens": ["0x...", "0x..."]
          }
          \`\`\`
          
          ### Transaction Feeds
          
          Monitor live transactions:
          
          \`\`\`javascript
          {
            "type": "subscribe",
            "channel": "transactions",
            "filters": {
              "minAmount": 1000,
              "tokens": ["0x..."]
            }
          }
          \`\`\`
          
          ### Whale Alerts
          
          Real-time whale transaction alerts:
          
          \`\`\`javascript
          {
            "type": "subscribe",
            "channel": "whale-alerts",
            "threshold": 10000
          }
          \`\`\`
          
          ## Message Format
          
          ### Price Update
          
          \`\`\`json
          {
            "type": "price_update",
            "token": "0x...",
            "price": 1.23,
            "change24h": 5.67,
            "volume24h": 1000000,
            "timestamp": 1640995200
          }
          \`\`\`
          
          ### Transaction Alert
          
          \`\`\`json
          {
            "type": "transaction",
            "hash": "0x...",
            "from": "0x...",
            "to": "0x...",
            "token": "0x...",
            "amount": 1000,
            "usdValue": 1230,
            "timestamp": 1640995200
          }
          \`\`\`
        `,
        codeExamples: [
          {
            language: "javascript",
            code: `// Example: WebSocket client
class CypherXWebSocket {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.ws = null;
    this.subscriptions = new Map();
  }
  
  connect() {
    this.ws = new WebSocket('wss://ws.cypherx.io/v1');
    
    this.ws.onopen = () => {
      this.authenticate();
    };
    
    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      this.handleMessage(data);
    };
  }
  
  authenticate() {
    this.ws.send(JSON.stringify({
      type: 'auth',
      apiKey: this.apiKey
    }));
  }
  
  subscribe(channel, params = {}) {
    const subscription = {
      type: 'subscribe',
      channel,
      ...params
    };
    
    this.ws.send(JSON.stringify(subscription));
    this.subscriptions.set(channel, params);
  }
  
  handleMessage(data) {
    switch (data.type) {
      case 'price_update':
        this.onPriceUpdate(data);
        break;
      case 'transaction':
        this.onTransaction(data);
        break;
      case 'whale_alert':
        this.onWhaleAlert(data);
        break;
    }
  }
}

// Usage
const ws = new CypherXWebSocket('your-api-key');
ws.connect();
ws.subscribe('price', { tokens: ['0x...'] });`,
            description: "Complete WebSocket client implementation"
          }
        ]
      }
    ]
  },
  {
    id: "discover",
    title: "Discover",
    content: `
      The Discover page is your gateway to finding and analyzing tokens on Base Chain. Browse thousands 
      of tokens, filter by various metrics, and dive deep into token analytics.
    `,
    subsections: [
      {
        id: "token-discovery",
        title: "Token Discovery",
        content: `
          Discover new tokens and opportunities with our comprehensive token discovery tools.
          
          ## Browse Tokens
          
          ### Token List
          
          The Discover page displays a comprehensive list of tokens with:
          
          - **Token Information**: Name, symbol, logo, and contract address
          - **Price Data**: Current price, 24h change, and price history
          - **Market Metrics**: Market cap, volume, liquidity, and holders
          - **Security Status**: Contract verification, liquidity locks, honeypot checks
          
          ### Filtering Options
          
          Filter tokens by:
          
          - **Liquidity**: Minimum liquidity thresholds
          - **Volume**: 24h trading volume filters
          - **Age**: Token creation date
          - **Price Change**: 24h price movement
          - **Market Cap**: Market capitalization ranges
          - **Security**: Verified contracts, locked liquidity
          
          ### Sorting Options
          
          Sort tokens by:
          
          - **Volume**: Highest 24h volume
          - **Price Change**: Biggest movers
          - **Market Cap**: Largest market caps
          - **Liquidity**: Most liquid tokens
          - **Age**: Newest tokens first
          
          ## Token Details
          
          ### Token Page
          
          Each token has a dedicated page with:
          
          - **Price Chart**: Interactive TradingView charts
          - **Market Data**: Comprehensive market metrics
          - **Trading Interface**: Quick swap functionality
          - **Transaction History**: Recent transactions
          - **Holder Analysis**: Top holders and distribution
          - **Security Audit**: Contract verification status
          
          ### Chart Analysis
          
          Professional charting features:
          
          - Multiple timeframes (1m to 1d)
          - Technical indicators
          - Drawing tools
          - Price alerts
          - Volume analysis
        `
      },
      {
        id: "quick-buy",
        title: "Quick Buy",
        content: `
          Execute trades quickly with our one-click swap functionality.
          
          ## Quick Buy Features
          
          ### Instant Swaps
          
          - **1-Click Execution**: Swap tokens instantly
          - **Best Price Routing**: Automatic DEX aggregation
          - **Slippage Protection**: Configurable slippage tolerance
          - **Gas Optimization**: Efficient transaction routing
          
          ### Quick Buy Configuration
          
          Customize your quick buy settings:
          
          - **Default Amounts**: Set preset swap amounts
          - **Slippage Tolerance**: Configure default slippage
          - **Gas Preferences**: Fast, standard, or slow
          - **Token Preferences**: Favorite tokens for quick access
          
          ## Trading Flow
          
          1. **Select Token**: Choose from trending or search
          2. **Enter Amount**: Specify swap amount
          3. **Review**: Check price impact and fees
          4. **Confirm**: Execute the swap
          5. **Track**: Monitor transaction status
        `
      }
    ]
  },
  {
    id: "dashboard",
    title: "Dashboard",
    content: `
      Your personal trading dashboard with portfolio tracking, position management, and comprehensive analytics.
    `,
    subsections: [
      {
        id: "portfolio-overview",
        title: "Portfolio Overview",
        content: `
          Get a complete view of your trading portfolio and performance.
          
          ## Portfolio Metrics
          
          ### Total Value
          
          - **Portfolio Value**: Total USD value of all holdings
          - **P&L**: Profit and loss tracking
          - **24h Change**: Daily portfolio performance
          - **All-Time Performance**: Historical P&L
          
          ### Multi-Wallet Support
          
          - **Wallet Aggregation**: View multiple wallets in one dashboard
          - **Wallet Switching**: Easily switch between wallets
          - **Combined Analytics**: Aggregate metrics across wallets
          - **Individual Tracking**: Per-wallet breakdown
          
          ## Position Tracking
          
          ### Open Positions
          
          Track your active positions:
          
          - **Token Holdings**: Current token balances
          - **Entry Price**: Average entry price
          - **Current Price**: Real-time token prices
          - **Unrealized P&L**: Current profit/loss
          - **ROI**: Return on investment percentage
          
          ### Closed Positions
          
          Historical position data:
          
          - **Trade History**: All closed positions
          - **Realized P&L**: Actualized profits/losses
          - **Trade Analytics**: Win rate, average return
          - **Tax Reporting**: Export for tax purposes
        `
      },
      {
        id: "analytics",
        title: "Trading Analytics",
        content: `
          Deep dive into your trading performance with comprehensive analytics.
          
          ## Performance Metrics
          
          ### Trading Statistics
          
          - **Total Trades**: Number of completed swaps
          - **Win Rate**: Percentage of profitable trades
          - **Average Trade Size**: Mean transaction value
          - **Total Volume**: Cumulative trading volume
          - **Fees Paid**: Total fees and gas costs
          
          ### Timeframe Analysis
          
          Analyze performance over:
          
          - **7 Days**: Weekly performance
          - **30 Days**: Monthly performance
          - **90 Days**: Quarterly performance
          - **All Time**: Complete trading history
          
          ## P&L Calendar
          
          Visualize your trading activity:
          
          - **Daily P&L**: Profit/loss by day
          - **Heat Map**: Visual performance calendar
          - **Best Days**: Top performing trading days
          - **Trend Analysis**: Performance trends over time
        `
      },
      {
        id: "tax-reporting",
        title: "Tax Reporting",
        content: `
          Generate comprehensive tax reports for your trading activity.
          
          ## Tax Features
          
          ### Report Generation
          
          - **CSV Export**: Download transaction data
          - **Tax Year Selection**: Filter by tax year
          - **Transaction Details**: Complete trade history
          - **Cost Basis Tracking**: Calculate cost basis
          
          ### Tax Categories
          
          - **Realized Gains**: Profits from closed positions
          - **Realized Losses**: Losses from closed positions
          - **Unrealized P&L**: Current position values
          - **Fees & Gas**: Trading costs
        `
      }
    ]
  },
  {
    id: "radar",
    title: "Radar",
    content: `
      Smart token scanner with AI-powered analysis and customizable alerts.
    `,
    subsections: [
      {
        id: "smart-scanner",
        title: "Smart Scanner",
        content: `
          AI-powered token scanning with advanced filtering and security analysis.
          
          ## Scanner Features
          
          ### Token Scanning
          
          - **Real-time Scanning**: Continuous token discovery
          - **Multi-Criteria Filtering**: Advanced filter combinations
          - **Security Analysis**: Automated security checks
          - **Risk Scoring**: Comprehensive risk assessment
          
          ### Security Checks
          
          Automated security analysis:
          
          - **Contract Verification**: Verified smart contracts
          - **Liquidity Locks**: Locked liquidity verification
          - **Honeypot Detection**: Honeypot scanning
          - **Rug Pull Risk**: Rug pull probability analysis
          - **Owner Analysis**: Contract owner assessment
          
          ## Custom Alerts
          
          Set up custom alerts for:
          
          - **Price Movements**: Price change thresholds
          - **Volume Spikes**: Unusual volume activity
          - **New Listings**: New token launches
          - **Security Events**: Security risk changes
          - **Whale Activity**: Large transaction alerts
        `
      }
    ]
  },
  {
    id: "rewards",
    title: "Rewards & Tiers",
    content: `
      Earn rewards on every trade with our tiered loyalty system, cashback program, and referral incentives.
    `,
    subsections: [
      {
        id: "tier-system",
        title: "Tier System",
        content: `
          Progress through 5 tiers by earning points from trading activity.
          
          ## Tier Levels
          
          ### Tier 1: Normie (0-1,999 points)
          
          - **Swap Fee**: 0.75%
          - **Cashback Rate**: 5% of net platform fee
          - **Airdrop Allocation**: 1x
          - **Benefits**: Basic platform access
          
          ### Tier 2: Degen (2,000-7,999 points)
          
          - **Swap Fee**: 0.60%
          - **Cashback Rate**: 10% of net platform fee
          - **Airdrop Allocation**: 1.5x
          - **Benefits**: Reduced fees, higher cashback
          
          ### Tier 3: Alpha (8,000-19,999 points)
          
          - **Swap Fee**: 0.45%
          - **Cashback Rate**: 15% of net platform fee
          - **Airdrop Allocation**: 2x
          - **Benefits**: Priority support, exclusive features
          
          ### Tier 4: Mogul (20,000-49,999 points)
          
          - **Swap Fee**: 0.30%
          - **Cashback Rate**: 20% of net platform fee
          - **Airdrop Allocation**: 3x
          - **Benefits**: VIP access, exclusive events
          
          ### Tier 5: Titan (50,000+ points)
          
          - **Swap Fee**: 0.20%
          - **Cashback Rate**: 25% of net platform fee
          - **Airdrop Allocation**: 5x
          - **Benefits**: Maximum benefits, governance rights
          
          ## Earning Points
          
          ### Trading Rewards
          
          - **0.1 points per $1 traded**: Earn points on every swap
          - **No cap**: Unlimited point accumulation
          - **Real-time updates**: Points credited immediately
          
          ### Streak Multipliers
          
          - **Daily Trading Streaks**: Maintain daily trading activity
          - **Multiplier Bonuses**: Increase point earnings
          - **Streak Rewards**: Bonus points for streaks
        `
      },
      {
        id: "cashback",
        title: "Cashback System",
        content: `
          Earn ETH cashback on every trade based on your tier level.
          
          ## Cashback Calculation
          
          ### Fee Structure
          
          - **Platform Fee**: 0.75% of swap value
          - **0x Protocol Fee**: 0.15% (deducted)
          - **Net Platform Fee**: 0.60% available for cashback
          - **Cashback**: Net Fee × Tier Cashback Rate
          
          ### Example Calculation
          
          For a $1,000 swap at Alpha tier (15% cashback):
          
          - Platform Fee: $7.50
          - 0x Fee: $1.50
          - Net Fee: $6.00
          - Cashback: $6.00 × 15% = $0.90 ETH
          
          ## Cashback Features
          
          - **Automatic Crediting**: Cashback added to rewards balance
          - **Withdrawable**: Withdraw ETH rewards anytime
          - **No Minimum**: No minimum withdrawal threshold
          - **Real-time Tracking**: Monitor cashback accumulation
        `
      },
      {
        id: "referrals",
        title: "Referral Program",
        content: `
          Earn rewards by referring new users to CypherX.
          
          ## Referrer Rewards
          
          ### Earning Structure
          
          - **30% of net platform fee** from referred user's swaps
          - **Lifetime rewards**: Earn from referral network forever
          - **No limit**: Unlimited referrals
          - **ETH rewards**: Rewards paid in ETH
          
          ### Referral Code
          
          - **Unique Code**: Format: CYPHERX[6 alphanumeric]
          - **Shareable Link**: Generate referral links
          - **Tracking**: Monitor referral performance
          - **Analytics**: Detailed referral statistics
          
          ## Referee Benefits
          
          ### Signup Bonus
          
          - **50 points** upon signup with referral code
          - **Full access**: All platform features
          - **Rewards eligible**: All rewards and airdrops
          
          ## Referral Dashboard
          
          Track your referral network:
          
          - **Total Referrals**: Number of active referrals
          - **Referral Volume**: Trading volume from referrals
          - **Earnings**: Total ETH earned from referrals
          - **Leaderboard**: Compare with other referrers
        `
      }
    ]
  },
  {
    id: "explorer",
    title: "Explorer",
    content: `
      Explore Base Chain with our comprehensive blockchain explorer. View transactions, blocks, and wallet activity.
    `,
    subsections: [
      {
        id: "transaction-explorer",
        title: "Transaction Explorer",
        content: `
          Explore and analyze transactions on Base Chain.
          
          ## Transaction Details
          
          ### Transaction Information
          
          - **Transaction Hash**: Unique transaction identifier
          - **Block Number**: Block containing the transaction
          - **From/To Addresses**: Transaction participants
          - **Value**: ETH amount transferred
          - **Gas Used**: Gas consumption
          - **Status**: Success or failure
          - **Timestamp**: Transaction time
          
          ### Token Transfers
          
          - **ERC-20 Transfers**: Token transfers in transaction
          - **NFT Transfers**: NFT movements
          - **Value Breakdown**: Detailed value analysis
          
          ## Block Explorer
          
          ### Block Information
          
          - **Block Number**: Block identifier
          - **Timestamp**: Block creation time
          - **Transactions**: Transaction count
          - **Gas Used**: Total gas in block
          - **Miner**: Block validator
        `
      },
      {
        id: "wallet-explorer",
        title: "Wallet Explorer",
        content: `
          Analyze wallet activity and holdings.
          
          ## Wallet Analysis
          
          ### Wallet Overview
          
          - **Balance**: ETH and token balances
          - **Transaction History**: All transactions
          - **Token Holdings**: ERC-20 token portfolio
          - **NFT Collection**: ERC-721 and ERC-1155 NFTs
          
          ### Activity Analysis
          
          - **Trading Activity**: Swap history
          - **Volume Analysis**: Trading volume over time
          - **Profit/Loss**: Estimated P&L
          - **Top Tokens**: Most traded tokens
        `
      }
    ]
  },
  {
    id: "advanced-orders",
    title: "Advanced Orders",
    content: `
      Set limit orders, stop-loss orders, and other advanced order types for automated trading.
    `,
    subsections: [
      {
        id: "limit-orders",
        title: "Limit Orders",
        content: `
          Execute trades automatically when price conditions are met.
          
          ## Limit Order Types
          
          ### Limit Buy
          
          - **Trigger**: When token price ≤ target price
          - **Action**: Buy token using ETH
          - **Use Case**: Buy at a lower price
          
          ### Limit Sell
          
          - **Trigger**: When token price ≥ target price
          - **Action**: Sell token for ETH
          - **Use Case**: Sell at a higher price
          
          ## Order Management
          
          ### Creating Orders
          
          1. Select order type (buy/sell)
          2. Choose token pair
          3. Set target price
          4. Enter amount
          5. Configure slippage
          6. Set expiration (optional)
          
          ### Order Status
          
          - **PENDING**: Waiting for price condition
          - **EXECUTING**: Condition met, executing swap
          - **EXECUTED**: Order completed
          - **CANCELLED**: Order cancelled by user
          - **EXPIRED**: Order expired
          - **FAILED**: Execution failed
          
          ## Monitoring
          
          Orders are monitored every 5 minutes:
          
          - **Price Checks**: Continuous price monitoring
          - **Condition Evaluation**: Automatic condition checking
          - **Execution**: Automatic order execution
          - **Notifications**: Order status updates
        `,
        codeExamples: [
          {
            language: "javascript",
            code: `// Example: Create limit buy order
const createLimitBuy = async (params) => {
  const response = await fetch('/api/orders/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      walletAddress: params.walletAddress,
      orderType: 'LIMIT_BUY',
      tokenIn: 'ETH',
      tokenOut: params.tokenSymbol,
      tokenInAddress: '0x0000000000000000000000000000000000000000',
      tokenOutAddress: params.tokenAddress,
      amountIn: params.amount,
      targetPrice: params.targetPrice,
      slippage: 0.5,
      goodTillCancel: true
    })
  });
  
  return await response.json();
};`,
            description: "Create a limit buy order"
          }
        ]
      },
      {
        id: "stop-loss",
        title: "Stop-Loss Orders",
        content: `
          Protect your positions with automatic stop-loss orders.
          
          ## Stop-Loss Features
          
          ### Stop-Loss Order
          
          - **Trigger**: When token price ≤ stop price
          - **Action**: Sell token immediately (market order)
          - **Use Case**: Limit losses when price drops
          
          ### Stop-Limit Order (Coming Soon)
          
          - **Trigger**: Stop price hit, then limit price
          - **Action**: Sell at limit price after stop triggers
          - **Use Case**: More control over stop-loss execution
          
          ## Setting Stop-Loss
          
          ### Configuration
          
          1. Select token position
          2. Set stop price
          3. Choose order type (market or limit)
          4. Configure slippage
          5. Confirm order
          
          ### Best Practices
          
          - Set stop-loss at 5-10% below entry price
          - Consider volatility when setting stop price
          - Use trailing stops for profit protection
          - Monitor stop-loss orders regularly
        `
      }
    ]
  },
  {
    id: "trading",
    title: "Trading Guide",
    content: `
      Master trading on CypherX with our comprehensive trading guides and strategies.
    `,
    subsections: [
      {
        id: "swap-execution",
        title: "Swap Execution",
        content: `
          Execute token swaps with optimal pricing and minimal slippage.
          
          ## Swap Process
          
          ### Step-by-Step
          
          1. **Select Tokens**: Choose token pair
          2. **Enter Amount**: Specify swap amount
          3. **Review Quote**: Check price, fees, and impact
          4. **Approve Token** (if needed): Approve token spending
          5. **Confirm Swap**: Execute transaction
          6. **Track Status**: Monitor transaction confirmation
          
          ### Price Routing
          
          CypherX uses 0x Protocol for optimal routing:
          
          - **Multi-DEX Aggregation**: Routes through multiple DEXs
          - **Best Price**: Always gets best available price
          - **Split Routing**: Splits large trades for better execution
          - **Gas Optimization**: Minimizes gas costs
          
          ## Slippage Protection
          
          ### Slippage Settings
          
          - **Default**: 0.5% slippage tolerance
          - **Custom**: Set your own slippage
          - **Auto**: Automatic slippage optimization
          
          ### Price Impact
          
          - **Low Impact**: < 0.1% (green)
          - **Medium Impact**: 0.1-0.5% (yellow)
          - **High Impact**: > 0.5% (red)
          - **Warning**: High impact trades show warnings
          
          ## Gas Optimization
          
          ### Gas Settings
          
          - **Standard**: Normal gas price
          - **Fast**: Higher gas for faster confirmation
          - **Slow**: Lower gas for cost savings
          
          ### Gas Estimation
          
          - Real-time gas price estimates
          - Transaction cost calculation
          - Gas optimization suggestions
        `
      },
      {
        id: "trading-strategies",
        title: "Trading Strategies",
        content: `
          Learn effective trading strategies for Base Chain tokens.
          
          ## Basic Strategies
          
          ### Dollar Cost Averaging (DCA)
          
          - **Strategy**: Buy fixed amounts at regular intervals
          - **Benefits**: Reduces impact of volatility
          - **Implementation**: Use limit orders for automation
          
          ### Buy the Dip
          
          - **Strategy**: Buy when prices drop significantly
          - **Implementation**: Set limit buy orders below current price
          - **Risk Management**: Use stop-loss to protect positions
          
          ## Advanced Strategies
          
          ### Arbitrage
          
          - **Strategy**: Exploit price differences across DEXs
          - **Tools**: Multi-DEX routing helps find opportunities
          - **Timing**: Fast execution is critical
          
          ### Swing Trading
          
          - **Strategy**: Hold positions for days/weeks
          - **Tools**: Charts and technical indicators
          - **Risk Management**: Stop-loss and take-profit orders
        `
      }
    ]
  },
  {
    id: "wallet",
    title: "Wallet Management",
    content: `
      Comprehensive guide to managing your self-custodial wallet and securing your assets.
    `,
    subsections: [
      {
        id: "wallet-setup",
        title: "Wallet Setup",
        content: `
          Set up and secure your self-custodial wallet.
          
          ## Creating a Wallet
          
          ### New Wallet Creation
          
          1. Click "Create Wallet" in wallet dropdown
          2. Save your backup phrase securely
          3. Verify your backup phrase
          4. Set a strong password
          5. Confirm wallet creation
          
          ### Backup Security
          
          **Critical**: Save your backup phrase in a secure location:
          
          - Write it down on paper
          - Store in a safe or vault
          - Never share with anyone
          - Consider multiple backup locations
          
          ## Importing a Wallet
          
          ### Import Options
          
          - **Private Key**: Import using 64-character private key
          - **Backup File**: Import encrypted JSON backup
          - **Recovery Phrase**: Import using 12/24-word mnemonic
          
          ### Import Process
          
          1. Click "Import Wallet"
          2. Choose import method
          3. Enter credentials
          4. Verify wallet address
          5. Access your funds
        `
      },
      {
        id: "wallet-features",
        title: "Wallet Features",
        content: `
          Explore advanced wallet features and capabilities.
          
          ## Asset Management
          
          ### Token Management
          
          - **View Balances**: See all token holdings
          - **Add Custom Tokens**: Add tokens by contract address
          - **Hide Tokens**: Hide tokens from view
          - **Token Details**: View token information
          
          ### Multi-Wallet Support
          
          - **Multiple Wallets**: Manage multiple wallets
          - **Wallet Switching**: Easy wallet switching
          - **Aggregated View**: Combined portfolio view
          
          ## Security Features
          
          ### Security Settings
          
          - **Password Protection**: Wallet password
          - **Session Management**: Active session tracking
          - **Transaction Signing**: Secure transaction approval
          - **Backup Reminders**: Regular backup prompts
          
          ### Best Practices
          
          - **Regular Backups**: Backup wallet regularly
          - **Secure Storage**: Store backups securely
          - **Phishing Protection**: Verify URLs and contracts
          - **Hardware Wallets**: Use hardware wallets for large amounts
        `
      },
      {
        id: "transactions",
        title: "Transaction Management",
        content: `
          Send, receive, and track transactions with your wallet.
          
          ## Sending Tokens
          
          ### Send Process
          
          1. Click "Send" in wallet dropdown
          2. Select token to send
          3. Enter recipient address
          4. Enter amount
          5. Review transaction
          6. Confirm and sign
          
          ### Transaction Fees
          
          - **Gas Fees**: ETH required for transactions
          - **Gas Estimation**: Automatic gas calculation
          - **Gas Optimization**: Efficient gas usage
          
          ## Transaction History
          
          ### Viewing History
          
          - **All Transactions**: Complete transaction list
          - **Filtering**: Filter by type, token, date
          - **Export**: Export transaction data
          - **Details**: Detailed transaction information
        `
      }
    ]
  }
];

export const searchIndex = documentationSections.flatMap(section => {
  const results: Array<{
    id: string;
    title: string;
    content: string;
    type: string;
    parent?: string;
  }> = [
    {
      id: section.id,
      title: section.title,
      content: section.content,
      type: 'section'
    }
  ];
  
  if (section.subsections) {
    section.subsections.forEach(subsection => {
      results.push({
        id: subsection.id,
        title: subsection.title,
        content: subsection.content,
        type: 'subsection',
        parent: section.id
      });
    });
  }
  
  return results;
});
