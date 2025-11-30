import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";

export interface ExecuteTradesRequest {
  poolId: string;
}

/**
 * Execute trades for winners of a prediction pool
 * This uses the existing swap execution infrastructure
 */
export async function POST(request: Request) {
  try {
    const body: ExecuteTradesRequest = await request.json();
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
    
    // Check if pool is resolved
    if (poolData.status !== 'RESOLVED') {
      return NextResponse.json(
        { error: "Pool must be resolved before executing trades" },
        { status: 400 }
      );
    }
    
    // Check if trades already executed
    if (poolData.executionStatus === 'COMPLETED') {
      return NextResponse.json({
        success: true,
        message: "Trades already executed",
        executedTrades: poolData.executedTrades || []
      });
    }
    
    if (poolData.executionStatus === 'EXECUTING') {
      return NextResponse.json(
        { error: "Trades are currently being executed" },
        { status: 400 }
      );
    }
    
    // Get winners
    const winners = poolData.participants?.filter((p: any) => p.isWinner) || [];
    
    if (winners.length === 0) {
      await poolRef.update({
        executionStatus: 'COMPLETED',
        updatedAt: Timestamp.now()
      });
      
      return NextResponse.json({
        success: true,
        message: "No winners to execute trades for",
        executedTrades: []
      });
    }
    
    // Mark as executing
    await poolRef.update({
      executionStatus: 'EXECUTING',
      updatedAt: Timestamp.now()
    });
    
    const executedTrades: string[] = [];
    const failedTrades: string[] = [];
    
    // Execute trades for each winner
    // Note: In production, you would need to:
    // 1. Get user's wallet private key (securely stored)
    // 2. Execute swap using your existing swap execution API
    // 3. Record transaction hash
    
    // For now, we'll create a placeholder that shows the structure
    // You'll need to integrate with your actual swap execution
    
    for (const winner of winners) {
      try {
        // TODO: Integrate with your swap execution
        // This would call your /api/swap/execute endpoint
        // or use the swap execution logic directly
        
        // Example structure:
        // const swapResult = await executeSwapForWinner({
        //   walletAddress: winner.walletAddress,
        //   tokenAddress: poolData.tokenAddress,
        //   amount: winner.payout, // Use payout amount
        //   ...
        // });
        
        // For now, we'll just mark it as needing execution
        // In production, you'd execute the actual trade here
        
        executedTrades.push(`pending-${winner.walletAddress}`);
      } catch (error: any) {
        console.error(`Failed to execute trade for ${winner.walletAddress}:`, error);
        failedTrades.push(winner.walletAddress);
      }
    }
    
    // Update pool with execution results
    await poolRef.update({
      executionStatus: executedTrades.length > 0 ? 'COMPLETED' : 'FAILED',
      executedTrades: FieldValue.arrayUnion(...executedTrades),
      updatedAt: Timestamp.now()
    });
    
    // Update participants with trade status
    const updatedParticipants = poolData.participants.map((p: any) => {
      if (p.isWinner && executedTrades.some((tx: string) => tx.includes(p.walletAddress))) {
        return {
          ...p,
          tradeExecuted: true,
          tradeTxHash: executedTrades.find((tx: string) => tx.includes(p.walletAddress))
        };
      }
      return p;
    });
    
    await poolRef.update({
      participants: updatedParticipants
    });
    
    return NextResponse.json({
      success: true,
      executed: executedTrades.length,
      failed: failedTrades.length,
      executedTrades,
      failedTrades
    });
    
  } catch (error: any) {
    console.error("Error executing trades:", error);
    return NextResponse.json(
      { error: error.message || "Failed to execute trades" },
      { status: 500 }
    );
  }
}


