import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";

export interface JoinPredictionRequest {
  poolId: string;
  userId?: string;
  walletAddress: string;
  stakeAmount: number; // USD amount (minimum $0.50)
  prediction: 'YES' | 'NO';
}

const MIN_STAKE = 0.50; // Minimum $0.50

export async function POST(request: Request) {
  try {
    const body: JoinPredictionRequest = await request.json();
    
    const {
      poolId,
      userId,
      walletAddress,
      stakeAmount,
      prediction
    } = body;
    
    // Validation
    if (!poolId || !walletAddress || !stakeAmount || !prediction) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }
    
    // Validate minimum stake
    if (stakeAmount < MIN_STAKE) {
      return NextResponse.json(
        { error: `Minimum stake is $${MIN_STAKE}` },
        { status: 400 }
      );
    }
    
    // Get pool data first to check max bet size
    const db = adminDb();
    if (!db) {
      return NextResponse.json(
        { error: "Database connection failed" },
        { status: 500 }
      );
    }
    
    const poolRef = db.collection('prediction_pools').doc(poolId);
    const poolDoc = await poolRef.get();
    
    if (!poolDoc.exists) {
      return NextResponse.json(
        { error: "Prediction pool not found" },
        { status: 404 }
      );
    }
    
    const poolData = poolDoc.data();
    
    // Check max bet size based on liquidity
    const maxBetSize = poolData?.maxBetSize || 0;
    if (maxBetSize > 0 && stakeAmount > maxBetSize) {
      return NextResponse.json(
        { error: `Maximum bet size for this token is $${maxBetSize}. Token liquidity: $${(poolData?.liquidity || 0).toLocaleString()}` },
        { status: 400 }
      );
    }
    
    // Validate prediction
    if (prediction !== 'YES' && prediction !== 'NO') {
      return NextResponse.json(
        { error: "Prediction must be 'YES' or 'NO'" },
        { status: 400 }
      );
    }
    
    // Check if pool is still active
    if (poolData?.status !== 'ACTIVE') {
      return NextResponse.json(
        { error: "Prediction pool is not active" },
        { status: 400 }
      );
    }
    
    // Check if pool has expired
    const endTime = poolData.endTime.toDate();
    if (new Date() >= endTime) {
      return NextResponse.json(
        { error: "Prediction pool has expired" },
        { status: 400 }
      );
    }
    
    // Check if user already joined
    const existingParticipant = poolData.participants?.find(
      (p: any) => p.walletAddress?.toLowerCase() === walletAddress.toLowerCase()
    );
    
    if (existingParticipant) {
      return NextResponse.json(
        { error: "You have already joined this prediction pool" },
        { status: 400 }
      );
    }
    
    // Add participant
    const participant = {
      userId: userId || null,
      walletAddress: walletAddress.toLowerCase(),
      stakeAmount,
      prediction,
      joinedAt: Timestamp.now()
    };
    
    await poolRef.update({
      participants: FieldValue.arrayUnion(participant),
      totalStaked: FieldValue.increment(stakeAmount),
      updatedAt: Timestamp.now()
    });
    
    return NextResponse.json({
      success: true,
      message: "Successfully joined prediction pool",
      participant
    });
    
  } catch (error: any) {
    console.error("Error joining prediction pool:", error);
    return NextResponse.json(
      { error: error.message || "Failed to join prediction pool" },
      { status: 500 }
    );
  }
}

