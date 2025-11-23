import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

interface PnLData {
  date: string;
  totalValue: number;
  pnl: number;
  pnlPercentage: number;
  trades: number;
  volume: number;
}

interface Trade {
  id: string;
  type: "buy" | "sell";
  token: string;
  amount: number;
  price: number;
  value: number;
  timestamp: number;
  gasCost: number;
}

interface FirestoreTradeData {
  timestamp: { toDate: () => Date };
  inputToken: string;
  inputValue: number;
  [key: string]: unknown;
}

interface FirestoreTrade {
  data?: () => FirestoreTradeData;
  [key: string]: unknown;
}

interface PnLResponse {
  pnlData: PnLData[];
  trades: Trade[];
  totalPnL: number;
  totalPnLPercentage: number;
  totalVolume: number;
  totalTrades: number;
  winRate: number;
  bought: number;
  sold: number;
  holding: number;
  positionsClosed: number; // 🔧 NEW: Track closed positions
  completedTrades: number; // 🔧 NEW: Track completed trades
  dailyPnL: Array<{ date: string; pnl: number }>;
  recentTrades: Array<{
    id: string;
    tokenIn: string;
    tokenOut: string;
    amountIn: string;
    amountOut: string;
    timestamp: number;
    type: 'buy' | 'sell';
    status: 'completed' | 'pending' | 'failed'; // 🔧 NEW: Trade status
  }>;
  positionsHistory: Array<{ // 🔧 NEW: Positions history
    tokenAddress: string;
    tokenSymbol: string;
    entryPrice: number;
    exitPrice: number;
    amount: number;
    pnl: number;
    pnlPercentage: number;
    entryDate: string;
    exitDate: string;
    status: 'open' | 'closed';
  }>;
}

// Get ETH price for USD conversion
async function getEthPrice(): Promise<number> {
  try {
    const response = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd");
    const data = await response.json();
    return data.ethereum?.usd || 0;
  } catch (error) {
    console.error("Error fetching ETH price:", error);
    return 0;
  }
}

// Get token price from DexScreener
async function getTokenPrice(tokenAddress: string): Promise<number> {
  if (tokenAddress === "0x0000000000000000000000000000000000000000") {
    return await getEthPrice();
  }

  try {
    const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`);
    const data = await response.json();
    const pair = data.pairs?.[0];
    return pair?.priceUsd ? parseFloat(pair.priceUsd) : 0;
  } catch (error) {
    console.error("Error fetching token price:", error);
    return 0;
  }
}

// Calculate PnL for a trade
function calculateTradePnL(trade: { type: string; price: number; amount: number; gasCost: number }, currentPrice: number): number {
  if (trade.type === "buy") {
    return (currentPrice - trade.price) * trade.amount - trade.gasCost;
  } else {
    return (trade.price - currentPrice) * trade.amount - trade.gasCost;
  }
}

// Group trades by date
function groupTradesByDate(trades: FirestoreTrade[]): Record<string, FirestoreTradeData[]> {
  const grouped: Record<string, FirestoreTradeData[]> = {};
  
  trades.forEach(trade => {
    const data = trade.data ? trade.data() : trade as FirestoreTradeData;
    const date = new Date(data.timestamp.toDate()).toISOString().split('T')[0];
    if (!grouped[date]) {
      grouped[date] = [];
    }
    grouped[date].push(data);
  });
  
  return grouped;
}

// Calculate daily PnL data
async function calculateDailyPnL(trades: any[]): Promise<PnLData[]> {
  const groupedTrades = groupTradesByDate(trades);
  const dates = Object.keys(groupedTrades).sort();
  
  const pnlData: PnLData[] = [];
  let runningValue = 0;
  let runningPnL = 0;
  
  for (const date of dates) {
    const dayTrades = groupedTrades[date];
    let dayVolume = 0;
    let dayPnL = 0;
    
    for (const trade of dayTrades) {
      // Calculate current price for PnL
      const currentPrice = await getTokenPrice(trade.inputToken === "ETH" ? "0x0000000000000000000000000000000000000000" : trade.inputToken);
      
      dayVolume += trade.inputValue || 0;
      dayPnL += calculateTradePnL(trade as any, currentPrice);
    }
    
    runningValue += dayVolume;
    runningPnL += dayPnL;
    
    pnlData.push({
      date,
      totalValue: runningValue,
      pnl: runningPnL,
      pnlPercentage: runningValue > 0 ? (runningPnL / runningValue) * 100 : 0,
      trades: dayTrades.length,
      volume: dayVolume
    });
  }
  
  return pnlData;
}

// Calculate daily P&L change (not cumulative) - net realized P&L for trades executed each day
async function calculateDailyPnLChange(trades: any[]): Promise<Array<{ date: string; pnl: number }>> {
  const groupedTrades = groupTradesByDate(trades);
  const dates = Object.keys(groupedTrades).sort();
  
  const dailyPnL: Array<{ date: string; pnl: number }> = [];
  
  // Track positions to calculate realized P&L
  const positions = new Map<string, Array<{ price: number; amount: number; timestamp: number }>>();
  
  for (const date of dates) {
    const dayTrades = groupedTrades[date];
    let dayPnL = 0;
    
    for (const trade of dayTrades) {
      // Get trade data (handle both Firestore document format and plain object)
      const tradeData = (typeof trade.data === 'function' ? trade.data() : trade) || trade;
      const isBuy = tradeData.inputToken === "ETH" || tradeData.inputToken === "0x0000000000000000000000000000000000000000";
      const tokenAddress = isBuy ? tradeData.outputToken : tradeData.inputToken;
      const outputAmount = parseFloat(tradeData.outputAmount || "0");
      const inputAmount = parseFloat(tradeData.inputAmount || "0");
      const amount = isBuy ? outputAmount : inputAmount;
      const outputValue = tradeData.outputValue || 0;
      const inputValue = tradeData.inputValue || 0;
      const price = isBuy 
        ? (outputAmount > 0 ? outputValue / outputAmount : 0)
        : (inputAmount > 0 ? inputValue / inputAmount : 0);
      const value = isBuy ? inputValue : outputValue;
      const gasCost = tradeData.gasCostUsd || 0;
      const timestamp = tradeData.timestamp?.toDate ? tradeData.timestamp.toDate().getTime() : Date.now();
      
      if (isBuy) {
        // Buy: add to positions
        if (!positions.has(tokenAddress)) {
          positions.set(tokenAddress, []);
        }
        positions.get(tokenAddress)!.push({ price, amount, timestamp });
        // Buy reduces P&L by the amount spent (including gas)
        dayPnL -= (value + gasCost);
      } else {
        // Sell: calculate realized P&L using FIFO
        if (positions.has(tokenAddress) && positions.get(tokenAddress)!.length > 0) {
          const tokenPositions = positions.get(tokenAddress)!;
          let remainingToSell = amount;
          let realizedPnL = 0;
          
          while (remainingToSell > 0 && tokenPositions.length > 0) {
            const position = tokenPositions[0];
            const sellAmount = Math.min(remainingToSell, position.amount);
            const costBasis = position.price * sellAmount;
            const saleValue = (value / amount) * sellAmount;
            realizedPnL += (saleValue - costBasis);
            
            position.amount -= sellAmount;
            remainingToSell -= sellAmount;
            
            if (position.amount <= 0) {
              tokenPositions.shift();
            }
          }
          
          // Add realized P&L and subtract gas cost
          dayPnL += (realizedPnL - gasCost);
        } else {
          // Selling without a position (shouldn't happen, but handle it)
          dayPnL += (value - gasCost);
        }
      }
    }
    
    dailyPnL.push({
      date,
      pnl: dayPnL
    });
  }
  
  return dailyPnL;
}



export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get("address");
    const tokenAddress = searchParams.get("tokenAddress"); // Add token address parameter
    
    if (!address) {
      return NextResponse.json(
        { error: "Missing wallet address" },
        { status: 400 }
      );
    }
    
    const db = adminDb();
    if (!db) {
      return NextResponse.json(
        { error: "Database connection failed" },
        { status: 500 }
      );
    }
    
    // Fetch wallet transactions for specific token if provided
    let transactionsQuery = db.collection("wallet_transactions")
      .where("walletAddress", "==", address)
      .where("type", "==", "swap");
    
    // If token address is provided, filter by that specific token
    if (tokenAddress) {
      transactionsQuery = transactionsQuery.where("outputToken", "==", tokenAddress);
    }
    
    transactionsQuery = transactionsQuery.orderBy("timestamp", "desc");
    
    const transactionsSnapshot = await transactionsQuery.get();
    
    if (transactionsSnapshot.empty) {
      return NextResponse.json({
        pnlData: [],
        trades: [],
        totalPnL: 0,
        totalPnLPercentage: 0,
        totalVolume: 0,
        totalTrades: 0,
        winRate: 0,
        bought: 0,
        sold: 0,
        holding: 0,
        positionsClosed: 0,
        completedTrades: 0,
        dailyPnL: [],
        recentTrades: [],
        positionsHistory: []
      });
    }
    
    // Convert to trades format
    const trades: Trade[] = transactionsSnapshot.docs.map(doc => {
      const data = doc.data();
      // Improved logic: A buy is when someone sends ETH or another base token to the pool
      // This works for both ETH pairs and non-ETH pairs (like USDC pairs)
      const isBuy = data.inputToken === "ETH" || data.inputToken === "0x0000000000000000000000000000000000000000";
      return {
        id: doc.id,
        type: isBuy ? "buy" : "sell",
        token: data.outputToken,
        amount: parseFloat(data.outputAmount),
        price: data.outputValue / parseFloat(data.outputAmount),
        // For buy transactions, use the ETH value spent (inputValue)
        // For sell transactions, use the ETH value received (outputValue)
        value: isBuy ? data.inputValue : data.outputValue,
        timestamp: data.timestamp.toDate().getTime(),
        gasCost: data.gasCostUsd || 0
      };
    });
    

    
    // Calculate PnL data
    const pnlData = await calculateDailyPnL(transactionsSnapshot.docs);
    
    // Calculate daily P&L change (for calendar view)
    const dailyPnLChange = await calculateDailyPnLChange(transactionsSnapshot.docs);
    
    // Calculate totals
    const totalVolume = trades.reduce((sum, trade) => sum + trade.value, 0);
    const totalTrades = trades.length;
    
    // Get buy and sell transactions for calculations (need this first)
    const buyTransactions = trades.filter(t => t.type === "buy");
    const sellTransactions = trades.filter(t => t.type === "sell");
    
    // Calculate total PnL properly: Realized P&L + Unrealized P&L
    // Track positions using FIFO
    const positions = new Map<string, Array<{ price: number; amount: number; timestamp: number }>>();
    let totalPnL = 0; // Realized + Unrealized P&L
    
    // Process trades in chronological order to calculate realized and unrealized P&L
    const sortedTrades = [...trades].sort((a, b) => a.timestamp - b.timestamp);
    
    for (const trade of sortedTrades) {
      const tokenAddress = trade.token;
      
      if (trade.type === "buy") {
        // Buy: add to positions
        if (!positions.has(tokenAddress)) {
          positions.set(tokenAddress, []);
        }
        positions.get(tokenAddress)!.push({
          price: trade.price,
          amount: trade.amount,
          timestamp: trade.timestamp
        });
        // Buy doesn't directly affect P&L, we track cost basis
        // P&L will be calculated when we sell or from current holdings
      } else {
        // Sell: calculate realized P&L using FIFO
        if (positions.has(tokenAddress) && positions.get(tokenAddress)!.length > 0) {
          const tokenPositions = positions.get(tokenAddress)!;
          let remainingToSell = trade.amount;
          
          while (remainingToSell > 0 && tokenPositions.length > 0) {
            const position = tokenPositions[0];
            const sellAmount = Math.min(remainingToSell, position.amount);
            const costBasis = position.price * sellAmount;
            const saleValue = (trade.value / trade.amount) * sellAmount;
            const realizedPnL = saleValue - costBasis - (trade.gasCost * (sellAmount / trade.amount));
            
            totalPnL += realizedPnL;
            
            position.amount -= sellAmount;
            remainingToSell -= sellAmount;
            
            if (position.amount <= 0) {
              tokenPositions.shift();
            }
          }
        }
      }
    }
    
    // Calculate unrealized P&L from remaining positions (current holdings)
    for (const [tokenAddress, tokenPositions] of positions.entries()) {
      if (tokenPositions.length > 0) {
        // Get current price for this token
        const currentPrice = await getTokenPrice(tokenAddress === "ETH" ? "0x0000000000000000000000000000000000000000" : tokenAddress);
        
        // Calculate unrealized P&L for all remaining positions of this token
        for (const position of tokenPositions) {
          if (position.amount > 0 && currentPrice > 0) {
            const unrealizedPnL = (currentPrice - position.price) * position.amount;
            totalPnL += unrealizedPnL;
          }
        }
      }
    }
    
    // Calculate total P&L percentage based on total invested (bought amount)
    const totalInvested = buyTransactions.reduce((sum, t) => sum + t.value, 0);
    const totalPnLPercentage = totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0;
    
    // Calculate win rate based on realized P&L from sell transactions
    let winRate = 0;
    if (sellTransactions.length > 0) {
      // Recalculate to count winning trades based on realized P&L
      const positionsForWinRate = new Map<string, Array<{ price: number; amount: number }>>();
      let winningTrades = 0;
      
      for (const trade of sortedTrades) {
        if (trade.type === "buy") {
          if (!positionsForWinRate.has(trade.token)) {
            positionsForWinRate.set(trade.token, []);
          }
          positionsForWinRate.get(trade.token)!.push({ price: trade.price, amount: trade.amount });
        } else if (trade.type === "sell") {
          if (positionsForWinRate.has(trade.token) && positionsForWinRate.get(trade.token)!.length > 0) {
            const tokenPositions = positionsForWinRate.get(trade.token)!;
            let remainingToSell = trade.amount;
            let tradeRealizedPnL = 0;
            
            while (remainingToSell > 0 && tokenPositions.length > 0) {
              const position = tokenPositions[0];
              const sellAmount = Math.min(remainingToSell, position.amount);
              const costBasis = position.price * sellAmount;
              const saleValue = (trade.value / trade.amount) * sellAmount;
              tradeRealizedPnL += (saleValue - costBasis);
              
              position.amount -= sellAmount;
              remainingToSell -= sellAmount;
              
              if (position.amount <= 0) {
                tokenPositions.shift();
              }
            }
            
            if (tradeRealizedPnL > 0) {
              winningTrades++;
            }
          }
        }
      }
      
      winRate = sellTransactions.length > 0 ? (winningTrades / sellTransactions.length) * 100 : 0;
    }
    
    // Calculate actual amounts instead of transaction counts
    
    let bought = 0;
    let sold = 0;
    
    if (tokenAddress) {
      // For specific token, calculate actual USD amounts spent/received
      const tokenBuyTransactions = buyTransactions.filter(t => t.token === tokenAddress);
      const tokenSellTransactions = sellTransactions.filter(t => t.token === tokenAddress);
      
      // Calculate total USD spent on buying this token
      bought = tokenBuyTransactions.reduce((sum, t) => sum + t.value, 0);
      
      // Calculate total USD received from selling this token
      sold = tokenSellTransactions.reduce((sum, t) => sum + t.value, 0);
    } else {
      // For overall portfolio, calculate total USD amounts spent/received
      bought = buyTransactions.reduce((sum, t) => sum + t.value, 0);
      sold = sellTransactions.reduce((sum, t) => sum + t.value, 0);
    }
    
    // Format to 1 decimal place
    bought = parseFloat(bought.toFixed(1));
    sold = parseFloat(sold.toFixed(1));
    
    // Calculate actual holding amount (not just transaction count)
    let holding = 0;
    if (tokenAddress) {
      // For specific token, calculate current USD value of tokens held
      const tokenBuyAmount = buyTransactions
        .filter(t => t.token === tokenAddress)
        .reduce((sum, t) => sum + t.amount, 0);
      
      const tokenSellAmount = sellTransactions
        .filter(t => t.token === tokenAddress)
        .reduce((sum, t) => sum + t.amount, 0);
      
      const remainingAmount = tokenBuyAmount - tokenSellAmount;
      if (remainingAmount > 0) {
        const currentPrice = await getTokenPrice(tokenAddress === "ETH" ? "0x0000000000000000000000000000000000000000" : tokenAddress);
        holding = parseFloat((remainingAmount * currentPrice).toFixed(1));
      } else {
        holding = 0;
      }
    } else {
      // For overall portfolio, calculate total value of holdings
      const uniqueTokens = [...new Set(buyTransactions.map(t => t.token))];
      let totalHoldingValue = 0;
      
      for (const tokenAddr of uniqueTokens) {
        const tokenBuyAmount = buyTransactions
          .filter(t => t.token === tokenAddr)
          .reduce((sum, t) => sum + t.amount, 0);
        
        const tokenSellAmount = sellTransactions
          .filter(t => t.token === tokenAddr)
          .reduce((sum, t) => sum + t.amount, 0);
        
        const remainingAmount = tokenBuyAmount - tokenSellAmount;
        if (remainingAmount > 0) {
          const currentPrice = await getTokenPrice(tokenAddr === "ETH" ? "0x0000000000000000000000000000000000000000" : tokenAddr);
          totalHoldingValue += remainingAmount * currentPrice;
        }
      }
      holding = parseFloat(totalHoldingValue.toFixed(1));
    }
    
    // 🔧 NEW: Calculate positions closed and completed trades
    const positionsClosed = sellTransactions.length; // Count of sell transactions
    const completedTrades = totalTrades; // All trades are completed
    
    // 🔧 NEW: Generate positions history
    const positionsHistory = [];
    const tokenGroups = new Map();
    
    // Group trades by token
    for (const trade of trades) {
      if (!tokenGroups.has(trade.token)) {
        tokenGroups.set(trade.token, { buys: [], sells: [] });
      }
      if (trade.type === 'buy') {
        tokenGroups.get(trade.token).buys.push(trade);
      } else {
        tokenGroups.get(trade.token).sells.push(trade);
      }
    }
    
    // Calculate position history for each token
    for (const [tokenAddr, trades] of tokenGroups) {
      const { buys, sells } = trades;
      const totalBought = buys.reduce((sum: number, t: Trade) => sum + t.amount, 0);
      const totalSold = sells.reduce((sum: number, t: Trade) => sum + t.amount, 0);
      
      if (totalSold > 0) { // Only show tokens that have been sold
        const avgEntryPrice = buys.reduce((sum: number, t: Trade) => sum + t.price * t.amount, 0) / totalBought;
        const avgExitPrice = sells.reduce((sum: number, t: Trade) => sum + t.price * t.amount, 0) / totalSold;
        const pnl = (avgExitPrice - avgEntryPrice) * totalSold;
        const pnlPercentage = avgEntryPrice > 0 ? (pnl / (avgEntryPrice * totalSold)) * 100 : 0;
        
        positionsHistory.push({
          tokenAddress: tokenAddr as string,
          tokenSymbol: tokenAddr === "0x0000000000000000000000000000000000000000" ? "ETH" : (tokenAddr as string).slice(0, 6) + "...",
          entryPrice: avgEntryPrice,
          exitPrice: avgExitPrice,
          amount: totalSold,
          pnl,
          pnlPercentage,
          entryDate: buys[0]?.timestamp ? new Date(buys[0].timestamp).toISOString() : "",
          exitDate: sells[0]?.timestamp ? new Date(sells[0].timestamp).toISOString() : "",
          status: (totalBought > totalSold ? 'open' : 'closed') as 'open' | 'closed'
        });
      }
    }
    
    const response: PnLResponse = {
      pnlData,
      trades: trades.slice(0, 50), // Limit to recent 50 trades
      totalPnL,
      totalPnLPercentage,
      totalVolume,
      totalTrades,
      winRate,
      bought,
      sold,
      holding,
      positionsClosed,
      completedTrades,
      dailyPnL: dailyPnLChange,
      recentTrades: trades.slice(0, 10).map(t => ({
        id: t.id,
        tokenIn: t.type === "buy" ? "ETH" : t.token,
        tokenOut: t.type === "buy" ? t.token : "ETH",
        amountIn: t.type === "buy" ? (t.value / 1000000000000000000).toString() : t.amount.toString(),
        amountOut: t.type === "buy" ? t.amount.toString() : (t.value / 1000000000000000000).toString(),
        timestamp: t.timestamp,
        type: t.type,
        status: 'completed' // All stored trades are completed
      })),
      positionsHistory
    };
    
    // 🔧 NEW: Calculate if any positions were fully closed
    const fullyClosedPositions = response.positionsHistory.filter((pos: any) => pos.status === 'closed').length;
    console.log(`🔧 PnL Analysis: ${positionsClosed} sell transactions, ${fullyClosedPositions} fully closed positions`);
    
    return NextResponse.json(response);
    
  } catch (error) {
    console.error("Error calculating PnL:", error);
    return NextResponse.json(
      { error: "Failed to calculate PnL" },
      { status: 500 }
    );
  }
}
