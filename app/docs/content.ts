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
      
      Key Features
      
      CypherX offers real-time trading with sub-second confirmation times, professional-grade charts with multiple timeframes and indicators, a secure self-custodial wallet with backup and recovery features, and comprehensive market analytics for informed trading decisions.
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
          
          What is CypherX?
          
          CypherX is a decentralized trading platform that provides token trading with minimal slippage and fast execution, professional charting with technical indicators, secure self-custodial wallet integration, and comprehensive market data and insights.
          
          Platform Architecture
          
          CypherX is built on Base Chain and integrates with multiple DEXs including Uniswap V3, Aerodrome, BaseSwap, and PancakeSwap V3. This multi-DEX approach ensures you always get the best prices and liquidity.
        `
      },
      {
        id: "quick-start",
        title: "Quick Start Guide",
        content: `
          Get up and running with CypherX in just a few minutes.
          
          Step 1: Connect Your Wallet
          
          1. Click the "Connect Wallet" button in the header
          2. Use our built-in self-custodial wallet
          3. Approve the connection
          
          Step 2: Explore the Platform
          
          - Trade Page: Browse and trade tokens
          - Radar: Discover trending tokens
          - Charts: View detailed price charts
          
          Step 3: Make Your First Trade
          
          1. Navigate to the Trade page
          2. Select a token pair
          3. Enter the amount you want to swap
          4. Review the transaction details
          5. Confirm the swap
          
          Step 4: Explore Advanced Features
          
          - Set up price alerts
          - Create watchlists
          - Use advanced chart indicators
        `
      },
      {
        id: "installation",
        title: "Installation & Setup",
        content: `
          CypherX is a web-based platform that works in any modern browser. No installation required! Simply visit our website and start trading.
          
          Browser Requirements
          
          CypherX supports all modern browsers. For the best experience, we recommend using Chrome 90+, Firefox 88+, Safari 14+, or Edge 90+.
          
          Getting Started
          
          Step 1: Create Your Wallet
          
          CypherX includes a built-in self-custodial wallet system. When you first visit the platform, you can create a new wallet directly in the app. The wallet creation process is simple and secure:
          
          1. Click on the wallet icon in the header
          2. Choose to create a new wallet
          3. Securely store your recovery phrase
          4. Set a password to protect your wallet
          
          Your wallet is stored locally and encrypted. You have full control of your private keys.
          
          Step 2: Add Base Chain Network
          
          CypherX automatically connects to Base Chain. The network is pre-configured:
          
          Network Details:
          - Network Name: Base
          - RPC URL: https://mainnet.base.org
          - Chain ID: 8453
          - Currency Symbol: ETH
          - Block Explorer: https://cypherx.trade/explorer
          
          No manual network configuration is needed - CypherX handles this automatically.
          
          Step 3: Fund Your Wallet
          
          You'll need ETH on Base Chain for trading fees, gas costs, and token swaps. You can bridge ETH from Ethereum mainnet using the official Base bridge, or purchase ETH directly on Base through various exchanges. Once you have ETH in your wallet, you're ready to start trading!
        `
      },
      {
        id: "first-steps",
        title: "First Steps",
        content: `
          Now that you're set up, let's explore the essential features of CypherX.
          
          Understanding the Interface
Header Navigation
          
          - Trade: Main trading interface
          - Radar: Token discovery and trending
          - Explorer: Block and transaction explorer
Key Components
          
          - Global Search: Search for tokens, addresses, transactions
          - Wallet Display: View balance and manage wallet
          - User Profile: Access settings and preferences
          
          Essential Features
1. Token Trading
          
          The core feature of CypherX:
          
          - Browse available tokens
          - View real-time prices
          - Execute swaps with minimal slippage
          - Track transaction history
2. Real-time Charts
          
          Professional charting capabilities:
          
          - Multiple timeframes (1m to 1d)
          - Technical indicators
          - Drawing tools
          - Price alerts
3. Market Analytics
          
          Comprehensive market data:
          
          - Market cap rankings
          - Volume analysis
          - Price change tracking
          - Liquidity information
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
          CypherX provides a seamless trading experience with lightning-fast execution and minimal slippage. Our platform aggregates liquidity from multiple DEXs to ensure you always get the best prices.
          
          Quick Start Trading
          
          Step-by-Step Trading Process
          
          Step 1: Select Your Tokens
          
          Choose from thousands of tokens on Base Chain. Use our powerful search to find tokens by name, symbol, or contract address. View real-time prices, liquidity, and volume before making your selection.
          
          Step 2: Enter Trade Amount
          
          Specify exactly how much you want to swap. Our interface shows both input and output amounts clearly, with real-time price updates as you type.
          
          Step 3: Review & Confirm
          
          Before executing, review:
          
          - Price Impact: How your trade affects the token price
          - Slippage Tolerance: Maximum acceptable price deviation
          - Gas Fees: Estimated transaction costs
          - Route Details: Which DEXs will be used for optimal pricing
          
          Step 4: Execute & Track
          
          Confirm your swap and track the transaction in real-time. Get instant notifications when your trade completes.
          
          Advanced Trading Features
          
          Smart Price Routing
          
          Our multi-DEX aggregator automatically finds the best prices through route optimization that splits large trades across multiple DEXs, liquidity analysis that chooses routes with deepest liquidity, gas efficiency that minimizes transaction costs, and real-time updates that continuously search for better prices.
          
          Slippage Protection
          
          Protect yourself from unfavorable price movements with custom tolerance settings where you set your own slippage limits (default 0.5%), auto-optimization where the system suggests optimal slippage based on market conditions, and transaction safety where trades automatically fail if slippage exceeds your limit.
          
          Price Impact Analysis
          
          Understand how your trade affects the market with real-time price impact percentage calculation, liquidity visualization to see available liquidity depth, trade size recommendations for optimal trade sizes to minimize impact, and a warning system that alerts for high-impact trades.
          
          Trading Strategies
          
          Market Orders
          
          Execute trades immediately at current market prices. Perfect for:
          
          - Quick entry/exit positions
          - Taking advantage of current prices
          - Time-sensitive trades
          
          Limit Orders (Coming Soon)
          
          Set target prices and let the system execute automatically when conditions are met:
          
          - Limit Buys: Buy when price drops to your target
          - Limit Sells: Sell when price reaches your target
          - Time Limits: Set expiration dates for orders
          
          Advanced Strategies
          
          - DCA (Dollar Cost Averaging): Spread purchases over time
          - Arbitrage Detection: Find price differences across DEXs
          - MEV Protection: Secure your trades from front-running
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
          Professional-grade charting powered by TradingView with multiple timeframes, technical indicators, and real-time market data. Analyze price movements, identify trends, and make informed trading decisions.
          
          Chart Features
          Multiple Timeframes
          
          Analyze price action across different time horizons: 1 minute (1m) for ultra-short term scalping, 5 minutes (5m) for short-term day trading, 15 minutes (15m) for intraday analysis, 1 hour (1h) for swing trading perspective, 4 hours (4h) for medium-term trends, and 1 day (1d) for long-term position analysis.
          
          Chart Types
          
          Choose the visualization that works best for you: Candlestick for traditional OHLCV display showing open, high, low, close, Line Chart for clean price line trend identification, Area Chart for filled price area visual impact, and Volume Bars for trading volume visualization.
          
          Technical Indicators
          
          Moving Averages
          
          Identify trends with:
          
          - SMA (Simple Moving Average): Basic trend indicator
          - EMA (Exponential Moving Average): More responsive to recent prices
          - WMA (Weighted Moving Average): Emphasizes recent data points
Oscillators
          
          Spot overbought/oversold conditions:
          
          - RSI (Relative Strength Index): Momentum indicator (0-100)
          - MACD (Moving Average Convergence Divergence): Trend and momentum
          - Stochastic: Price momentum oscillator
          Trend Indicators
          
          Bollinger Bands show volatility and support/resistance levels. Parabolic SAR indicates trend direction and reversals. Ichimoku Cloud provides comprehensive trend analysis.
          
          Volume Indicators
          
          OBV (On-Balance Volume) shows volume-price relationships. VWAP (Volume Weighted Average Price) serves as an institutional reference price.
          
          Advanced Charting Tools
          Drawing Tools
          
          Mark up your charts with Trend Lines to draw support and resistance levels, Fibonacci Retracements to identify potential reversal points, Price Channels to visualize price ranges, and Annotations to add notes and markers.
          
          Analysis Features
          
          Pattern Recognition automatically identifies chart patterns. Price Projections estimate future price targets. Risk/Reward Calculations help calculate optimal entry/exit points. Multi-Chart View lets you compare multiple tokens side-by-side.
          
          Real-time Updates
          
          Live Price Feeds provide instant price updates as markets move. Transaction Integration shows your trades on the chart. Alert System lets you set price alerts for key levels. Historical Data provides access to complete price history.
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
        id: "discover",
        title: "Discover",
        content: `
          Browse and analyze thousands of tokens on Base Chain with comprehensive filtering and sorting options.
          
          Token Discovery
Browse Tokens
          
          The Discover page displays a comprehensive list of tokens with:
          
          - Token Information: Name, symbol, logo, and contract address
          - Price Data: Current price, 24h change, and price history
          - Market Metrics: Market cap, volume, liquidity, and holders
          - Security Status: Contract verification, liquidity locks, honeypot checks
Filtering Options
          
          Filter tokens by:
          
          - Liquidity: Minimum liquidity thresholds
          - Volume: 24h trading volume filters
          - Age: Token creation date
          - Price Change: 24h price movement
          - Market Cap: Market capitalization ranges
          - Security: Verified contracts, locked liquidity
Sorting Options
          
          Sort tokens by:
          
          - Volume: Highest 24h volume
          - Price Change: Biggest movers
          - Market Cap: Largest market caps
          - Liquidity: Most liquid tokens
          - Age: Newest tokens first
          
          Token Details
          
          Each token has a dedicated page with:
          
          - Price Charts: Interactive charts with multiple timeframes
          - Trading Interface: Quick swap functionality
          - Market Data: Comprehensive metrics and analytics
          - Transaction History: Recent transactions and activity
        `
      },
      {
        id: "radar",
        title: "Radar",
        content: `
          Smart token scanner with AI-powered analysis and customizable alerts.
          
          Scanner Features
Token Scanning
          
          - Real-time Scanning: Continuous token discovery
          - Multi-Criteria Filtering: Advanced filter combinations
          - Security Analysis: Automated security checks
          - Risk Scoring: Comprehensive risk assessment
Security Checks
          
          Automated security analysis:
          
          - Contract Verification: Verified smart contracts
          - Liquidity Locks: Locked liquidity verification
          - Honeypot Detection: Honeypot scanning
          - Rug Pull Risk: Rug pull probability analysis
          - Owner Analysis: Contract owner assessment
          
          Custom Alerts
          
          Set up custom alerts for:
          
          - Price Movements: Price change thresholds
          - Volume Spikes: Unusual volume activity
          - New Listings: New token launches
          - Security Events: Security risk changes
        `
      },
      {
        id: "explorer",
        title: "Explorer",
        content: `
          Monitor the Base Chain network in real-time with comprehensive block and transaction exploration.
          
          Block Explorer
Block Information
          
          View detailed information about each block:
          
          - Block Number: Sequential block identifier
          - Timestamp: Block creation time
          - Transactions: Transaction count and details
          - Gas Used: Total gas consumed
          - Miner: Block validator address
Transaction Details
          
          Explore individual transactions:
          
          - Transaction Hash: Unique transaction identifier
          - From/To Addresses: Sender and recipient
          - Value: Amount transferred
          - Gas Fees: Transaction costs
          - Status: Success or failure
          - Block Number: Associated block
          
          Wallet Explorer
          
          Analyze wallet activity and holdings:
          
          - Balance: ETH and token balances
          - Transaction History: All transactions
          - Token Holdings: ERC-20 token portfolio
Activity Analysis
          
          - Trading Activity: Swap history
          - Volume Analysis: Trading volume over time
          - Profit/Loss: Estimated P&L
          - Top Tokens: Most traded tokens
        `
      },
    ]
  },
  {
    id: "advanced",
    title: "API Reference",
    content: `
      Integrate CypherX data and functionality into your applications with our comprehensive API.
    `,
    subsections: [
      {
        id: "api",
        title: "API Reference",
        content: `
          Integrate CypherX data and functionality into your applications with our comprehensive API.
          
          API Overview
Base URL
          \`\`\`
          https://api.cypherx.trade/v1
          \`\`\`
Authentication
          
          API requests require authentication using API keys:
          
          \`\`\`http
          Authorization: Bearer YOUR_API_KEY
          \`\`\`
Rate Limits
          
          - Free Tier: 1,000 requests/hour
          - Pro Tier: 10,000 requests/hour
          - Enterprise: Custom limits
          
          Endpoints
Market Data
          
          \`\`\`http
          GET /tokens
          GET /tokens/{address}
          GET /tokens/{address}/price
          GET /tokens/{address}/chart
          \`\`\`
Trading
          
          \`\`\`http
          POST /swap/quote
          POST /swap/execute
          GET /swap/history
          \`\`\`
Analytics
          
          \`\`\`http
          GET /analytics/market-metrics
          GET /analytics/token-metrics
          \`\`\`
        `,
        codeExamples: [
          {
            language: "javascript",
            code: `// Example: API client
class CypherXAPI {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseURL = 'https://api.cypherx.trade/v1';
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
          
          Browse Tokens
Token List
          
          The Discover page displays a comprehensive list of tokens with:
          
          - Token Information: Name, symbol, logo, and contract address
          - Price Data: Current price, 24h change, and price history
          - Market Metrics: Market cap, volume, liquidity, and holders
          - Security Status: Contract verification, liquidity locks, honeypot checks
Filtering Options
          
          Filter tokens by:
          
          - Liquidity: Minimum liquidity thresholds
          - Volume: 24h trading volume filters
          - Age: Token creation date
          - Price Change: 24h price movement
          - Market Cap: Market capitalization ranges
          - Security: Verified contracts, locked liquidity
Sorting Options
          
          Sort tokens by:
          
          - Volume: Highest 24h volume
          - Price Change: Biggest movers
          - Market Cap: Largest market caps
          - Liquidity: Most liquid tokens
          - Age: Newest tokens first
          
          Token Details
Token Page
          
          Each token has a dedicated page with:
          
          - Price Chart: Interactive TradingView charts
          - Market Data: Comprehensive market metrics
          - Trading Interface: Quick swap functionality
          - Transaction History: Recent transactions
          - Holder Analysis: Top holders and distribution
          - Security Audit: Contract verification status
Chart Analysis
          
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
          
          Quick Buy Features
Instant Swaps
          
          - 1-Click Execution: Swap tokens instantly
          - Best Price Routing: Automatic DEX aggregation
          - Slippage Protection: Configurable slippage tolerance
          - Gas Optimization: Efficient transaction routing
Quick Buy Configuration
          
          Customize your quick buy settings:
          
          - Default Amounts: Set preset swap amounts
          - Slippage Tolerance: Configure default slippage
          - Gas Preferences: Fast, standard, or slow
          - Token Preferences: Favorite tokens for quick access
          
          Trading Flow
          
          1. Select Token: Choose from trending or search
          2. Enter Amount: Specify swap amount
          3. Review: Check price impact and fees
          4. Confirm: Execute the swap
          5. Track: Monitor transaction status
        `
      },
      {
        id: "smart-scanner",
        title: "Smart Scanner",
        content: `
          AI-powered token scanning with advanced filtering and security analysis.
          
          Scanner Features
Token Scanning
          
          - Real-time Scanning: Continuous token discovery
          - Multi-Criteria Filtering: Advanced filter combinations
          - Security Analysis: Automated security checks
          - Risk Scoring: Comprehensive risk assessment
Security Checks
          
          Automated security analysis:
          
          - Contract Verification: Verified smart contracts
          - Liquidity Locks: Locked liquidity verification
          - Honeypot Detection: Honeypot scanning
          - Rug Pull Risk: Rug pull probability analysis
          - Owner Analysis: Contract owner assessment
          
          Custom Alerts
          
          Set up custom alerts for:
          
          - Price Movements: Price change thresholds
          - Volume Spikes: Unusual volume activity
          - New Listings: New token launches
          - Security Events: Security risk changes
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
          
          Portfolio Metrics
Total Value
          
          - Portfolio Value: Total USD value of all holdings
          - P&L: Profit and loss tracking
          - 24h Change: Daily portfolio performance
          - All-Time Performance: Historical P&L
Multi-Wallet Support
          
          - Wallet Aggregation: View multiple wallets in one dashboard
          - Wallet Switching: Easily switch between wallets
          - Combined Analytics: Aggregate metrics across wallets
          - Individual Tracking: Per-wallet breakdown
          
          Position Tracking
Open Positions
          
          Track your active positions:
          
          - Token Holdings: Current token balances
          - Entry Price: Average entry price
          - Current Price: Real-time token prices
          - Unrealized P&L: Current profit/loss
          - ROI: Return on investment percentage
Closed Positions
          
          Historical position data:
          
          - Trade History: All closed positions
          - Realized P&L: Actualized profits/losses
          - Trade Analytics: Win rate, average return
          - Tax Reporting: Export for tax purposes
        `
      },
      {
        id: "analytics",
        title: "Trading Analytics",
        content: `
          Deep dive into your trading performance with comprehensive analytics.
          
          Performance Metrics
Trading Statistics
          
          - Total Trades: Number of completed swaps
          - Win Rate: Percentage of profitable trades
          - Average Trade Size: Mean transaction value
          - Total Volume: Cumulative trading volume
          - Fees Paid: Total fees and gas costs
Timeframe Analysis
          
          Analyze performance over:
          
          - 7 Days: Weekly performance
          - 30 Days: Monthly performance
          - 90 Days: Quarterly performance
          - All Time: Complete trading history
          
          P&L Calendar
          
          Visualize your trading activity:
          
          - Daily P&L: Profit/loss by day
          - Heat Map: Visual performance calendar
          - Best Days: Top performing trading days
          - Trend Analysis: Performance trends over time
        `
      },
      {
        id: "wallet-management",
        title: "Wallet Management",
        content: `
          Manage multiple wallets and track their performance in one unified dashboard.
          
          Multi-Wallet Support
Wallet Aggregation
          
          Connect and manage multiple wallets:
          
          - Add Wallets: Import wallets via private key or create new wallets
          - Wallet Switching: Seamlessly switch between connected wallets
          - Combined View: See aggregated portfolio value across all wallets
          - Individual Breakdown: View detailed metrics for each wallet separately
Wallet Performance
          
          Track performance metrics per wallet:
          
          - Portfolio Value: Total value per wallet
          - Trading Activity: Swap history and volume per wallet
          - P&L Tracking: Profit and loss calculations per wallet
          - Token Holdings: Complete token inventory per wallet
          
          Position Management
Active Positions
          
          Monitor all open positions across wallets:
          
          - Token Positions: Current holdings with entry prices
          - Unrealized P&L: Live profit/loss calculations
          - Position Size: Amount and value of each position
          - Price Alerts: Set alerts for position targets
Position Analytics
          
          - Average Entry Price: Weighted average across all buys
          - Current Value: Real-time position valuation
          - ROI Percentage: Return on investment metrics
          - Hold Duration: Time since position entry
        `
      },
      {
        id: "performance-insights",
        title: "Performance Insights",
        content: `
          Gain deep insights into your trading performance with advanced analytics and visualizations.
          
          Trading Statistics
Key Metrics
          
          - Total Trades: Complete count of all executed swaps
          - Win Rate: Percentage of profitable trades
          - Average Trade Size: Mean transaction value
          - Total Volume: Cumulative trading volume in USD
          - Total Fees: Sum of all platform and gas fees paid
Performance Breakdown
          
          Analyze your trading by:
          
          - Time Period: Daily, weekly, monthly, and all-time stats
          - Token Performance: Best and worst performing tokens
          - Trade Frequency: Trading activity patterns
          - Profit Distribution: Distribution of profitable vs losing trades
          
          Visual Analytics
P&L Calendar
          
          Visual heat map showing:
          
          - Daily Performance: Color-coded profit/loss by day
          - Best Trading Days: Identify your most profitable days
          - Trend Patterns: Spot trends in your trading performance
          - Activity Frequency: See when you trade most actively
Performance Charts
          
          Interactive charts displaying:
          
          - Portfolio Value Over Time: Historical portfolio growth
          - Cumulative P&L: Running profit/loss calculation
          - Trade Volume Trends: Trading volume patterns
          - Win Rate Trends: Success rate over time
        `
      },
      {
        id: "tax-reporting",
        title: "Tax Reporting",
        content: `
          Generate comprehensive tax reports for your trading activity.
          
          Tax Features
Report Generation
          
          - CSV Export: Download transaction data
          - Tax Year Selection: Filter by tax year
          - Transaction Details: Complete trade history
          - Cost Basis Tracking: Calculate cost basis
Tax Categories
          
          - Realized Gains: Profits from closed positions
          - Realized Losses: Losses from closed positions
          - Unrealized P&L: Current position values
          - Fees & Gas: Trading costs
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
          
          Tier Levels
Tier 1: Normie (0-1,999 points)
          
          - Swap Fee: 0.75%
          - Cashback Rate: 5% of net platform fee
          - Airdrop Allocation: 1x
          - Benefits: Basic platform access
Tier 2: Degen (2,000-7,999 points)
          
          - Swap Fee: 0.60%
          - Cashback Rate: 10% of net platform fee
          - Airdrop Allocation: 1.5x
          - Benefits: Reduced fees, higher cashback
Tier 3: Alpha (8,000-19,999 points)
          
          - Swap Fee: 0.45%
          - Cashback Rate: 15% of net platform fee
          - Airdrop Allocation: 2x
          - Benefits: Priority support, exclusive features
Tier 4: Mogul (20,000-49,999 points)
          
          - Swap Fee: 0.30%
          - Cashback Rate: 20% of net platform fee
          - Airdrop Allocation: 3x
          - Benefits: VIP access, exclusive events
Tier 5: Titan (50,000+ points)
          
          - Swap Fee: 0.20%
          - Cashback Rate: 25% of net platform fee
          - Airdrop Allocation: 5x
          - Benefits: Maximum benefits, governance rights
          
          Earning Points
Trading Rewards
          
          - 0.1 points per $1 traded: Earn points on every swap
          - No cap: Unlimited point accumulation
          - Real-time updates: Points credited immediately
Streak Multipliers
          
          - Daily Trading Streaks: Maintain daily trading activity
          - Multiplier Bonuses: Increase point earnings
          - Streak Rewards: Bonus points for streaks
        `
      },
      {
        id: "cashback",
        title: "Cashback System",
        content: `
          Earn ETH cashback on every trade based on your tier level.
          
          Cashback Calculation
Fee Structure
          
          - Platform Fee: 0.75% of swap value
          - 0x Protocol Fee: 0.15% (deducted)
          - Net Platform Fee: 0.60% available for cashback
          - Cashback: Net Fee × Tier Cashback Rate
Example Calculation
          
          For a $1,000 swap at Alpha tier (15% cashback):
          
          - Platform Fee: $7.50
          - 0x Fee: $1.50
          - Net Fee: $6.00
          - Cashback: $6.00 × 15% = $0.90 ETH
          
          Cashback Features
          
          - Automatic Crediting: Cashback added to rewards balance
          - Withdrawable: Withdraw ETH rewards anytime
          - No Minimum: No minimum withdrawal threshold
          - Real-time Tracking: Monitor cashback accumulation
        `
      },
      {
        id: "referrals",
        title: "Referral Program",
        content: `
          Earn rewards by referring new users to CypherX.
          
          Referrer Rewards
Earning Structure
          
          - 30% of net platform fee from referred user's swaps
          - Lifetime rewards: Earn from referral network forever
          - No limit: Unlimited referrals
          - ETH rewards: Rewards paid in ETH
Referral Code
          
          - Unique Code: Format: CYPHERX[6 alphanumeric]
          - Shareable Link: Generate referral links
          - Tracking: Monitor referral performance
          - Analytics: Detailed referral statistics
          
          Referee Benefits
Signup Bonus
          
          - 50 points upon signup with referral code
          - Full access: All platform features
          - Rewards eligible: All rewards and airdrops
          
          Referral Dashboard
          
          Track your referral network:
          
          - Total Referrals: Number of active referrals
          - Referral Volume: Trading volume from referrals
          - Earnings: Total ETH earned from referrals
          - Leaderboard: Compare with other referrers
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
          
          Transaction Details
Transaction Information
          
          - Transaction Hash: Unique transaction identifier
          - Block Number: Block containing the transaction
          - From/To Addresses: Transaction participants
          - Value: ETH amount transferred
          - Gas Used: Gas consumption
          - Status: Success or failure
          - Timestamp: Transaction time
Token Transfers
          
          - ERC-20 Transfers: Token transfers in transaction
          - Value Breakdown: Detailed value analysis
          
          Block Explorer
Block Information
          
          - Block Number: Block identifier
          - Timestamp: Block creation time
          - Transactions: Transaction count
          - Gas Used: Total gas in block
          - Miner: Block validator
        `
      },
      {
        id: "wallet-explorer",
        title: "Wallet Explorer",
        content: `
          Analyze wallet activity and holdings.
          
          Wallet Analysis
Wallet Overview
          
          - Balance: ETH and token balances
          - Transaction History: All transactions
          - Token Holdings: ERC-20 token portfolio
          - NFT Collection: ERC-721 and ERC-1155 NFTs
Activity Analysis
          
          - Trading Activity: Swap history
          - Volume Analysis: Trading volume over time
          - Profit/Loss: Estimated P&L
          - Top Tokens: Most traded tokens
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
          
          Swap Process
Step-by-Step
          
          1. Select Tokens: Choose token pair
          2. Enter Amount: Specify swap amount
          3. Review Quote: Check price, fees, and impact
          4. Approve Token (if needed): Approve token spending
          5. Confirm Swap: Execute transaction
          6. Track Status: Monitor transaction confirmation
Price Routing
          
          CypherX uses 0x Protocol for optimal routing:
          
          - Multi-DEX Aggregation: Routes through multiple DEXs
          - Best Price: Always gets best available price
          - Split Routing: Splits large trades for better execution
          - Gas Optimization: Minimizes gas costs
          
          Slippage Protection
Slippage Settings
          
          - Default: 0.5% slippage tolerance
          - Custom: Set your own slippage
          - Auto: Automatic slippage optimization
Price Impact
          
          - Low Impact: < 0.1% (green)
          - Medium Impact: 0.1-0.5% (yellow)
          - High Impact: > 0.5% (red)
          - Warning: High impact trades show warnings
          
          Gas Optimization
Gas Settings
          
          - Standard: Normal gas price
          - Fast: Higher gas for faster confirmation
          - Slow: Lower gas for cost savings
Gas Estimation
          
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
          
          Basic Strategies
Dollar Cost Averaging (DCA)
          
          - Strategy: Buy fixed amounts at regular intervals
          - Benefits: Reduces impact of volatility
          - Implementation: Use limit orders for automation
Buy the Dip
          
          - Strategy: Buy when prices drop significantly
          - Implementation: Set limit buy orders below current price
          - Risk Management: Use stop-loss to protect positions
          
          Advanced Strategies
Arbitrage
          
          - Strategy: Exploit price differences across DEXs
          - Tools: Multi-DEX routing helps find opportunities
          - Timing: Fast execution is critical
Swing Trading
          
          - Strategy: Hold positions for days/weeks
          - Tools: Charts and technical indicators
          - Risk Management: Stop-loss and take-profit orders
        `
      },
      {
        id: "limit-orders",
        title: "Limit Orders",
        content: `
          Execute trades automatically when price conditions are met.
          
          Limit Order Types
Limit Buy
          
          - Trigger: When token price ≤ target price
          - Action: Buy token using ETH
          - Use Case: Buy at a lower price
Limit Sell
          
          - Trigger: When token price ≥ target price
          - Action: Sell token for ETH
          - Use Case: Sell at a higher price
          
          Order Management
Creating Orders
          
          1. Select order type (buy/sell)
          2. Choose token pair
          3. Set target price
          4. Enter amount
          5. Configure slippage
          6. Set expiration (optional)
Order Status
          
          - PENDING: Waiting for price condition
          - EXECUTING: Condition met, executing swap
          - EXECUTED: Order completed
          - CANCELLED: Order cancelled by user
          - EXPIRED: Order expired
          - FAILED: Execution failed
          
          Monitoring
          
          Orders are monitored every 5 minutes:
          
          - Price Checks: Continuous price monitoring
          - Condition Evaluation: Automatic condition checking
          - Execution: Automatic order execution
          - Notifications: Order status updates
        `
      },
      {
        id: "stop-loss",
        title: "Stop-Loss Orders",
        content: `
          Protect your positions with automatic stop-loss orders.
          
          Stop-Loss Features
Stop-Loss Order
          
          - Trigger: When token price ≤ stop price
          - Action: Sell token immediately (market order)
          - Use Case: Limit losses when price drops
Stop-Limit Order (Coming Soon)
          
          - Trigger: Stop price hit, then limit price
          - Action: Sell at limit price after stop triggers
          - Use Case: More control over stop-loss execution
          
          Setting Stop-Loss
Configuration
          
          1. Select token position
          2. Set stop price
          3. Choose order type (market or limit)
          4. Configure slippage
          5. Confirm order
Best Practices
          
          - Set stop-loss at 5-10% below entry price
          - Consider volatility when setting stop price
          - Use trailing stops for profit protection
          - Monitor stop-loss orders regularly
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
          
          Creating a Wallet
New Wallet Creation
          
          1. Click "Create Wallet" in wallet dropdown
          2. Save your backup phrase securely
          3. Verify your backup phrase
          4. Set a strong password
          5. Confirm wallet creation
Backup Security
          
          Critical: Save your backup phrase in a secure location:
          
          - Write it down on paper
          - Store in a safe or vault
          - Never share with anyone
          - Consider multiple backup locations
          
          Importing a Wallet
Import Options
          
          - Private Key: Import using 64-character private key
          - Backup File: Import encrypted JSON backup
          - Recovery Phrase: Import using 12/24-word mnemonic
Import Process
          
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
          
          Asset Management
Token Management
          
          - View Balances: See all token holdings
          - Add Custom Tokens: Add tokens by contract address
          - Hide Tokens: Hide tokens from view
          - Token Details: View token information
Multi-Wallet Support
          
          - Multiple Wallets: Manage multiple wallets
          - Wallet Switching: Easy wallet switching
          - Aggregated View: Combined portfolio view
          
          Security Features
Security Settings
          
          - Password Protection: Wallet password
          - Session Management: Active session tracking
          - Transaction Signing: Secure transaction approval
          - Backup Reminders: Regular backup prompts
Best Practices
          
          - Regular Backups: Backup wallet regularly
          - Secure Storage: Store backups securely
          - Phishing Protection: Verify URLs and contracts
          - Hardware Wallets: Use hardware wallets for large amounts
        `
      },
      {
        id: "transactions",
        title: "Transaction Management",
        content: `
          Send, receive, and track transactions with your wallet.
          
          Sending Tokens
Send Process
          
          1. Click "Send" in wallet dropdown
          2. Select token to send
          3. Enter recipient address
          4. Enter amount
          5. Review transaction
          6. Confirm and sign
Transaction Fees
          
          - Gas Fees: ETH required for transactions
          - Gas Estimation: Automatic gas calculation
          - Gas Optimization: Efficient gas usage
          
          Transaction History
Viewing History
          
          - All Transactions: Complete transaction list
          - Filtering: Filter by type, token, date
          - Export: Export transaction data
          - Details: Detailed transaction information
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


