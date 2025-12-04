import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { ethers } from "ethers";

/**
 * Order Execution Service
 * Executes orders that have met their conditions
 * This should be called after the monitor service identifies ready orders
 */
export async function POST(request: Request) {
  try {
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
    
    // Fetch orders ready for execution
    const executingOrdersSnapshot = await db.collection("limit_orders")
      .where("status", "==", "EXECUTING")
      .limit(10) // Process in small batches
      .get();
    
    if (executingOrdersSnapshot.empty) {
      return NextResponse.json({
        success: true,
        message: "No orders ready for execution",
        executed: 0
      });
    }
    
    let executed = 0;
    let failed = 0;
    
    // Process each order
    for (const doc of executingOrdersSnapshot.docs) {
      const orderData = doc.data();
      const order = { 
        id: doc.id, 
        tokenInAddress: orderData.tokenInAddress as string,
        tokenOutAddress: orderData.tokenOutAddress as string,
        amountIn: orderData.amountIn as string,
        slippage: orderData.slippage as number | undefined,
        walletAddress: orderData.walletAddress as string,
        tokenIn: orderData.tokenIn as string,
        tokenOut: orderData.tokenOut as string,
        ...orderData 
      };
      
      try {
        const walletAddress = order.walletAddress;
        
        // Get fresh quote from 0x API
        const sellAmountWei = ethers.parseUnits(order.amountIn, 18).toString();
        const quoteParams = new URLSearchParams({
          sellToken: order.tokenInAddress,
          buyToken: order.tokenOutAddress,
          sellAmount: sellAmountWei,
          slippagePercentage: (order.slippage || 0.5).toString(),
          chainId: "8453",
        });

        const quoteResponse = await fetch(
          `https://api.0x.org/swap/v1/quote?${quoteParams.toString()}`,
          {
            headers: {
              "0x-api-key": process.env.ZEROX_API_KEY || "",
              Accept: "application/json"
            }
          }
        );
        
        if (!quoteResponse.ok) {
          const errorData = await quoteResponse.json().catch(() => ({}));
          throw new Error(errorData.reason || "Failed to get quote from 0x");
        }
        
        const quoteData = await quoteResponse.json();
        const buyAmount = quoteData.buyAmount;
        const buyAmountFormatted = ethers.formatUnits(buyAmount, 18);
        
        // Determine token symbols for swap execution
        const tokenInSymbol = order.tokenIn === "ETH" ? "ETH" : order.tokenIn;
        const tokenOutSymbol = order.tokenOut === "ETH" ? "ETH" : order.tokenOut;
        
        // IMPORTANT: For automatic execution, you need the user's private key
        // This is a security concern - consider:
        // 1. Using a relayer service
        // 2. Having users pre-authorize orders with signed messages
        // 3. Using a smart contract that holds orders
        // 4. Storing encrypted private keys securely (AWS KMS, HashiCorp Vault, etc.)
        
        // For now, we'll call the swap/execute endpoint
        // This requires the private key to be provided or stored securely
        // In production, you should implement one of the secure methods above
        
        // Check if we have a way to get the private key (this is a placeholder)
        // In production, retrieve from secure storage or use relayer
        const privateKey = process.env.ORDER_EXECUTION_PRIVATE_KEY; // NOT RECOMMENDED - use secure storage
        
        if (!privateKey) {
          // Mark as pending execution - requires user authorization or relayer
          await doc.ref.update({
            status: "PENDING_EXECUTION",
            updatedAt: FieldValue.serverTimestamp(),
            executionQuote: quoteData,
            error: "Private key not available - requires user authorization or relayer service"
          });
          executed++;
          continue;
        }
        
        // Execute swap using swap/execute endpoint
        const swapResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/swap/execute`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            inputToken: tokenInSymbol,
            outputToken: tokenOutSymbol,
            inputAmount: order.amountIn,
            outputAmount: buyAmountFormatted,
            slippage: order.slippage || 0.5,
            walletAddress: walletAddress,
            privateKey: privateKey, // In production, retrieve from secure storage
            tokenAddress: order.tokenOutAddress === "0x4200000000000000000000000000000000000006" ? order.tokenInAddress : order.tokenOutAddress,
          }),
        });
        
        if (!swapResponse.ok) {
          const errorData = await swapResponse.json().catch(() => ({}));
          throw new Error(errorData.error || "Swap execution failed");
        }
        
        const swapResult = await swapResponse.json();
        
        if (!swapResult.success || !swapResult.transactionHash) {
          throw new Error("Swap execution did not return transaction hash");
        }
        
        // Update order with execution details
        await doc.ref.update({
          status: "EXECUTED",
          executedAt: FieldValue.serverTimestamp(),
          transactionHash: swapResult.transactionHash,
          updatedAt: FieldValue.serverTimestamp(),
          executionResult: {
            buyAmount: buyAmountFormatted,
            gasUsed: swapResult.gasUsed,
            dexUsed: swapResult.dexUsed,
          }
        });
        
        executed++;
        
      } catch (error) {
        console.error(`Error executing order ${order.id}:`, error);
        
        // Mark as failed
        await doc.ref.update({
          status: "FAILED",
          error: error instanceof Error ? error.message : "Execution failed",
          updatedAt: FieldValue.serverTimestamp()
        });
        
        failed++;
      }
    }
    
    return NextResponse.json({
      success: true,
      executed,
      failed,
      message: `Processed ${executed + failed} orders: ${executed} ready, ${failed} failed`
    });
    
  } catch (error) {
    console.error("Error executing orders:", error);
    return NextResponse.json(
      { error: "Failed to execute orders" },
      { status: 500 }
    );
  }
}

