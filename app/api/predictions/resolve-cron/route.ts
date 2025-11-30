import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { Timestamp } from "firebase-admin/firestore";
import { getTokenPrice } from "@/lib/price-utils";

/**
 * Cron job to resolve expired prediction pools
 * This should be called periodically (e.g., every minute) to resolve pools that have expired
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
    
    const now = Timestamp.now();
    
    // Find all active pools that have expired
    const expiredPoolsSnapshot = await db.collection('prediction_pools')
      .where('status', '==', 'ACTIVE')
      .where('endTime', '<=', now)
      .limit(10) // Process in batches
      .get();
    
    if (expiredPoolsSnapshot.empty) {
      return NextResponse.json({
        success: true,
        message: "No expired pools to resolve",
        resolved: 0
      });
    }
    
    let resolved = 0;
    let failed = 0;
    
    for (const doc of expiredPoolsSnapshot.docs) {
      try {
        const poolData = doc.data();
        
        // Mark as resolving
        await doc.ref.update({
          status: 'RESOLVING',
          updatedAt: Timestamp.now()
        });
        
        // Get current token price
        const endPrice = await getTokenPrice(poolData.tokenAddress);
        if (!endPrice || endPrice === 0) {
          throw new Error("Could not fetch token price");
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
        const estimatedGasPerTrade = 0.10; // ~$0.10 per trade on Base
        const gasFeePool = Math.min(loserStakes, estimatedGasPerTrade * winners.length);
        const totalPot = totalStaked - gasFeePool;
        
        // Calculate payout per winner (proportional to stake)
        const updatedParticipants = participants.map((p: any) => {
          const isWinner = p.prediction === outcome;
          let payout = 0;
          
          if (isWinner && winnerStakes > 0) {
            payout = (p.stakeAmount / winnerStakes) * totalPot;
          }
          
          return {
            ...p,
            isWinner,
            payout: isWinner ? payout : 0
          };
        });
        
        // Update pool
        await doc.ref.update({
          status: 'RESOLVED',
          endPrice,
          resolvedAt: Timestamp.now(),
          participants: updatedParticipants,
          winnerCount: winners.length,
          loserCount: losers.length,
          totalPot,
          gasFeePool,
          winnerPayout: winners.length > 0 ? totalPot / winners.length : 0,
          outcome,
          priceChange,
          executionStatus: poolData.autoExecuteTrades ? 'PENDING' : 'COMPLETED',
          updatedAt: Timestamp.now()
        });
        
        resolved++;
        
        // If auto-execute is enabled, trigger trade execution
        if (poolData.autoExecuteTrades && winners.length > 0) {
          // Note: In production, you might want to queue this for async processing
          // For now, we'll just mark it as pending
          console.log(`Pool ${doc.id} resolved. ${winners.length} winners. Trades pending execution.`);
        }
        
      } catch (error: any) {
        console.error(`Error resolving pool ${doc.id}:`, error);
        failed++;
        
        // Mark as failed or keep as ACTIVE for retry
        await doc.ref.update({
          status: 'ACTIVE', // Keep as active for retry
          updatedAt: Timestamp.now()
        });
      }
    }
    
    return NextResponse.json({
      success: true,
      resolved,
      failed,
      total: expiredPoolsSnapshot.size
    });
    
  } catch (error: any) {
    console.error("Error in resolve cron:", error);
    return NextResponse.json(
      { error: error.message || "Failed to resolve pools" },
      { status: 500 }
    );
  }
}


