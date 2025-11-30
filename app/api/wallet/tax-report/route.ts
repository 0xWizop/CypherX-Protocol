import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

interface TaxTransaction {
  date: string;
  type: 'BUY' | 'SELL';
  tokenSymbol: string;
  tokenAddress: string;
  amount: number;
  costBasis: number; // For buys
  salePrice: number; // For sells
  realizedGain: number; // For sells
  gasCost: number;
  txHash: string;
}

interface TaxReport {
  year: number;
  totalRealizedGains: number;
  totalRealizedLosses: number;
  netRealizedGain: number;
  totalGasCosts: number;
  transactions: TaxTransaction[];
  summary: {
    totalBuys: number;
    totalSells: number;
    totalVolume: number;
  };
}

/**
 * Calculate tax report for a wallet address
 * Uses FIFO (First In First Out) accounting method
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get("address");
    const year = searchParams.get("year") ? parseInt(searchParams.get("year")!) : new Date().getFullYear();
    
    if (!walletAddress) {
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
    
    // Get start and end dates for the year
    const yearStart = new Date(year, 0, 1);
    const yearEnd = new Date(year, 11, 31, 23, 59, 59);
    
    // Fetch all swap transactions for the year
    const transactionsSnapshot = await db
      .collection("wallet_transactions")
      .where("walletAddress", "==", walletAddress)
      .where("type", "==", "swap")
      .orderBy("timestamp", "asc")
      .get();
    
    if (transactionsSnapshot.empty) {
      return NextResponse.json({
        year,
        totalRealizedGains: 0,
        totalRealizedLosses: 0,
        netRealizedGain: 0,
        totalGasCosts: 0,
        transactions: [],
        summary: {
          totalBuys: 0,
          totalSells: 0,
          totalVolume: 0
        }
      });
    }
    
    // Process transactions using FIFO
    const positions = new Map<string, Array<{ price: number; amount: number; date: Date }>>();
    const taxTransactions: TaxTransaction[] = [];
    let totalRealizedGains = 0;
    let totalRealizedLosses = 0;
    let totalGasCosts = 0;
    let totalBuys = 0;
    let totalSells = 0;
    let totalVolume = 0;
    
    for (const doc of transactionsSnapshot.docs) {
      const data = doc.data();
      const timestamp = data.timestamp?.toDate ? data.timestamp.toDate() : new Date(data.timestamp);
      
      // Filter by year
      if (timestamp < yearStart || timestamp > yearEnd) {
        continue;
      }
      
      const isBuy = data.inputToken === "ETH" || data.inputToken === "0x0000000000000000000000000000000000000000";
      const tokenAddress = isBuy ? data.outputToken : data.inputToken;
      const tokenSymbol = data.tokenSymbol || tokenAddress.slice(0, 6) + "...";
      const amount = parseFloat(isBuy ? data.outputAmount : data.inputAmount);
      const value = isBuy ? data.inputValue : data.outputValue;
      const price = amount > 0 ? value / amount : 0;
      const gasCost = data.gasCostUsd || data.gasCost || 0;
      const txHash = data.txHash || data.hash || doc.id;
      
      totalGasCosts += gasCost;
      totalVolume += value;
      
      if (isBuy) {
        // Buy transaction - add to positions
        totalBuys++;
        if (!positions.has(tokenAddress)) {
          positions.set(tokenAddress, []);
        }
        positions.get(tokenAddress)!.push({
          price,
          amount,
          date: timestamp
        });
        
        taxTransactions.push({
          date: timestamp.toISOString().split('T')[0],
          type: 'BUY',
          tokenSymbol,
          tokenAddress,
          amount,
          costBasis: value,
          salePrice: 0,
          realizedGain: 0,
          gasCost,
          txHash
        });
      } else {
        // Sell transaction - calculate realized gain/loss using FIFO
        totalSells++;
        let remainingToSell = amount;
        let totalRealizedGain = 0;
        
        if (positions.has(tokenAddress) && positions.get(tokenAddress)!.length > 0) {
          const tokenPositions = positions.get(tokenAddress)!;
          
          while (remainingToSell > 0 && tokenPositions.length > 0) {
            const position = tokenPositions[0];
            const sellAmount = Math.min(remainingToSell, position.amount);
            const costBasis = position.price * sellAmount;
            const saleValue = (value / amount) * sellAmount;
            const realizedGain = saleValue - costBasis;
            
            totalRealizedGain += realizedGain;
            
            position.amount -= sellAmount;
            remainingToSell -= sellAmount;
            
            if (position.amount <= 0) {
              tokenPositions.shift();
            }
          }
        }
        
        if (totalRealizedGain > 0) {
          totalRealizedGains += totalRealizedGain;
        } else {
          totalRealizedLosses += Math.abs(totalRealizedGain);
        }
        
        taxTransactions.push({
          date: timestamp.toISOString().split('T')[0],
          type: 'SELL',
          tokenSymbol,
          tokenAddress,
          amount,
          costBasis: 0, // Will be calculated from positions
          salePrice: value,
          realizedGain: totalRealizedGain,
          gasCost,
          txHash
        });
      }
    }
    
    const netRealizedGain = totalRealizedGains - totalRealizedLosses;
    
    const report: TaxReport = {
      year,
      totalRealizedGains,
      totalRealizedLosses,
      netRealizedGain,
      totalGasCosts,
      transactions: taxTransactions,
      summary: {
        totalBuys,
        totalSells,
        totalVolume
      }
    };
    
    return NextResponse.json(report);
    
  } catch (error) {
    console.error("Error generating tax report:", error);
    return NextResponse.json(
      { error: "Failed to generate tax report" },
      { status: 500 }
    );
  }
}

