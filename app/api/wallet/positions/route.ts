import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

interface Position {
  id: string;
  tokenAddress: string;
  tokenSymbol: string;
  amount: string;
  avgPrice: string;
  currentPrice: string;
  pnl: string;
  pnlValue: string;
  pnlPercentage: number;
  status: 'open' | 'closed';
  entryDate: number;
  exitDate?: number;
  totalBought: number;
  totalSold: number;
  remainingAmount: number;
}

interface PositionsResponse {
  positions: Position[];
  totalPositions: number;
  openPositions: number;
  closedPositions: number;
  totalPnL: number;
  totalPnLPercentage: number;
}

// Get current token price from DexScreener
async function getTokenPrice(tokenAddress: string): Promise<number> {
  if (tokenAddress === "0x0000000000000000000000000000000000000000") {
    // Get ETH price
    try {
      const response = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd");
      const data = await response.json();
      return data.ethereum?.usd || 0;
    } catch (error) {
      console.error("Error fetching ETH price:", error);
      return 0;
    }
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

export async function GET(request: Request) {
  try {
    console.log("🔧 Positions API called");
    const { searchParams } = new URL(request.url);
    const address = searchParams.get("address");
    const tokenAddress = searchParams.get("tokenAddress");
    const status = searchParams.get("status"); // 'open', 'closed', or 'all'
    
    console.log("🔧 Positions API params:", { address, tokenAddress, status });
    
    if (!address) {
      console.log("🔧 Missing wallet address");
      return NextResponse.json(
        { error: "Missing wallet address" },
        { status: 400 }
      );
    }
    
    console.log("🔧 Getting admin database...");
    const db = adminDb();
    if (!db) {
      console.log("🔧 Database connection failed - adminDb() returned null");
      return NextResponse.json(
        { error: "Database connection failed" },
        { status: 500 }
      );
    }
    
    console.log("🔧 Database connection successful");
    
    // Build query for wallet transactions
    let transactionsQuery = db.collection("wallet_transactions")
      .where("walletAddress", "==", address)
      .where("type", "==", "swap");
    
    // 🔧 FIXED: Don't filter by token in the query - we'll filter in memory to get both buys and sells
    // This ensures we get all transactions for the token (both inputToken and outputToken)
    
    transactionsQuery = transactionsQuery.orderBy("timestamp", "desc");
    
    const transactionsSnapshot = await transactionsQuery.get();
    
    if (transactionsSnapshot.empty) {
      return NextResponse.json({
        positions: [],
        totalPositions: 0,
        openPositions: 0,
        closedPositions: 0,
        totalPnL: 0,
        totalPnLPercentage: 0
      });
    }
    
         // 🔧 NEW: Create individual positions for each buy transaction
     const positions: Position[] = [];
     let totalPnL = 0;
     
     // Track sells to mark positions as closed
     const sellsByToken = new Map();
     
     // 🔧 FIXED: Filter transactions by token if specified, then collect sell transactions
     let filteredDocs = transactionsSnapshot.docs;
     if (tokenAddress) {
       const tokenAddressLower = tokenAddress.toLowerCase();
       console.log("🔧 Positions - Filtering by token address:", tokenAddress);
       
       // 🔧 DEBUG: Log sample transaction to see what addresses are stored
       if (transactionsSnapshot.docs.length > 0) {
         const sampleData = transactionsSnapshot.docs[0].data();
         console.log("🔧 Positions - Sample transaction:", {
           outputToken: sampleData.outputToken,
           inputToken: sampleData.inputToken,
           tokenAddress: sampleData.tokenAddress
         });
       }
       
       filteredDocs = transactionsSnapshot.docs.filter(doc => {
         const data = doc.data();
         // Case-insensitive comparison for token addresses
         const outputTokenMatch = data.outputToken?.toLowerCase() === tokenAddressLower;
         const inputTokenMatch = data.inputToken?.toLowerCase() === tokenAddressLower;
         const tokenAddressMatch = data.tokenAddress?.toLowerCase() === tokenAddressLower;
         
         // Include if it's a buy order for this token (outputToken) OR a sell order for this token (inputToken)
         return outputTokenMatch || inputTokenMatch || tokenAddressMatch;
       });
       console.log("🔧 Positions - Filtered docs count:", filteredDocs.length);
       
      // If no matches found, keep empty to strictly scope positions to the requested token
      if (filteredDocs.length === 0) {
        console.log("🔧 Positions - Token filter returned 0, returning empty positions for this token");
       }
     }
     
     // First, collect all sell transactions
       filteredDocs.forEach(doc => {
       const data = doc.data();
       // Improved logic: A sell is when someone sends a token (not ETH/WETH) to the pool
       // This works for both ETH pairs and non-ETH pairs (like USDC pairs)
       const isSell = data.inputToken !== "ETH" && 
                     data.inputToken !== "0x0000000000000000000000000000000000000000" &&
                     data.inputToken?.toLowerCase() !== "0x4200000000000000000000000000000000000006";
       
       if (isSell) {
         const tokenAddr = data.inputToken;
         if (!sellsByToken.has(tokenAddr)) {
           sellsByToken.set(tokenAddr, []);
         }
         const inputAmount = parseFloat(data.inputAmount || '0');
         const outputValue = data.outputValue || 0;
         sellsByToken.get(tokenAddr).push({
           amount: inputAmount,
           value: outputValue,
           timestamp: data.timestamp?.toDate ? data.timestamp.toDate().getTime() : (data.timestamp?.seconds ? data.timestamp.seconds * 1000 : Date.now()),
           price: inputAmount > 0 ? outputValue / inputAmount : 0
         });
       }
     });
     
                 // Create individual positions for each buy transaction
      for (const doc of filteredDocs) {
        const data = doc.data();
        // Improved logic: A buy is when someone sends ETH/WETH or another base token to the pool
        // Check for both ETH string and WETH address
        const isBuy = data.inputToken === "ETH" || 
                     data.inputToken === "0x0000000000000000000000000000000000000000" ||
                     data.inputToken?.toLowerCase() === "0x4200000000000000000000000000000000000006";
        
        if (isBuy) {
          const tokenAddr = data.outputToken;
          const amount = parseFloat(data.outputAmount || '0');
          const value = data.inputValue || 0;
          const price = amount > 0 ? value / amount : 0;
          const timestamp = data.timestamp?.toDate ? data.timestamp.toDate().getTime() : (data.timestamp?.seconds ? data.timestamp.seconds * 1000 : Date.now());
          
          // Get current price
          const currentPrice = await getTokenPrice(tokenAddr);
         
         // Check if this position was sold
         const sellsForToken = sellsByToken.get(tokenAddr) || [];
         let soldAmount = 0;
         let soldValue = 0;
         let exitDate: number | undefined;
         
         // Calculate how much of this position was sold
         for (const sell of sellsForToken) {
           if (sell.timestamp > timestamp) { // Sell happened after this buy
             soldAmount += sell.amount;
             soldValue += sell.value;
             if (!exitDate || sell.timestamp > exitDate) {
               exitDate = sell.timestamp;
             }
           }
         }
         
         const remainingAmount = amount - soldAmount;
         const positionStatus = remainingAmount > 0 ? 'open' : 'closed';
         
         // 🔧 DEBUG: Log position status calculation
         console.log(`Position ${doc.id}: bought=${amount}, sold=${soldAmount}, remaining=${remainingAmount}, status=${positionStatus}`);
         
         // Filter by status if specified
         if (status && status !== 'all' && positionStatus !== status) {
           continue;
         }
         
         // Calculate PnL
         let pnl = 0;
         let pnlPercentage = 0;
         
         if (soldAmount > 0) {
           // Realized PnL from sold portion
           const avgExitPrice = soldValue / soldAmount;
           pnl = (avgExitPrice - price) * soldAmount;
         }
         
         if (remainingAmount > 0) {
           // Unrealized PnL from remaining portion
           const unrealizedPnL = (currentPrice - price) * remainingAmount;
           pnl += unrealizedPnL;
         }
         
         pnlPercentage = price > 0 ? (pnl / (price * amount)) * 100 : 0;
         totalPnL += pnl;
         
         const tokenSymbol = (tokenAddr === "0x0000000000000000000000000000000000000000" || 
                             tokenAddr?.toLowerCase() === "0x4200000000000000000000000000000000000006") ? "ETH" : 
                            (data.tokenSymbol || tokenAddr?.slice(0, 6) + "...");
         
         const position: Position = {
           id: doc.id, // Use transaction ID as position ID
           tokenAddress: tokenAddr,
           tokenSymbol,
           amount: remainingAmount.toString(),
           avgPrice: price.toString(),
           currentPrice: currentPrice.toString(),
           pnl: pnl >= 0 ? `+$${pnl.toFixed(2)}` : `-$${Math.abs(pnl).toFixed(2)}`,
           pnlValue: pnl >= 0 ? `+$${pnl.toFixed(2)}` : `-$${Math.abs(pnl).toFixed(2)}`,
           pnlPercentage,
           status: positionStatus,
           entryDate: timestamp,
           exitDate: exitDate,
           totalBought: amount,
           totalSold: soldAmount,
           remainingAmount
         };
         
         positions.push(position);
       }
     }
    
     // Calculate statistics
    const totalPositions = positions.length;
    const openPositions = positions.filter(p => p.status === 'open').length;
    const closedPositions = positions.filter(p => p.status === 'closed').length;
    const totalPnLPercentage = totalPnL !== 0 ? (totalPnL / Math.abs(totalPnL)) * 100 : 0;
    
    const response: PositionsResponse = {
      positions,
      totalPositions,
      openPositions,
      closedPositions,
      totalPnL,
      totalPnLPercentage
    };
    
    return NextResponse.json(response);
    
  } catch (error) {
    console.error("🔧 Error fetching positions:", error);
    console.error("🔧 Error stack:", error instanceof Error ? error.stack : 'No stack trace');
    return NextResponse.json(
      { error: "Failed to fetch positions", details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
