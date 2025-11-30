import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { Timestamp } from "firebase-admin/firestore";
import { getTokenPrice } from "@/lib/price-utils";
import { getTokenLiquidity, MIN_LIQUIDITY, getMaxBetSize } from "@/lib/liquidity-utils";

export interface CreatePredictionRequest {
  creatorId?: string;
  creatorAddress?: string;
  tokenAddress: string;
  tokenSymbol?: string;
  tokenName?: string;
  predictionType: 'PUMP' | 'DUMP';
  threshold: number; // Percentage (e.g., 15 for 15%)
  timeframe: number; // Minutes (minimum 60)
  autoExecuteTrades?: boolean;
  description?: string;
}

export async function POST(request: Request) {
  try {
    const body: CreatePredictionRequest = await request.json();
    
    const {
      creatorId,
      creatorAddress,
      tokenAddress,
      tokenSymbol,
      tokenName,
      predictionType,
      threshold,
      timeframe,
      autoExecuteTrades = true,
      description
    } = body;
    
    // Validation
    if (!tokenAddress || !predictionType || !threshold || !timeframe) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }
    
    // Validate timeframe (minimum 60 minutes to prevent manipulation)
    if (timeframe < 60) {
      return NextResponse.json(
        { error: "Timeframe must be at least 60 minutes to prevent manipulation" },
        { status: 400 }
      );
    }
    
    // Validate threshold (reasonable range)
    if (threshold < 1 || threshold > 100) {
      return NextResponse.json(
        { error: "Threshold must be between 1% and 100%" },
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
    
    // Check token liquidity (must be at least 1M)
    const liquidityInfo = await getTokenLiquidity(tokenAddress);
    if (!liquidityInfo || liquidityInfo.liquidity < MIN_LIQUIDITY) {
      return NextResponse.json(
        { error: `Token must have at least $1M liquidity. Current liquidity: $${liquidityInfo?.liquidity.toLocaleString() || 'Unknown'}` },
        { status: 400 }
      );
    }
    
    // Get current token price
    const startPrice = liquidityInfo.price || await getTokenPrice(tokenAddress);
    if (!startPrice || startPrice === 0) {
      return NextResponse.json(
        { error: "Could not fetch token price. Please try again." },
        { status: 400 }
      );
    }
    
    // Calculate end time
    const now = new Date();
    const endTime = new Date(now.getTime() + timeframe * 60 * 1000);
    
    // Create prediction pool
    const poolData = {
      creatorId: creatorId || null,
      creatorAddress: creatorAddress || null,
      tokenAddress,
      tokenSymbol: tokenSymbol || null,
      tokenName: tokenName || null,
      predictionType,
      threshold,
      timeframe,
      status: 'ACTIVE',
      startTime: Timestamp.now(),
      endTime: Timestamp.fromDate(endTime),
      startPrice,
      priceSource: 'dexscreener',
      liquidity: liquidityInfo.liquidity,
      maxBetSize: getMaxBetSize(liquidityInfo.liquidity),
      participants: [],
      totalStaked: 0,
      winnerCount: 0,
      loserCount: 0,
      totalPot: 0,
      gasFeePool: 0,
      autoExecuteTrades,
      executionStatus: 'PENDING',
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      metadata: {
        description: description || null
      }
    };
    
    const poolRef = await db.collection('prediction_pools').add(poolData);
    
    return NextResponse.json({
      success: true,
      poolId: poolRef.id,
      pool: {
        id: poolRef.id,
        ...poolData,
        startTime: poolData.startTime.toMillis(),
        endTime: poolData.endTime.toMillis(),
        createdAt: poolData.createdAt.toMillis(),
        updatedAt: poolData.updatedAt.toMillis()
      }
    });
    
  } catch (error: any) {
    console.error("Error creating prediction pool:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create prediction pool" },
      { status: 500 }
    );
  }
}

