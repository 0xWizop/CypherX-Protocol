import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get("walletAddress");
    const status = searchParams.get("status"); // PENDING, EXECUTED, CANCELLED, EXPIRED
    const orderType = searchParams.get("orderType");
    
    if (!walletAddress) {
      return NextResponse.json(
        { error: "Wallet address is required" },
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
    
    let query = db.collection("limit_orders")
      .where("walletAddress", "==", walletAddress.toLowerCase());
    
    if (status) {
      query = query.where("status", "==", status);
    }
    
    if (orderType) {
      query = query.where("orderType", "==", orderType);
    }
    
    query = query.orderBy("createdAt", "desc").limit(100);
    
    const snapshot = await query.get();
    
    const orders = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
        updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt,
        expiresAt: data.expiresAt ? new Date(data.expiresAt * 1000).toISOString() : null
      };
    });
    
    return NextResponse.json({
      success: true,
      orders
    });
    
  } catch (error) {
    console.error("Error fetching orders:", error);
    return NextResponse.json(
      { error: "Failed to fetch orders" },
      { status: 500 }
    );
  }
}


