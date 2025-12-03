import { NextResponse } from 'next/server';
import { adminDb } from "@/lib/firebase-admin";

// Define proper types
interface TokenData {
  id?: string;
  address: string;
  name: string;
  symbol: string;
  marketCap: number;
  volume24h: number;
  uniqueHolders: number;
  totalSupply: number;
  creatorAddress: string;
  createdAt: string | Date;
  mediaContent?: string;
  source: string;
  dexName: string;
  poolAddress?: string;
  secondaryPoolAddress?: string;
  description: string;
  website: string;
  telegram: string;
  twitter: string;
  totalVolume?: number;
  marketCapDelta24h?: number;
  tokenUri?: string;
  lastUpdated?: Date | string;
  tags?: string[];
  // DexScreener enhanced fields
  priceUsd?: string;
  priceChange?: {
    m5?: number;
    h1?: number;
    h6?: number;
    h24?: number;
  };
  volume?: {
    h1: number;
    h24: number;
  };
  liquidity?: {
    usd: number;
  };
  info?: {
    imageUrl?: string;
  };
  txns?: {
    h1: { buys: number; sells: number };
    h6: { buys: number; sells: number };
    h24: { buys: number; sells: number };
  };
}

interface DexScreenerPair {
  poolAddress: string;
  baseToken?: {
    address: string;
    symbol: string;
    name: string;
    decimals: number;
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
  txns: {
    h1: { buys: number; sells: number };
    h6: { buys: number; sells: number };
    h24: { buys: number; sells: number };
  };
  pairCreatedAt: number;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const source = searchParams.get('source'); // 'all', 'clanker', 'zora', 'aerodrome', 'baseswap', 'uniswap'
    const limitParam = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');
    const search = searchParams.get('search') || '';
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    // Fetch tokens from Firebase 'tokens' collection using Admin SDK
    let db;
    try {
      db = adminDb();
    } catch (error) {
      console.error('Firebase Admin initialization failed:', error);
      return NextResponse.json({ 
        error: 'Database connection failed. Please check Firebase Admin configuration and IAM permissions.',
        tokens: [],
        total: 0
      }, { status: 500 });
    }
    
    if (!db) {
      return NextResponse.json({ 
        error: 'Database connection failed',
        tokens: [],
        total: 0
      }, { status: 500 });
    }
    
    let tokensQuery = db.collection("tokens");

    // Apply source filter if specified
    if (source && source !== 'all') {
      tokensQuery = tokensQuery.where("source", "==", source) as any;
    }
    
    // Apply sorting
    if (sortBy === 'createdAt') {
      tokensQuery = tokensQuery.orderBy("createdAt", sortOrder === 'desc' ? 'desc' : 'asc') as any;
    }
    
    // Apply limit (fetch more if we need to filter/search)
    const fetchLimit = search ? 1000 : (limitParam + offset);
    tokensQuery = tokensQuery.limit(fetchLimit) as any;

    const snapshot = await tokensQuery.get();
    
    if (snapshot.empty) {
      return new Response(JSON.stringify({ 
        tokens: [], 
        total: 0,
        message: "No tokens found in Firebase collection." 
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Map Firebase data to our format
    let tokens: TokenData[] = snapshot.docs.map((doc) => {
      const data = doc.data();
      // Handle Firestore Timestamp conversion
      const toDate = (val: any): Date => {
        if (!val) return new Date();
        if (val.toDate && typeof val.toDate === 'function') return val.toDate();
        if (val instanceof Date) return val;
        if (typeof val === 'string') return new Date(val);
        return new Date();
      };
      
      return {
        id: doc.id,
        address: data.address || "",
        name: data.name || data.symbol || "Unknown",
        symbol: data.symbol || "",
        marketCap: data.marketCap || 0,
        volume24h: data.volume24h || 0,
        uniqueHolders: data.uniqueHolders || 0,
        totalSupply: data.totalSupply || 0,
        creatorAddress: data.creatorAddress || "",
        createdAt: toDate(data.createdAt),
        mediaContent: data.mediaContent || "",
        source: data.source || "unknown",
        dexName: data.dexName || "unknown",
        poolAddress: data.pool || data.pair || "",
        secondaryPoolAddress: data.pool2 || data.pair2 || "",
        description: data.description || "",
        website: data.website || "",
        telegram: data.telegram || "",
        twitter: data.twitter || "",
        totalVolume: data.totalVolume || 0,
        marketCapDelta24h: data.marketCapDelta24h || 0,
        tokenUri: data.tokenUri || "",
        lastUpdated: toDate(data.lastUpdated),
      };
    });

    // Apply search filter client-side if needed
    if (search) {
      const searchLower = search.toLowerCase();
      tokens = tokens.filter((token: TokenData) => 
        token.name?.toLowerCase().includes(searchLower) ||
        token.symbol?.toLowerCase().includes(searchLower) ||
        token.address?.toLowerCase().includes(searchLower)
      );
    }

    // Apply source filter client-side if needed
    if (source && source !== 'all') {
      tokens = tokens.filter((token: TokenData) => token.source === source);
    }

    // Sort tokens client-side
    tokens.sort((a: TokenData, b: TokenData) => {
      let aVal: number | string = a[sortBy as keyof TokenData] as number | string;
      let bVal: number | string = b[sortBy as keyof TokenData] as number | string;
      
      if (sortBy === 'createdAt') {
        aVal = new Date(aVal as string).getTime();
        bVal = new Date(bVal as string).getTime();
      } else if (sortBy === 'marketCap' || sortBy === 'volume24h') {
        aVal = parseFloat(String(aVal) || '0');
        bVal = parseFloat(String(bVal) || '0');
      }
      
      if (sortOrder === 'desc') {
        return (bVal as number) - (aVal as number);
      } else {
        return (aVal as number) - (bVal as number);
      }
    });

    // Apply pagination
    const total = tokens.length;
    const paginatedTokens = tokens.slice(offset, offset + limitParam);

    // Fetch DexScreener data for the tokens
    const validTokens = paginatedTokens.filter((token) => /^0x[a-fA-F0-9]{40}$/.test(token.address));
    
    if (validTokens.length > 0) {
      // Chunk tokens for DexScreener API (max 10 per request)
      const tokenChunks: string[][] = [];
      for (let i = 0; i < validTokens.length; i += 10) {
        tokenChunks.push(validTokens.slice(i, i + 10).map((t) => t.address));
      }

      // Fetch from DexScreener
      for (const chunk of tokenChunks) {
        const joinedChunk = chunk.join(",");
        try {
          const res = await fetch(
            `https://api.dexscreener.com/tokens/v1/base/${encodeURIComponent(joinedChunk)}`,
            {
              headers: { Accept: "application/json" },
            }
          );
          
          if (!res.ok) {
            console.error(`Unable to fetch token data. Please try again later.`);
            continue;
          }
          
          const data: DexScreenerPair[] = await res.json();
          
          // Enhance tokens with DexScreener data
          data.forEach((pair) => {
            if (pair && pair.baseToken && pair.baseToken.address) {
              const tokenIndex = validTokens.findIndex(
                (t) => t.address.toLowerCase() === pair.baseToken?.address.toLowerCase()
              );
              
              if (tokenIndex !== -1) {
                const token = validTokens[tokenIndex];
                // Update poolAddress from DexScreener pair data
                token.poolAddress = pair.poolAddress || token.poolAddress || "";
                token.priceUsd = pair.priceUsd || "0";
                token.priceChange = pair.priceChange || { m5: 0, h1: 0, h6: 0, h24: 0 };
                token.volume = pair.volume || { h1: 0, h24: 0 };
                token.liquidity = pair.liquidity || { usd: 0 };
                token.marketCap = pair.marketCap || token.marketCap || 0;
                token.info = pair.info ? { imageUrl: pair.info.imageUrl } : undefined;
                token.txns = pair.txns || { h1: { buys: 0, sells: 0 }, h6: { buys: 0, sells: 0 }, h24: { buys: 0, sells: 0 } };
              }
            }
          });
        } catch (error) {
          console.error("Error fetching DexScreener data:", error);
          // Continue with tokens even if DexScreener fails
        }
      }
    }

    // Add tags to tokens
    const tokensWithTags = paginatedTokens.map((token: TokenData) => {
      const tags: string[] = [];
      
      // Add source tag
      tags.push(token.source.toUpperCase());
      
      // Add market cap tags
      const marketCap = parseFloat(String(token.marketCap) || '0');
      if (marketCap > 1000000) tags.push('HIGH_CAP');
      if (marketCap > 100000) tags.push('MEDIUM_CAP');
      if (marketCap < 100000) tags.push('LOW_CAP');
      
      // Add volume tags
      const volume = parseFloat(String(token.volume24h) || '0');
      if (volume > 100000) tags.push('HIGH_VOLUME');
      if (volume > 50000) tags.push('MEDIUM_VOLUME');
      
      // Add holder tags
      const holders = parseInt(String(token.uniqueHolders) || '0');
      if (holders > 1000) tags.push('MANY_HOLDERS');
      if (holders > 100) tags.push('SOME_HOLDERS');
      
      return {
        ...token,
        tags
      };
    });

    return new Response(JSON.stringify({
      tokens: tokensWithTags,
      total,
      offset,
      limit: limitParam,
      source: source || 'all',
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("API Error:", error);
    const errorMessage = "Unable to fetch token data. Please try again later.";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}