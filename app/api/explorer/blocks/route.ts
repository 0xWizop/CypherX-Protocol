import { NextResponse } from 'next/server';

interface Block {
  number: string;
  hash: string;
  timestamp: number;
  transactionCount: number;
  gasUsed: string;
  gasLimit: string;
  baseFeePerGas?: string;
  miner: string;
  size: string;
  parentHash: string;
  nonce: string;
  difficulty: string;
  totalDifficulty: string;
  extraData: string;
  sha3Uncles: string;
  logsBloom: string;
  transactionsRoot: string;
  stateRoot: string;
  receiptsRoot: string;
  uncles: string[];
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

    // Get blocks in batch
    const blockRequests = [];
    for (let i = 0; i < limit; i++) {
      const blockNumber = latestBlockNumber - i - ((page - 1) * limit);
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
    
    const blocks: Block[] = blocksData
      .filter((result: any) => result.result)
      .map((result: any) => {
        const block = result.result;
        return {
          number: block.number,
          hash: block.hash,
          timestamp: parseInt(block.timestamp, 16) * 1000, // Convert to milliseconds
          transactionCount: block.transactions.length,
          gasUsed: block.gasUsed,
          gasLimit: block.gasLimit,
          baseFeePerGas: block.baseFeePerGas,
          miner: block.miner,
          size: block.size,
          parentHash: block.parentHash,
          nonce: block.nonce,
          difficulty: block.difficulty,
          totalDifficulty: block.totalDifficulty,
          extraData: block.extraData,
          sha3Uncles: block.sha3Uncles,
          logsBloom: block.logsBloom,
          transactionsRoot: block.transactionsRoot,
          stateRoot: block.stateRoot,
          receiptsRoot: block.receiptsRoot,
          uncles: block.uncles || []
        };
      });

    return NextResponse.json({
      success: true,
      data: {
        blocks,
        totalCount: blocks.length,
        page,
        limit,
        hasNextPage: blocks.length === limit
      }
    });

  } catch (error) {
    console.error('Error fetching blocks:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch blocks',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}


























