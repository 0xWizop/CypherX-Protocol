import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get('walletAddress');
    const tokenAddress = searchParams.get('tokenAddress');
    const limit = parseInt(searchParams.get('limit') || '50');

    if (!walletAddress) {
      return NextResponse.json(
        { error: "walletAddress is required" },
        { status: 400 }
      );
    }

    const db = adminDb();
    if (!db) {
      return NextResponse.json({ error: "Database connection failed" }, { status: 500 });
    }

    let query = db
      .collection('wallet_orders')
      .where('walletAddress', '==', walletAddress)
      .orderBy('timestamp', 'desc')
      .limit(limit);

    if (tokenAddress) {
      query = query.where('tokenAddress', '==', tokenAddress) as any;
    }

    const snapshot = await query.get();
    const orders = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    return NextResponse.json({
      success: true,
      orders,
      count: orders.length,
    });
  } catch (error: any) {
    console.error('Error fetching orders:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch orders' },
      { status: 500 }
    );
  }
}

















