import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';

export interface TopMoverToken {
  poolAddress: string;
  tokenAddress: string;
  symbol: string;
  name: string;
  priceUsd?: string;
  priceChange?: {
    h24?: number;
  };
  volume?: {
    h24: number;
  };
  marketCap?: number;
  info?: {
    imageUrl?: string;
  };
}

export async function GET() {
  try {
    // Step 1: Get top 10 tokens from our screener collection
    const screenerRef = collection(db, 'screener');
    const screenerQuery = query(
      screenerRef,
      orderBy('priceChange24h', 'desc'),
      limit(10)
    );
    
    const querySnapshot = await getDocs(screenerQuery);
    
    if (querySnapshot.empty) {
      console.warn('No tokens found in screener collection');
      return NextResponse.json({ tokens: [] });
    }

    // Extract token addresses from our screener
    const tokenAddresses: string[] = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      if (data.tokenAddress) {
        tokenAddresses.push(data.tokenAddress);
      }
    });

    console.log(`Found ${tokenAddresses.length} top tokens from screener:`, tokenAddresses);

    // Step 2: Query DexScreener for data on these tokens
    if (tokenAddresses.length === 0) {
      return NextResponse.json({ tokens: [] });
    }

    const joinedAddresses = tokenAddresses.join(',');
    const dexScreenerUrl = `https://api.dexscreener.com/tokens/v1/base/${encodeURIComponent(joinedAddresses)}`;
    
    console.log('Fetching from DexScreener:', dexScreenerUrl);
    
    const dexResponse = await fetch(dexScreenerUrl, {
      headers: { Accept: 'application/json' }
    });

    if (!dexResponse.ok) {
      console.error('API failed:', dexResponse.status);
      return NextResponse.json(
        { error: 'Unable to fetch token data. Please try again later.' },
        { status: 500 }
      );
    }

    const dexData = await dexResponse.json();
    console.log('DexScreener response:', dexData);

    // Step 3: Combine our screener data with DexScreener data
    const tokens: TopMoverToken[] = [];
    
    querySnapshot.forEach((doc) => {
      const screenerData = doc.data();
      const tokenAddress = screenerData.tokenAddress;
      
      // Find matching DexScreener data
      const dexPair = Array.isArray(dexData) ? dexData.find((pair: { baseToken?: { address?: string } }) => 
        pair.baseToken?.address?.toLowerCase() === tokenAddress?.toLowerCase()
      ) : null;

      tokens.push({
        poolAddress: screenerData.poolAddress || '',
        tokenAddress: tokenAddress || '',
        symbol: screenerData.symbol || dexPair?.baseToken?.symbol || 'UNK',
        name: screenerData.name || screenerData.symbol || dexPair?.baseToken?.name || 'Unknown',
        priceUsd: dexPair?.priceUsd || screenerData.priceUsd || '0',
        priceChange: {
          h24: dexPair?.priceChange?.h24 || screenerData.priceChange24h || 0
        },
        volume: {
          h24: dexPair?.volume?.h24 || screenerData.volume24h || 0
        },
        marketCap: dexPair?.marketCap || screenerData.marketCap || 0,
        info: dexPair?.info ? { imageUrl: dexPair.info.imageUrl } : 
              screenerData.imageUrl ? { imageUrl: screenerData.imageUrl } : undefined
      });
    });

    console.log(`Fetched ${tokens.length} top movers with DexScreener data`);
    
    return NextResponse.json({ 
      tokens,
      count: tokens.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error fetching top movers:', error);
    return NextResponse.json(
      { error: 'Failed to fetch top movers' },
      { status: 500 }
    );
  }
} 