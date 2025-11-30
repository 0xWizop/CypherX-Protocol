import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

export interface LimitOrderRequest {
  walletAddress: string;
  orderType: "LIMIT_BUY" | "LIMIT_SELL" | "STOP_LOSS" | "STOP_LIMIT";
  tokenIn: string; // Token to sell (ETH for buy, token for sell)
  tokenOut: string; // Token to buy (token for buy, ETH for sell)
  tokenInAddress: string;
  tokenOutAddress: string;
  amountIn: string; // Amount of tokenIn to spend
  targetPrice?: string; // For limit orders - price to trigger at
  stopPrice?: string; // For stop orders - price that triggers the order
  limitPrice?: string; // For stop-limit orders - price to execute at after stop triggers
  slippage: number; // Slippage tolerance
  expirationTime?: number; // Unix timestamp - order expires at this time
  goodTillCancel?: boolean; // Order valid until manually cancelled
}

export async function POST(request: Request) {
  try {
    const body: LimitOrderRequest = await request.json();
    
    const {
      walletAddress,
      orderType,
      tokenIn,
      tokenOut,
      tokenInAddress,
      tokenOutAddress,
      amountIn,
      targetPrice,
      stopPrice,
      limitPrice,
      slippage,
      expirationTime,
      goodTillCancel
    } = body;
    
    // Validation
    if (!walletAddress || !orderType || !tokenIn || !tokenOut || !tokenInAddress || !tokenOutAddress || !amountIn) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }
    
    // Validate order type specific requirements
    if ((orderType === "LIMIT_BUY" || orderType === "LIMIT_SELL") && !targetPrice) {
      return NextResponse.json(
        { error: "targetPrice is required for limit orders" },
        { status: 400 }
      );
    }
    
    if ((orderType === "STOP_LOSS" || orderType === "STOP_LIMIT") && !stopPrice) {
      return NextResponse.json(
        { error: "stopPrice is required for stop orders" },
        { status: 400 }
      );
    }
    
    if (orderType === "STOP_LIMIT" && !limitPrice) {
      return NextResponse.json(
        { error: "limitPrice is required for stop-limit orders" },
        { status: 400 }
      );
    }
    
    // Validate amount
    const amount = parseFloat(amountIn);
    if (isNaN(amount) || amount <= 0) {
      return NextResponse.json(
        { error: "Invalid amount" },
        { status: 400 }
      );
    }
    
    // Calculate expiration
    const expiresAt = goodTillCancel 
      ? null 
      : expirationTime || Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60); // Default 30 days
    
    const db = adminDb();
    if (!db) {
      return NextResponse.json(
        { error: "Database connection failed" },
        { status: 500 }
      );
    }
    
    // Create order document
    const orderData = {
      walletAddress: walletAddress.toLowerCase(),
      orderType,
      tokenIn,
      tokenOut,
      tokenInAddress: tokenInAddress.toLowerCase(),
      tokenOutAddress: tokenOutAddress.toLowerCase(),
      amountIn,
      targetPrice: targetPrice ? parseFloat(targetPrice) : null,
      stopPrice: stopPrice ? parseFloat(stopPrice) : null,
      limitPrice: limitPrice ? parseFloat(limitPrice) : null,
      slippage: slippage || 0.5,
      status: "PENDING",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      expiresAt: expiresAt,
      goodTillCancel: goodTillCancel || false,
      executedAt: null,
      transactionHash: null,
      lastCheckedAt: null,
      checkCount: 0,
      // Additional metadata
      metadata: {
        currentPrice: null, // Will be updated by monitoring service
        priceHistory: [] // Track price changes
      }
    };
    
    const orderRef = await db.collection("limit_orders").add(orderData);
    
    return NextResponse.json({
      success: true,
      orderId: orderRef.id,
      order: {
        id: orderRef.id,
        ...orderData
      }
    });
    
  } catch (error) {
    console.error("Error creating order:", error);
    return NextResponse.json(
      { error: "Failed to create order" },
      { status: 500 }
    );
  }
}


