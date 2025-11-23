import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get('walletAddress');
    const tokenAddress = searchParams.get('tokenAddress');
    const isOpen = searchParams.get('isOpen');

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
      .collection('wallet_positions')
      .where('walletAddress', '==', walletAddress);

    if (tokenAddress) {
      query = query.where('tokenAddress', '==', tokenAddress) as any;
    }

    if (isOpen !== null && isOpen !== undefined) {
      query = query.where('isOpen', '==', isOpen === 'true') as any;
    }

    const snapshot = await query.get();
    const positions = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    return NextResponse.json({
      success: true,
      positions,
      count: positions.length,
    });
  } catch (error: any) {
    console.error('Error fetching positions:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch positions' },
      { status: 500 }
    );
  }
}




















































