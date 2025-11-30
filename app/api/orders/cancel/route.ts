import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

export async function POST(request: Request) {
  try {
    const { orderId, walletAddress } = await request.json();
    
    if (!orderId || !walletAddress) {
      return NextResponse.json(
        { error: "Order ID and wallet address are required" },
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
    
    const orderRef = db.collection("limit_orders").doc(orderId);
    const orderDoc = await orderRef.get();
    
    if (!orderDoc.exists) {
      return NextResponse.json(
        { error: "Order not found" },
        { status: 404 }
      );
    }
    
    const orderData = orderDoc.data();
    
    // Verify wallet ownership
    if (orderData?.walletAddress?.toLowerCase() !== walletAddress.toLowerCase()) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 403 }
      );
    }
    
    // Check if order can be cancelled
    if (orderData?.status !== "PENDING") {
      return NextResponse.json(
        { error: `Order cannot be cancelled. Current status: ${orderData?.status}` },
        { status: 400 }
      );
    }
    
    // Update order status
    await orderRef.update({
      status: "CANCELLED",
      cancelledAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });
    
    return NextResponse.json({
      success: true,
      message: "Order cancelled successfully"
    });
    
  } catch (error) {
    console.error("Error cancelling order:", error);
    return NextResponse.json(
      { error: "Failed to cancel order" },
      { status: 500 }
    );
  }
}











