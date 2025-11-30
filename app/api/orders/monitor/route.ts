import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

/**
 * Order Monitoring Service
 * Checks pending orders and executes them when conditions are met
 * This should be called periodically (via cron job) to monitor orders
 */
export async function POST(request: Request) {
  try {
    // Optional: Add API key protection for cron jobs
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }
    
    const db = adminDb();
    if (!db) {
      return NextResponse.json(
        { error: "Database connection failed" },
        { status: 500 }
      );
    }
    
    // Fetch all pending orders
    const pendingOrdersSnapshot = await db.collection("limit_orders")
      .where("status", "==", "PENDING")
      .limit(50) // Process in batches
      .get();
    
    if (pendingOrdersSnapshot.empty) {
      return NextResponse.json({
        success: true,
        message: "No pending orders to check",
        processed: 0
      });
    }
    
    let processed = 0;
    let executed = 0;
    let expired = 0;
    
    // Get current prices for all unique tokens
    const tokenAddresses = new Set<string>();
    pendingOrdersSnapshot.docs.forEach(doc => {
      const data = doc.data();
      tokenAddresses.add(data.tokenOutAddress);
      tokenAddresses.add(data.tokenInAddress);
    });
    
    // Fetch current prices (using DexScreener API)
    const priceMap = new Map<string, number>();
    for (const tokenAddress of tokenAddresses) {
      try {
        const price = await getTokenPrice(tokenAddress);
        priceMap.set(tokenAddress.toLowerCase(), price);
      } catch (error) {
        console.error(`Error fetching price for ${tokenAddress}:`, error);
      }
    }
    
    // Process each order
    for (const doc of pendingOrdersSnapshot.docs) {
      const orderData = doc.data();
      const order = { 
        id: doc.id,
        expiresAt: orderData.expiresAt as number | undefined,
        tokenOutAddress: orderData.tokenOutAddress as string | undefined,
        metadata: orderData.metadata as { priceHistory?: Array<{ price: number; timestamp: number }>; currentPrice?: number } | undefined,
        orderType: orderData.orderType as "LIMIT_BUY" | "LIMIT_SELL" | "STOP_LOSS" | "STOP_LIMIT",
        targetPrice: orderData.targetPrice as number | undefined,
        stopPrice: orderData.stopPrice as number | undefined,
        limitPrice: orderData.limitPrice as number | undefined,
        ...orderData 
      };
      processed++;
      
      // Check expiration
      if (order.expiresAt && order.expiresAt < Math.floor(Date.now() / 1000)) {
        await doc.ref.update({
          status: "EXPIRED",
          updatedAt: FieldValue.serverTimestamp()
        });
        expired++;
        continue;
      }
      
      // Get current price for the token being traded
      const currentPrice = order.tokenOutAddress ? priceMap.get(order.tokenOutAddress.toLowerCase()) : undefined;
      
      if (!currentPrice || currentPrice <= 0) {
        // Update last checked but don't execute if price unavailable
        await doc.ref.update({
          lastCheckedAt: FieldValue.serverTimestamp(),
          checkCount: FieldValue.increment(1),
          "metadata.currentPrice": currentPrice || 0
        });
        continue;
      }
      
      // Update price in metadata
      const priceHistory = order.metadata?.priceHistory || [];
      priceHistory.push({
        price: currentPrice,
        timestamp: Math.floor(Date.now() / 1000)
      });
      
      // Keep only last 100 price points
      if (priceHistory.length > 100) {
        priceHistory.shift();
      }
      
      // Check order conditions based on type
      let shouldExecute = false;
      
      switch (order.orderType) {
        case "LIMIT_BUY":
          // Execute if current price <= target price
          shouldExecute = currentPrice <= (order.targetPrice || 0);
          break;
          
        case "LIMIT_SELL":
          // Execute if current price >= target price
          shouldExecute = currentPrice >= (order.targetPrice || 0);
          break;
          
        case "STOP_LOSS":
          // Execute if current price <= stop price (selling to limit losses)
          shouldExecute = currentPrice <= (order.stopPrice || 0);
          break;
          
        case "STOP_LIMIT":
          // First check if stop price is hit, then check limit
          if (currentPrice <= (order.stopPrice || 0)) {
            // Stop triggered, now check limit price
            shouldExecute = currentPrice >= (order.limitPrice || 0);
          }
          break;
      }
      
      // Update metadata
      await doc.ref.update({
        lastCheckedAt: FieldValue.serverTimestamp(),
        checkCount: FieldValue.increment(1),
        "metadata.currentPrice": currentPrice,
        "metadata.priceHistory": priceHistory
      });
      
      if (shouldExecute) {
        // Mark order as executing (will be completed by execution service)
        await doc.ref.update({
          status: "EXECUTING",
          updatedAt: FieldValue.serverTimestamp()
        });
        
        // In production, you would queue this order for execution
        // For now, we'll just mark it as ready
        executed++;
      }
    }
    
    return NextResponse.json({
      success: true,
      processed,
      executed,
      expired,
      message: `Processed ${processed} orders, ${executed} ready for execution, ${expired} expired`
    });
    
  } catch (error) {
    console.error("Error monitoring orders:", error);
    return NextResponse.json(
      { error: "Failed to monitor orders" },
      { status: 500 }
    );
  }
}

/**
 * Get current token price from DexScreener
 */
async function getTokenPrice(tokenAddress: string): Promise<number> {
  try {
    // Handle ETH/WETH
    if (tokenAddress === "0x0000000000000000000000000000000000000000" || 
        tokenAddress === "0x4200000000000000000000000000000000000006") {
      // Get ETH price from CoinGecko
      const response = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd");
      const data = await response.json();
      return data.ethereum?.usd || 0;
    }
    
    // Get token price from DexScreener
    const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`);
    const data = await response.json();
    const pair = data.pairs?.[0];
    return pair?.priceUsd ? parseFloat(pair.priceUsd) : 0;
  } catch (error) {
    console.error(`Error fetching price for ${tokenAddress}:`, error);
    return 0;
  }
}


