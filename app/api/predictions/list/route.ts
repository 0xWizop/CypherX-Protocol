import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'ACTIVE';
    const limit = parseInt(searchParams.get('limit') || '20');
    
    const db = adminDb();
    if (!db) {
      return NextResponse.json(
        { error: "Database connection failed" },
        { status: 500 }
      );
    }
    
    let query = db.collection('prediction_pools')
      .orderBy('createdAt', 'desc')
      .limit(limit);
    
    if (status !== 'ALL') {
      query = query.where('status', '==', status) as any;
    }
    
    const snapshot = await query.get();
    
    const pools = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        startTime: data.startTime?.toMillis?.() || data.startTime,
        endTime: data.endTime?.toMillis?.() || data.endTime,
        resolvedAt: data.resolvedAt?.toMillis?.() || data.resolvedAt,
        createdAt: data.createdAt?.toMillis?.() || data.createdAt,
        updatedAt: data.updatedAt?.toMillis?.() || data.updatedAt,
        participants: data.participants?.map((p: any) => ({
          ...p,
          joinedAt: p.joinedAt?.toMillis?.() || p.joinedAt
        })) || []
      };
    });
    
    return NextResponse.json({
      success: true,
      pools,
      count: pools.length
    });
    
  } catch (error: any) {
    console.error("Error listing prediction pools:", error);
    return NextResponse.json(
      { error: error.message || "Failed to list prediction pools" },
      { status: 500 }
    );
  }
}


