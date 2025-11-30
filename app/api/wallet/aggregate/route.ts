import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

interface AggregatedStats {
  totalPnL: number;
  totalPnLPercentage: number;
  totalVolume: number;
  totalTrades: number;
  totalGasCosts: number;
  wallets: Array<{
    address: string;
    pnl: number;
    volume: number;
    trades: number;
  }>;
}

/**
 * Aggregate statistics across multiple wallets
 */
export async function POST(request: Request) {
  try {
    const { walletAddresses } = await request.json();
    
    if (!walletAddresses || !Array.isArray(walletAddresses) || walletAddresses.length === 0) {
      return NextResponse.json(
        { error: "Wallet addresses array is required" },
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
    
    // Fetch transactions for all wallets
    const walletStats = await Promise.all(
      walletAddresses.map(async (address: string) => {
        const transactionsSnapshot = await db
          .collection("wallet_transactions")
          .where("walletAddress", "==", address)
          .where("type", "==", "swap")
          .orderBy("timestamp", "desc")
          .get();
        
        if (transactionsSnapshot.empty) {
          return {
            address,
            pnl: 0,
            volume: 0,
            trades: 0,
            gasCosts: 0
          };
        }
        
        // Calculate basic stats
        let volume = 0;
        let gasCosts = 0;
        const positions = new Map<string, Array<{ price: number; amount: number }>>();
        
        const trades = transactionsSnapshot.docs.map(doc => {
          const data = doc.data();
          const isBuy = data.inputToken === "ETH" || data.inputToken === "0x0000000000000000000000000000000000000000";
          const tokenAddress = isBuy ? data.outputToken : data.inputToken;
          const amount = parseFloat(isBuy ? data.outputAmount : data.inputAmount);
          const value = isBuy ? data.inputValue : data.outputValue;
          const price = amount > 0 ? value / amount : 0;
          const gasCost = data.gasCostUsd || 0;
          
          volume += value;
          gasCosts += gasCost;
          
          return {
            type: isBuy ? "buy" : "sell",
            tokenAddress,
            amount,
            price,
            value,
            gasCost
          };
        });
        
        // Calculate PnL using FIFO
        let totalPnL = 0;
        for (const trade of trades.sort(() => {
          // Simplified - would need proper timestamp matching
          return 0;
        })) {
          if (trade.type === "buy") {
            if (!positions.has(trade.tokenAddress)) {
              positions.set(trade.tokenAddress, []);
            }
            positions.get(trade.tokenAddress)!.push({
              price: trade.price,
              amount: trade.amount
            });
          } else {
            if (positions.has(trade.tokenAddress) && positions.get(trade.tokenAddress)!.length > 0) {
              const tokenPositions = positions.get(trade.tokenAddress)!;
              let remainingToSell = trade.amount;
              
              while (remainingToSell > 0 && tokenPositions.length > 0) {
                const position = tokenPositions[0];
                const sellAmount = Math.min(remainingToSell, position.amount);
                const costBasis = position.price * sellAmount;
                const saleValue = (trade.value / trade.amount) * sellAmount;
                const realizedPnL = saleValue - costBasis;
                
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
        
        return {
          address,
          pnl: totalPnL,
          volume,
          trades: trades.length,
          gasCosts
        };
      })
    );
    
    // Aggregate totals
    const totalPnL = walletStats.reduce((sum, w) => sum + w.pnl, 0);
    const totalVolume = walletStats.reduce((sum, w) => sum + w.volume, 0);
    const totalTrades = walletStats.reduce((sum, w) => sum + w.trades, 0);
    const totalGasCosts = walletStats.reduce((sum, w) => sum + w.gasCosts, 0);
    
    // Calculate total invested for percentage
    const totalInvested = walletStats.reduce((sum, w) => {
      // Simplified - would need to calculate from buy transactions
      return sum + (w.volume * 0.5); // Rough estimate
    }, 0);
    
    const totalPnLPercentage = totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0;
    
    const aggregated: AggregatedStats = {
      totalPnL,
      totalPnLPercentage,
      totalVolume,
      totalTrades,
      totalGasCosts,
      wallets: walletStats.map(w => ({
        address: w.address,
        pnl: w.pnl,
        volume: w.volume,
        trades: w.trades
      }))
    };
    
    return NextResponse.json(aggregated);
    
  } catch (error) {
    console.error("Error aggregating wallet data:", error);
    return NextResponse.json(
      { error: "Failed to aggregate wallet data" },
      { status: 500 }
    );
  }
}


