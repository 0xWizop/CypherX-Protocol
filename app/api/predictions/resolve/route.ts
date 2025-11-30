import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { Timestamp } from "firebase-admin/firestore";
import { getTokenPrice } from "@/lib/price-utils";

export interface ResolvePredictionRequest {
  poolId: string;
}

export async function POST(request: Request) {
  try {
    const body: ResolvePredictionRequest = await request.json();
    const { poolId } = body;
    
    if (!poolId) {
      return NextResponse.json(
        { error: "Missing poolId" },
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
    
    const poolRef = db.collection('prediction_pools').doc(poolId);
    const poolDoc = await poolRef.get();
    
    if (!poolDoc.exists) {
      return NextResponse.json(
        { error: "Prediction pool not found" },
        { status: 404 }
      );
    }
    
    const poolData = poolDoc.data()!;
    
    // Check if already resolved
    if (poolData.status === 'RESOLVED') {
      return NextResponse.json({
        success: true,
        message: "Pool already resolved",
        pool: poolData
      });
    }
    
    // Check if pool has expired
    const endTime = poolData.endTime.toDate();
    if (new Date() < endTime) {
      return NextResponse.json(
        { error: "Pool has not expired yet" },
        { status: 400 }
      );
    }
    
    // Get current token price
    const endPrice = await getTokenPrice(poolData.tokenAddress);
    if (!endPrice || endPrice === 0) {
      return NextResponse.json(
        { error: "Could not fetch token price" },
        { status: 500 }
      );
    }
    
    const startPrice = poolData.startPrice;
    const priceChange = ((endPrice - startPrice) / startPrice) * 100;
    
    // Determine outcome
    let outcome: 'YES' | 'NO';
    if (poolData.predictionType === 'PUMP') {
      outcome = priceChange >= poolData.threshold ? 'YES' : 'NO';
    } else {
      outcome = priceChange <= -poolData.threshold ? 'YES' : 'NO';
    }
    
    // Calculate winners and losers
    const participants = poolData.participants || [];
    const winners = participants.filter((p: any) => p.prediction === outcome);
    const losers = participants.filter((p: any) => p.prediction !== outcome);
    
    // Calculate payouts
    const totalStaked = poolData.totalStaked || 0;
    const loserStakes = losers.reduce((sum: number, p: any) => sum + p.stakeAmount, 0);
    const winnerStakes = winners.reduce((sum: number, p: any) => sum + p.stakeAmount, 0);
    
    // Gas fee pool (from losers' stakes)
    // Estimate: ~$0.10 per trade on Base (very low gas)
    const estimatedGasPerTrade = 0.10;
    const gasFeePool = Math.min(loserStakes, estimatedGasPerTrade * winners.length);
    const totalPot = totalStaked - gasFeePool;
    
    // Calculate payout per winner (proportional to stake)
    const updatedParticipants = participants.map((p: any) => {
      const isWinner = p.prediction === outcome;
      let payout = 0;
      
      if (isWinner && winnerStakes > 0) {
        // Proportional payout based on stake
        payout = (p.stakeAmount / winnerStakes) * totalPot;
      }
      
      return {
        ...p,
        isWinner,
        payout: isWinner ? payout : 0
      };
    });
    
    // Update pool
    await poolRef.update({
      status: 'RESOLVED',
      endPrice,
      resolvedAt: Timestamp.now(),
      participants: updatedParticipants,
      winnerCount: winners.length,
      loserCount: losers.length,
      totalPot,
      gasFeePool,
      winnerPayout: winners.length > 0 ? totalPot / winners.length : 0,
      executionStatus: poolData.autoExecuteTrades ? 'PENDING' : 'COMPLETED',
      updatedAt: Timestamp.now()
    });
    
    return NextResponse.json({
      success: true,
      outcome,
      priceChange: priceChange.toFixed(2),
      startPrice,
      endPrice,
      winners: winners.length,
      losers: losers.length,
      totalPot,
      gasFeePool
    });
    
  } catch (error: any) {
    console.error("Error resolving prediction pool:", error);
    return NextResponse.json(
      { error: error.message || "Failed to resolve prediction pool" },
      { status: 500 }
    );
  }
}


