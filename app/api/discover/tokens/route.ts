import { NextResponse } from 'next/server';
import { adminDb } from "@/lib/firebase-admin";

// In-memory cache for token data
interface CachedData {
  tokens: TokenData[];
  timestamp: number;
}

let tokenCache: CachedData | null = null;
const CACHE_DURATION = 30 * 1000; // 30 seconds cache

interface TokenData {
  poolAddress: string;
  tokenAddress: string;
  symbol: string;
  name: string;
  priceUsd: string;
  priceChange: {
    m5: number;
    h1: number;
    h6: number;
    h24: number;
  };
  volume: {
    h1: number;
    h24: number;
  };
  liquidity: {
    usd: number;
  };
  marketCap: number;
  info?: {
    imageUrl: string;
  };
  txns?: {
    h1: { buys: number; sells: number };
    h6: { buys: number; sells: number };
    h24: { buys: number; sells: number };
  };
  pairCreatedAt: number;
  dexId?: string;
  source?: string;
}

interface DexScreenerPair {
  pairAddress: string;
  baseToken?: {
    address: string;
    symbol: string;
    name: string;
  };
  priceUsd: string;
  priceChange: {
    m5: number;
    h1: number;
    h6: number;
    h24: number;
  };
  volume: {
    h1: number;
    h24: number;
  };
  liquidity: {
    usd: number;
  };
  marketCap: number;
  info?: {
    imageUrl: string;
  };
  txns?: {
    h1: { buys: number; sells: number };
    h6: { buys: number; sells: number };
    h24: { buys: number; sells: number };
  };
  pairCreatedAt: number;
  dexId?: string;
}

// Fetch DexScreener data for a chunk of tokens
async function fetchDexScreenerChunk(addresses: string[]): Promise<DexScreenerPair[]> {
  const joinedChunk = addresses.join(",");
  try {
    const res = await fetch(
      `https://api.dexscreener.com/tokens/v1/base/${encodeURIComponent(joinedChunk)}`,
      {
        headers: { Accept: "application/json" },
        next: { revalidate: 30 } // Cache for 30 seconds
      }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const forceRefresh = searchParams.get('refresh') === 'true';
    
    // Check cache first (unless force refresh)
    const now = Date.now();
    if (!forceRefresh && tokenCache && (now - tokenCache.timestamp) < CACHE_DURATION) {
      return NextResponse.json({
        tokens: tokenCache.tokens,
        cached: true,
        cacheAge: Math.round((now - tokenCache.timestamp) / 1000),
        total: tokenCache.tokens.length
      }, {
        headers: {
          'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
        }
      });
    }

    // Fetch tokens from Firebase
    const db = adminDb();
    if (!db) {
      return NextResponse.json({ error: 'Database connection failed', tokens: [] }, { status: 500 });
    }

    const snapshot = await db.collection("tokens").get();
    if (snapshot.empty) {
      return NextResponse.json({ tokens: [], total: 0 });
    }

    // Map Firebase tokens
    const firebaseTokens = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        poolAddress: data.pool as string || "",
        tokenAddress: data.address as string || "",
        symbol: data.symbol as string || "",
        name: data.name as string || data.symbol || "Unknown",
        source: data.source as string || "unknown",
        pairCreatedAt: data.createdAt?.toDate?.()?.getTime() || 0,
      };
    });

    // Deduplicate and filter valid tokens
    const uniqueMap = new Map<string, typeof firebaseTokens[0]>();
    firebaseTokens.forEach((token) => {
      if (token.tokenAddress && /^0x[a-fA-F0-9]{40}$/.test(token.tokenAddress)) {
        uniqueMap.set(token.tokenAddress.toLowerCase(), token);
      }
    });
    const validTokens = Array.from(uniqueMap.values());

    if (validTokens.length === 0) {
      return NextResponse.json({ tokens: [], total: 0 });
    }

    // Create chunks of 10 tokens for DexScreener API
    const chunks: string[][] = [];
    for (let i = 0; i < validTokens.length; i += 10) {
      chunks.push(validTokens.slice(i, i + 10).map((t) => t.tokenAddress));
    }

    // Fetch all chunks in PARALLEL (major performance boost)
    const chunkResults = await Promise.all(chunks.map(fetchDexScreenerChunk));
    
    // Flatten results and create lookup map
    const dexDataMap = new Map<string, DexScreenerPair>();
    chunkResults.flat().forEach((pair) => {
      if (pair.baseToken?.address) {
        dexDataMap.set(pair.baseToken.address.toLowerCase(), pair);
      }
    });

    // Merge Firebase + DexScreener data
    const enrichedTokens: TokenData[] = [];
    validTokens.forEach((fbToken) => {
      const dexData = dexDataMap.get(fbToken.tokenAddress.toLowerCase());
      if (dexData) {
        enrichedTokens.push({
          poolAddress: dexData.pairAddress || fbToken.poolAddress,
          tokenAddress: fbToken.tokenAddress,
          symbol: dexData.baseToken?.symbol || fbToken.symbol,
          name: dexData.baseToken?.name || fbToken.name,
          priceUsd: dexData.priceUsd || "0",
          priceChange: dexData.priceChange || { m5: 0, h1: 0, h6: 0, h24: 0 },
          volume: dexData.volume || { h1: 0, h24: 0 },
          liquidity: dexData.liquidity || { usd: 0 },
          marketCap: dexData.marketCap || 0,
          info: dexData.info,
          txns: dexData.txns,
          pairCreatedAt: dexData.pairCreatedAt || fbToken.pairCreatedAt,
          dexId: dexData.dexId,
          source: fbToken.source,
        });
      }
    });

    // Update cache
    tokenCache = {
      tokens: enrichedTokens,
      timestamp: now
    };

    return NextResponse.json({
      tokens: enrichedTokens,
      cached: false,
      total: enrichedTokens.length
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
      }
    });

  } catch (error) {
    console.error('Error fetching discover tokens:', error);
    return NextResponse.json({ error: 'Failed to fetch tokens', tokens: [] }, { status: 500 });
  }
}

