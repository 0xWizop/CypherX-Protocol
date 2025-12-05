import { NextResponse } from 'next/server';

// Helper function to add delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper function to retry fetch with exponential backoff
async function fetchWithRetry(url: string, options: RequestInit = {}, maxRetries = 3): Promise<Response> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'CypherX/1.0',
          ...options.headers,
        },
      });
      
      if (response.ok) {
        return response;
      }
      
      // If rate limited, wait longer
      if (response.status === 429) {
        const waitTime = Math.pow(2, i) * 1000;
        console.log(`Rate limited, waiting ${waitTime}ms before retry ${i + 1}`);
        await delay(waitTime);
        continue;
      }
      
      // For other errors, don't retry
      return response;
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      const waitTime = Math.pow(2, i) * 1000;
      console.log(`Fetch failed, retrying in ${waitTime}ms (attempt ${i + 1}/${maxRetries})`);
      await delay(waitTime);
    }
  }
  throw new Error(`Failed to fetch after ${maxRetries} retries`);
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tokenId: string }> }
) {
  try {
    const { searchParams } = new URL(request.url);
    const timestamp = searchParams.get('timestamp');
    const { tokenId } = await params;

    if (!tokenId) {
      return NextResponse.json({ error: 'Token ID is required' }, { status: 400 });
    }

    // If timestamp is provided, try to get historical price
    if (timestamp) {
      try {
        // Convert timestamp to Unix timestamp (seconds)
        const unixTimestamp = Math.floor(parseInt(timestamp) / 1000);
        
        // Try CoinGecko first for historical price
        const coinGeckoUrl = `https://api.coingecko.com/api/v3/coins/ethereum/contract/${tokenId}/market_chart/range?vs_currency=usd&from=${unixTimestamp - 3600}&to=${unixTimestamp + 3600}`;
        
        try {
          const coinGeckoResponse = await fetchWithRetry(coinGeckoUrl, { cache: "no-store" });
          
          if (coinGeckoResponse.ok) {
            const coinGeckoData = await coinGeckoResponse.json();
            if (coinGeckoData.prices && coinGeckoData.prices.length > 0) {
              // Find the closest price to the transaction timestamp
              const targetTime = parseInt(timestamp);
              let closestPrice = coinGeckoData.prices[0][1]; // Default to first price
              let minDiff = Math.abs(coinGeckoData.prices[0][0] - targetTime);
              
              for (const [time, price] of coinGeckoData.prices) {
                const diff = Math.abs(time - targetTime);
                if (diff < minDiff) {
                  minDiff = diff;
                  closestPrice = price;
                }
              }
              
              return NextResponse.json({
                success: true,
                price: closestPrice,
                timestamp: targetTime,
                source: 'coingecko'
              });
            }
          }
        } catch (error) {
          console.error('Error fetching historical price from CoinGecko:', error);
        }
      } catch (error) {
        console.error('Error processing historical price request:', error);
      }
    }

    // Fallback to current price from DexScreener
    try {
      const dexScreenerUrl = `https://api.dexscreener.com/latest/dex/tokens/${tokenId}`;
      const dexScreenerResponse = await fetchWithRetry(dexScreenerUrl, { cache: "no-store" });
      
      if (dexScreenerResponse.ok) {
        const dexScreenerData = await dexScreenerResponse.json();
        const pairs = dexScreenerData.pairs || [];
        
        // Find the best pair with highest liquidity
        const bestPair = pairs.reduce((best: any, current: any) => {
          const bestLiquidity = parseFloat(best.liquidity?.usd || "0");
          const currentLiquidity = parseFloat(current.liquidity?.usd || "0");
          return currentLiquidity > bestLiquidity ? current : best;
        }, pairs[0]);
        
        if (bestPair?.priceUsd) {
          return NextResponse.json({
            success: true,
            price: parseFloat(bestPair.priceUsd),
            timestamp: Date.now(),
            source: 'dexscreener'
          });
        }
      }
    } catch (error) {
      console.error('Error fetching current price:', error);
    }

    // Try CoinGecko current price as final fallback
    try {
      const coingeckoCurrentUrl = `https://api.coingecko.com/api/v3/simple/token_price/ethereum?contract_addresses=${tokenId}&vs_currencies=usd`;
      const coingeckoResponse = await fetchWithRetry(coingeckoCurrentUrl, { cache: "no-store" });
      
      if (coingeckoResponse.ok) {
        const coingeckoData = await coingeckoResponse.json();
        const price = coingeckoData[tokenId.toLowerCase()]?.usd;
        if (price) {
          return NextResponse.json({
            success: true,
            price: price,
            timestamp: Date.now(),
            source: 'coingecko_current'
          });
        }
      }
    } catch (error) {
      console.error('Error fetching current price from CoinGecko:', error);
    }

    // If all else fails, return 0 with error info
    return NextResponse.json({
      success: false,
      price: 0,
      timestamp: Date.now(),
      source: 'fallback',
      error: 'No price data available for this token'
    });

  } catch (error) {
    console.error('Error in historical price API:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to fetch historical price',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
