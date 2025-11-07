import { NextResponse } from 'next/server';

interface Transaction {
  hash: string;
  from: string;
  to: string;
  value: string;
  gas: string;
  gasPrice: string;
  gasUsed?: string;
  nonce: string;
  blockNumber: string;
  blockHash: string;
  transactionIndex: string;
  timestamp: number;
  input: string;
  v: string;
  r: string;
  s: string;
  type: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  accessList?: any[];
  chainId?: string;
  status: 'success' | 'failed' | 'pending';
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20');
    const page = parseInt(searchParams.get('page') || '1');

    const alchemyUrl = 'https://base-mainnet.g.alchemy.com/v2/8KR6qwxbLlIISgrMCZfsrYeMmn6-S-bN';

    // Get latest block number first
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

    // Get recent blocks to find transactions
    const blockRange = Math.min(10, Math.ceil(limit / 10)); // Get more blocks to find enough transactions
    const blockRequests = [];
    
    for (let i = 0; i < blockRange; i++) {
      const blockNumber = latestBlockNumber - i;
      if (blockNumber < 0) break;
      
      blockRequests.push({
        jsonrpc: "2.0",
        method: "eth_getBlockByNumber",
        params: [`0x${blockNumber.toString(16)}`, true],
        id: i + 1
      });
    }

    const blocksResp = await fetch(alchemyUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(blockRequests),
    });

    if (!blocksResp.ok) {
      throw new Error(`Alchemy API error: ${blocksResp.status}`);
    }

    const blocksData = await blocksResp.json();
    
    // Collect all transactions from recent blocks
    const allTransactions: Transaction[] = [];
    
    for (const result of blocksData) {
      if (result.result && result.result.transactions) {
        const block = result.result;
        const blockTimestamp = parseInt(block.timestamp, 16) * 1000;
        
        for (const tx of block.transactions) {
          allTransactions.push({
            hash: tx.hash,
            from: tx.from,
            to: tx.to,
            value: tx.value,
            gas: tx.gas,
            gasPrice: tx.gasPrice,
            nonce: tx.nonce,
            blockNumber: tx.blockNumber,
            blockHash: tx.blockHash,
            transactionIndex: tx.transactionIndex,
            timestamp: blockTimestamp,
            input: tx.input,
            v: tx.v,
            r: tx.r,
            s: tx.s,
            type: tx.type || '0x0',
            maxFeePerGas: tx.maxFeePerGas,
            maxPriorityFeePerGas: tx.maxPriorityFeePerGas,
            accessList: tx.accessList,
            chainId: tx.chainId,
            status: 'success' // We'll assume success for now, could check receipts later
          });
        }
      }
    }

    // Sort by timestamp (newest first)
    allTransactions.sort((a, b) => b.timestamp - a.timestamp);

    // Apply pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedTxs = allTransactions.slice(startIndex, endIndex);

    return NextResponse.json({
      success: true,
      data: {
        transactions: paginatedTxs,
        totalCount: allTransactions.length,
        page,
        limit,
        hasNextPage: endIndex < allTransactions.length
      }
    });

  } catch (error) {
    console.error('Error fetching transactions:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch transactions',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}




















