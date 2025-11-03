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
