import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

interface Order {
  id: string;
  type: 'buy' | 'sell';
  tokenAddress: string;
  tokenSymbol: string;
  amount: string;
  price: string;
  value: number;
  timestamp: number;
  status: 'completed' | 'pending' | 'failed';
  transactionHash: string;
}

interface OrdersResponse {
  orders: Order[];
  totalOrders: number;
  buyOrders: number;
  sellOrders: number;
  completedOrders: number;
}

export async function GET(request: Request) {
  try {
    console.log("🔧 Orders API called");
    const { searchParams } = new URL(request.url);
    const address = searchParams.get("address");
    const tokenAddress = searchParams.get("tokenAddress");
    const type = searchParams.get("type"); // 'buy', 'sell', or 'all'
    
    console.log("🔧 Orders API params:", { address, tokenAddress, type });
    
    if (!address) {
      console.log("🔧 Missing wallet address");
      return NextResponse.json(
        { error: "Missing wallet address" },
        { status: 400 }
      );
    }
    
    console.log("🔧 Getting admin database...");
    const db = adminDb();
    if (!db) {
      console.log("🔧 Database connection failed - adminDb() returned null");
      return NextResponse.json(
        { error: "Database connection failed" },
        { status: 500 }
      );
    }
    
    console.log("🔧 Database connection successful");
    
              console.log("🔧 Building Firestore query...");
    // 🔧 IMPROVED: Get all transactions first, then filter in memory for better sell order support
     let transactionsQuery = db.collection("wallet_transactions")
       .where("walletAddress", "==", address)
       .where("type", "==", "swap")
       .orderBy("timestamp", "desc");
     
     console.log("🔧 Executing Firestore query...");
     const transactionsSnapshot = await transactionsQuery.get();
     console.log("🔧 Query executed, docs count:", transactionsSnapshot.docs.length);
     
     // 🔧 NEW: Filter transactions in memory to properly handle both buy and sell orders
     let filteredDocs = transactionsSnapshot.docs;
     if (tokenAddress) {
       console.log("🔧 Filtering by token address:", tokenAddress);
       const tokenAddressLower = tokenAddress.toLowerCase();
       
       // 🔧 DEBUG: Log first few transactions to see what addresses are stored
       if (transactionsSnapshot.docs.length > 0) {
         const sampleData = transactionsSnapshot.docs[0].data();
         console.log("🔧 Sample transaction data:", {
           outputToken: sampleData.outputToken,
           inputToken: sampleData.inputToken,
           tokenAddress: sampleData.tokenAddress,
           outputTokenLower: sampleData.outputToken?.toLowerCase(),
           inputTokenLower: sampleData.inputToken?.toLowerCase()
         });
       }
       
       filteredDocs = transactionsSnapshot.docs.filter(doc => {
         const data = doc.data();
         // Case-insensitive comparison for token addresses
         // Check outputToken, inputToken, and tokenAddress fields
         const outputTokenMatch = data.outputToken?.toLowerCase() === tokenAddressLower;
         const inputTokenMatch = data.inputToken?.toLowerCase() === tokenAddressLower;
         const tokenAddressMatch = data.tokenAddress?.toLowerCase() === tokenAddressLower;
         
         // Include if it's a buy order for this token (outputToken) OR a sell order for this token (inputToken)
         return outputTokenMatch || inputTokenMatch || tokenAddressMatch;
       });
       console.log("🔧 Filtered docs count:", filteredDocs.length);
       
      // If no matches found, do not fallback to all transactions; return empty for strict token filtering
      if (filteredDocs.length === 0) {
        console.log("🔧 Token filter returned 0 results, returning empty orders for this token");
       }
     }
    
         if (filteredDocs.length === 0) {
       return NextResponse.json({
         orders: [],
         totalOrders: 0,
         buyOrders: 0,
         sellOrders: 0,
         completedOrders: 0
       });
     }
     
     // Convert transactions to orders format
     const orders: Order[] = filteredDocs.map(doc => {
      const data = doc.data();
      // Improved logic: A buy is when someone sends ETH/WETH or another base token to the pool
      // Check for both ETH string and WETH address
      const isBuy = data.inputToken === "ETH" || 
                   data.inputToken === "0x0000000000000000000000000000000000000000" ||
                   data.inputToken?.toLowerCase() === "0x4200000000000000000000000000000000000006";
      
      // Determine token address and symbol
      const tokenAddr = isBuy ? data.outputToken : data.inputToken;
      const tokenSymbol = (tokenAddr === "0x0000000000000000000000000000000000000000" || 
                          tokenAddr?.toLowerCase() === "0x4200000000000000000000000000000000000006") ? "ETH" : 
                         (data.tokenSymbol || tokenAddr?.slice(0, 6) + "...");
      
      // Calculate price and amount - ensure we get the actual token amount
      const amountStr = isBuy ? (data.outputAmount || data.amount || '0') : (data.inputAmount || data.amount || '0');
      const amount = parseFloat(amountStr);
      const value = isBuy ? (data.inputValue || 0) : (data.outputValue || 0);
      const price = amount > 0 ? value / amount : (data.price ? parseFloat(data.price) : 0);
      
      return {
        id: doc.id,
        type: isBuy ? "buy" : "sell",
        tokenAddress: tokenAddr,
        tokenSymbol,
        amount: amountStr, // Keep as string for precision
        price: price.toString(),
        value: value,
        timestamp: data.timestamp?.toDate ? data.timestamp.toDate().getTime() : (data.timestamp?.seconds ? data.timestamp.seconds * 1000 : Date.now()),
        status: 'completed', // All stored transactions are completed
        transactionHash: data.transactionHash || data.txHash
      };
    });
    
    // Filter by type if specified
    let filteredOrders = orders;
    if (type && type !== 'all') {
      filteredOrders = orders.filter(order => order.type === type);
    }
    
    // Calculate statistics
    const totalOrders = filteredOrders.length;
    const buyOrders = filteredOrders.filter(order => order.type === 'buy').length;
    const sellOrders = filteredOrders.filter(order => order.type === 'sell').length;
    const completedOrders = filteredOrders.filter(order => order.status === 'completed').length;
    
    const response: OrdersResponse = {
      orders: filteredOrders,
      totalOrders,
      buyOrders,
      sellOrders,
      completedOrders
    };
    
    return NextResponse.json(response);
    
  } catch (error) {
    console.error("🔧 Error fetching orders:", error);
    console.error("🔧 Error stack:", error instanceof Error ? error.stack : 'No stack trace');
    return NextResponse.json(
      { error: "Failed to fetch orders", details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
