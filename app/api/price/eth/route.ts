import { NextResponse } from 'next/server';

export async function GET() {
  // Try DexScreener first (most reliable and no rate limits)
  try {
    const dexResponse = await fetch("https://api.dexscreener.com/latest/dex/tokens/0x4200000000000000000000000000000000000006", {
      signal: AbortSignal.timeout(5000)
    });
    const dexData = await dexResponse.json();
    
    if (dexData.pairs && dexData.pairs.length > 0) {
      // Look for WETH pairs with USDC as quote token (most reliable)
      const wethUsdcPair = dexData.pairs.find((pair: any) => 
        pair.baseToken?.address === "0x4200000000000000000000000000000000000006" && 
        pair.quoteToken?.address === "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" &&
        pair.chainId === "base"
      );
      if (wethUsdcPair?.priceUsd) {
        const price = parseFloat(wethUsdcPair.priceUsd);
        return NextResponse.json({
          ethereum: { usd: price }
        });
      }
      
      // Fallback to any WETH pair with price on Base
      const wethPair = dexData.pairs.find((pair: any) => 
        pair.baseToken?.address === "0x4200000000000000000000000000000000000006" && 
        pair.priceUsd && 
        pair.chainId === "base"
      );
      if (wethPair?.priceUsd) {
        const price = parseFloat(wethPair.priceUsd);
        return NextResponse.json({
          ethereum: { usd: price }
        });
      }
    }
      } catch {
    console.log('Primary source failed, trying other sources');
  }

  // Try alternative price APIs with better rate limits
  const priceAPIs = [
    {
      name: "Binance",
      url: "https://api.binance.com/api/v3/ticker/price?symbol=ETHUSDT",
      parser: (data: any) => parseFloat(data.price)
    },
    {
      name: "Kraken",
      url: "https://api.kraken.com/0/public/Ticker?pair=ETHUSD",
      parser: (data: any) => parseFloat(data.result?.XETHZUSD?.c?.[0])
    },
    {
      name: "CoinGecko",
      url: "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd",
      parser: (data: any) => data.ethereum?.usd
    }
  ];

  for (const api of priceAPIs) {
    try {
      const response = await fetch(api.url, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'CypherX/1.0',
        },
        signal: AbortSignal.timeout(5000)
      });

      if (response.status === 429) {
        console.log(`${api.name} rate limited, trying next source`);
        continue;
      }

      if (!response.ok) {
        console.log(`${api.name} returned status ${response.status}`);
        continue;
      }

      const data = await response.json();
      const price = api.parser(data);
      
      if (price && price > 0) {
        return NextResponse.json({
          ethereum: { usd: price }
        });
      }
    } catch (error) {
      console.log(`${api.name} failed:`, error instanceof Error ? error.message : 'Unknown error');
    }
  }
  
  // Return error if no real price found
  console.log('All price sources failed');
  return NextResponse.json(
    { error: 'Failed to fetch real ETH price from all sources' },
    { status: 503 }
  );
}
