import { NextResponse } from 'next/server';

// Cache for 5 minutes to reduce fluctuations
let cachedResult: { txCount: number; timestamp: number } | null = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || '24h';
    
    // Return cached result if still valid
    if (cachedResult && (Date.now() - cachedResult.timestamp) < CACHE_DURATION) {
      return NextResponse.json({
        success: true,
        data: {
          txCount: cachedResult.txCount,
          period: period,
          timestamp: new Date().toISOString(),
          cached: true
        }
      });
    }
    
    const alchemyUrl = 'https://base-mainnet.g.alchemy.com/v2/8KR6qwxbLlIISgrMCZfsrYeMmn6-S-bN';
    
    // Calculate time range
    const now = Math.floor(Date.now() / 1000);
    let startTime = now;
    
    if (period === '24h') {
      startTime = now - (24 * 60 * 60); // 24 hours ago
    } else if (period === '7d') {
      startTime = now - (7 * 24 * 60 * 60); // 7 days ago
    } else if (period === '30d') {
      startTime = now - (30 * 24 * 60 * 60); // 30 days ago
    }
    
    // Get latest block number
    const blockNumberRequest = {
      jsonrpc: "2.0",
      method: "eth_blockNumber",
      params: [],
      id: 1
    };
    
    const blockNumberResp = await fetch(alchemyUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(blockNumberRequest),
    });
    
    if (!blockNumberResp.ok) {
      throw new Error(`Alchemy API error: ${blockNumberResp.status}`);
    }
    
    const blockNumberData = await blockNumberResp.json();
    const latestBlockNumber = parseInt(blockNumberData.result, 16);
    
    // Base network averages ~2 seconds per block
    // For 24h: ~43,200 blocks
    // Use a larger, more representative sample
    const estimatedBlocks = period === '24h' ? 43200 : period === '7d' ? 302400 : 1296000;
    const sampleSize = 200; // Increased sample size for better accuracy
    const sampleInterval = Math.max(1, Math.floor(estimatedBlocks / sampleSize));
    
    const blockRequests = [];
    
    // Sample blocks evenly across the period
    for (let i = 0; i < sampleSize; i++) {
      const blockNumber = latestBlockNumber - (i * sampleInterval);
      if (blockNumber < 0) break;
      
      blockRequests.push({
        jsonrpc: "2.0",
        method: "eth_getBlockByNumber",
        params: [`0x${blockNumber.toString(16)}`, false],
        id: i + 1
      });
    }
    
    // Fetch in batches to avoid overwhelming the API
    const batchSize = 50;
    let totalTxCount = 0;
    let blockCount = 0;
    
    for (let i = 0; i < blockRequests.length; i += batchSize) {
      const batch = blockRequests.slice(i, i + batchSize);
      
      const blocksResp = await fetch(alchemyUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(batch),
      });
      
      if (!blocksResp.ok) {
        throw new Error(`Alchemy API error: ${blocksResp.status}`);
      }
      
      const blocksData = await blocksResp.json();
      
      for (const result of blocksData) {
        if (result.result && result.result.transactions) {
          // Transactions is an array, get its length
          const txCount = Array.isArray(result.result.transactions) 
            ? result.result.transactions.length 
            : 0;
          totalTxCount += txCount;
          blockCount++;
        }
      }
    }
    
    // Calculate average transactions per block and extrapolate
    const avgTxPerBlock = blockCount > 0 ? totalTxCount / blockCount : 0;
    const estimatedTxCount = Math.round(avgTxPerBlock * estimatedBlocks);
    
    // Cache the result
    cachedResult = {
      txCount: estimatedTxCount,
      timestamp: Date.now()
    };
    
    return NextResponse.json({
      success: true,
      data: {
        txCount: estimatedTxCount,
        period: period,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error fetching 24h transaction count:', error);
    
    // Return cached result even if expired, as fallback
    if (cachedResult) {
      return NextResponse.json({
        success: true,
        data: {
          txCount: cachedResult.txCount,
          period: period,
          timestamp: new Date().toISOString(),
          cached: true,
          error: 'Using cached data due to API error'
        }
      });
    }
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch transaction count',
        data: {
          txCount: 0,
          period: '24h'
        }
      },
      { status: 500 }
    );
  }
}

