import { adminDb } from "@/lib/firebase-admin";
import { collection, getDocs, query, orderBy, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import fs from "fs";
import path from "path";

const DB_FILE = path.join(process.cwd(), "data/zora-tokens.json");

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
  dexId?: string; // DEX identifier for API calls
  pairAddress?: string;
  description: string;
  website: string;
  telegram: string;
  twitter: string;
  discord?: string;
  totalVolume?: number;
  marketCapDelta24h?: number;
  tokenUri?: string;
  lastUpdated?: Date | string;
  tags?: string[];
  score?: number; // Token score from aggregator
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

// Sample tokens for fallback
const sampleTokens: TokenData[] = [
  {
    address: "0x1234567890123456789012345678901234567890",
    name: "Sample Token 1",
    symbol: "SMP1",
    marketCap: 150000,
    volume24h: 25000,
    uniqueHolders: 150,
    totalSupply: 1000000,
    creatorAddress: "0x1111111111111111111111111111111111111111",
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
    source: "sample",
    dexName: "BaseSwap",
    dexId: "baseswap",
    description: "Sample token for testing",
    website: "https://example.com",
    telegram: "https://t.me/sampletoken1",
    twitter: "https://twitter.com/sampletoken1",
    discord: "https://discord.gg/sampletoken1",
    marketCapDelta24h: 25.5,

  },
  {
    address: "0x2345678901234567890123456789012345678901",
    name: "Sample Token 2",
    symbol: "SMP2",
    marketCap: 75000,
    volume24h: 45000,
    uniqueHolders: 89,
    totalSupply: 500000,
    creatorAddress: "0x2222222222222222222222222222222222222222",
    createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000), // 1 hour ago
    source: "sample",
    dexName: "Aerodrome",
    dexId: "aerodrome",
    description: "Another sample token",
    website: "https://example2.com",
    telegram: "https://t.me/sampletoken2",
    twitter: "https://twitter.com/sampletoken2",
    marketCapDelta24h: -15.2,

  },
  {
    address: "0x3456789012345678901234567890123456789012",
    name: "Sample Token 3",
    symbol: "SMP3",
    marketCap: 300000,
    volume24h: 120000,
    uniqueHolders: 450,
    totalSupply: 2000000,
    creatorAddress: "0x3333333333333333333333333333333333333333",
    createdAt: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
    source: "sample",
    dexName: "Uniswap",
    description: "High volume sample token",
    website: "",
    telegram: "",
    twitter: "",
    marketCapDelta24h: 45.8
  }
];

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    let tokens: TokenData[] = [];
    console.log("🚀 Starting memescope token fetch...");

    // 1. Fetch from Cypherscope collection (existing memescope data)
    try {
      const adminDatabase = adminDb();
      if (adminDatabase) {
        console.log("📊 Fetching from Cypherscope collection...");
        
        // Get tokens ordered by lastUpdated (most recent first) to avoid index requirement
        // Note: If you need score-based sorting, create the composite index in Firebase Console
        const snapshot = await adminDatabase.collection("Cypherscope")
          .orderBy("lastUpdated", "desc")
          .limit(100) // Get more tokens for better selection
          .get();

        const cypherscopeTokens = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            address: data.address,
            name: data.name,
            symbol: data.symbol,
            marketCap: data.marketCap || 0,
            volume24h: data.volume24h || 0,
            uniqueHolders: data.uniqueHolders || 0,
            totalSupply: data.totalSupply || 0,
            creatorAddress: data.creatorAddress || "",
            createdAt: data.createdAt,
            mediaContent: data.mediaContent,
            source: data.source || 'zora',
            dexName: data.dexName || 'Zora',
            pairAddress: data.pairAddress,
            description: data.description || "",
            website: data.website || "",
            telegram: data.telegram || "",
            twitter: data.twitter || "",
            totalVolume: data.totalVolume || 0,
            marketCapDelta24h: data.marketCapDelta24h || 0,
            tokenUri: data.tokenUri,
            lastUpdated: data.lastUpdated?.toDate?.() || data.lastUpdated,
            score: data.score || 0,
            tags: data.tags || [],
            priceUsd: data.priceUsd,
            priceChange: data.priceChange,
            volume: data.volume,
            liquidity: data.liquidity,
            info: data.info,
            txns: data.txns
          };
        });
        tokens = [...tokens, ...cypherscopeTokens];
        console.log(`✅ Fetched ${cypherscopeTokens.length} tokens from Cypherscope collection`);
      }
    } catch (error) {
      console.log("❌ Cypherscope collection fetch failed:", error);
    }

    // 2. Fetch from Zora and Clanker APIs (new launchpad sources)
    try {
      console.log("📊 Fetching from Zora and Clanker...");
      
      // Import route handlers directly to avoid HTTP calls
      const zoraModule = await import('../tokens/zora/route');
      const clankerModule = await import('../tokens/clanker/route');
      const getZoraTokens = zoraModule.GET;
      const getClankerTokens = clankerModule.GET;
      
      // Fetch from Zora - get more tokens to catch all new pairs
      try {
        const zoraRequest = new Request(
          new URL('/api/tokens/zora?limit=50', process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000')
        );
        const zoraResponse = await getZoraTokens(zoraRequest);
        if (zoraResponse.ok) {
          const zoraData = await zoraResponse.json();
          if (zoraData.success && zoraData.tokens && Array.isArray(zoraData.tokens)) {
            tokens = [...tokens, ...zoraData.tokens];
            console.log(`✅ Fetched ${zoraData.tokens.length} tokens from Zora`);
            
            // Auto-save Zora tokens to Firebase for explore page
            try {
              const saveModule = await import('../tokens/save/route');
              const saveTokens = saveModule.POST;
              const saveRequest = new Request(
                new URL('/api/tokens/save', process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'),
                {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ tokens: zoraData.tokens, source: 'zora' }),
                }
              );
              await saveTokens(saveRequest);
              console.log(`💾 Auto-saved ${zoraData.tokens.length} Zora tokens to Firebase`);
            } catch (saveError) {
              console.warn('⚠️ Failed to auto-save Zora tokens:', saveError);
            }
          }
        }
      } catch (zoraError) {
        console.log("❌ Zora fetch failed:", zoraError);
      }

      // Fetch from Clanker - get more tokens to catch all new pairs
      try {
        const clankerRequest = new Request(
          new URL('/api/tokens/clanker?limit=20', process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000')
        );
        const clankerResponse = await getClankerTokens(clankerRequest);
        if (clankerResponse.ok) {
          const clankerData = await clankerResponse.json();
          if (clankerData.success && clankerData.tokens && Array.isArray(clankerData.tokens)) {
            tokens = [...tokens, ...clankerData.tokens];
            console.log(`✅ Fetched ${clankerData.tokens.length} tokens from Clanker`);
            
            // Auto-save Clanker tokens to Firebase for explore page
            try {
              const saveModule = await import('../tokens/save/route');
              const saveTokens = saveModule.POST;
              const saveRequest = new Request(
                new URL('/api/tokens/save', process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'),
                {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ tokens: clankerData.tokens, source: 'clanker' }),
                }
              );
              await saveTokens(saveRequest);
              console.log(`💾 Auto-saved ${clankerData.tokens.length} Clanker tokens to Firebase`);
            } catch (saveError) {
              console.warn('⚠️ Failed to auto-save Clanker tokens:', saveError);
            }
          }
        }
      } catch (clankerError) {
        console.log("❌ Clanker fetch failed:", clankerError);
      }
    } catch (error) {
      console.log("❌ Launchpad sources fetch failed:", error);
    }

    // 3. Fetch from main tokens collection (screener data)
    try {
      console.log("📊 Fetching from main tokens collection (screener)...");
      const tokensRef = collection(db, "tokens");
      // Fetch more tokens from screener - no limit to get all
      let tokensQuery = query(tokensRef, orderBy("createdAt", "desc"), limit(500));
      
      const snapshot = await getDocs(tokensQuery);
      
      const screenerTokens: TokenData[] = snapshot.docs.map((doc) => {
        const data = doc.data();
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
          createdAt: data.createdAt?.toDate?.() || data.createdAt || new Date(),
          mediaContent: data.mediaContent || "",
          source: data.source || "screener",
          dexName: data.dexName || "unknown",
          pairAddress: data.pool || data.pair || "",
          // Expose second pair for clients that need it
          // Note: keeping naming consistent with existing fields
          // without breaking consumers
          pairAddress2: data.pool2 || data.pair2 || "",
          description: data.description || "",
          website: data.website || "",
          telegram: data.telegram || "",
          twitter: data.twitter || "",
          totalVolume: data.totalVolume || 0,
          marketCapDelta24h: data.marketCapDelta24h || 0,
          tokenUri: data.tokenUri || "",
          lastUpdated: data.lastUpdated?.toDate?.() || data.lastUpdated || new Date(),
          // Initialize DexScreener fields
          priceUsd: "0",
          priceChange: { m5: 0, h1: 0, h6: 0, h24: 0 },
          volume: { h1: 0, h24: 0 },
          liquidity: { usd: 0 },
          info: undefined,
          txns: { h1: { buys: 0, sells: 0 }, h6: { buys: 0, sells: 0 }, h24: { buys: 0, sells: 0 } }
        };
      });
      
      // Enhance screener tokens with DexScreener data
      console.log("🔍 Enhancing screener tokens with DexScreener data...");
      const validScreenerTokens = screenerTokens.filter((token) => /^0x[a-fA-F0-9]{40}$/.test(token.address));
      
      if (validScreenerTokens.length > 0) {
        // Chunk tokens for DexScreener API (max 10 per request)
        const tokenChunks: string[][] = [];
        for (let i = 0; i < validScreenerTokens.length; i += 10) {
          tokenChunks.push(validScreenerTokens.slice(i, i + 10).map((t) => t.address));
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
              console.error(`DexScreener API fetch failed for chunk: ${joinedChunk}, status: ${res.status}`);
              continue;
            }
            
            const data: any[] = await res.json();
            
            // Enhance tokens with DexScreener data, keeping highest-liquidity pair per token
            data.forEach((pair) => {
              if (pair && pair.baseToken && pair.baseToken.address) {
                const tokenIndex = validScreenerTokens.findIndex(
                  (t) => t.address.toLowerCase() === pair.baseToken?.address.toLowerCase()
                );
                
                if (tokenIndex !== -1) {
                  const token = validScreenerTokens[tokenIndex];
                  const currentLiq = parseFloat(String(token.liquidity?.usd || '0')) || 0;
                  const newLiq = parseFloat(String(pair.liquidity?.usd || '0')) || 0;

                  // Only replace if this pair has higher liquidity
                  if (newLiq >= currentLiq) {
                    token.pairAddress = pair.poolAddress || token.pairAddress || "";
                    token.priceUsd = pair.priceUsd || "0";
                    token.priceChange = pair.priceChange || { m5: 0, h1: 0, h6: 0, h24: 0 };
                    token.volume = pair.volume || { h1: 0, h24: 0 };
                    token.liquidity = pair.liquidity || { usd: 0 };
                    token.marketCap = pair.marketCap || token.marketCap || 0;
                    token.info = pair.info ? { imageUrl: pair.info.imageUrl } : undefined;
                    token.txns = pair.txns || { h1: { buys: 0, sells: 0 }, h6: { buys: 0, sells: 0 }, h24: { buys: 0, sells: 0 } };
                    token.dexId = pair.dexId || token.dexId || "unknown";
                    token.dexName = pair.dexId || token.dexName || "Unknown DEX";
                    if (pair.volume && pair.volume.h24) {
                      token.volume24h = pair.volume.h24;
                    }
                  }
                }
              }
            });
          } catch (error) {
            console.error("Error fetching DexScreener data:", error);
          }
        }
        
        console.log(`✅ Enhanced ${validScreenerTokens.length} screener tokens with DexScreener data`);
      }
      
      tokens = [...tokens, ...screenerTokens];
      console.log(`✅ Fetched ${screenerTokens.length} tokens from main tokens collection`);
    } catch (error) {
      console.log("❌ Main tokens collection fetch failed:", error);
    }

    // 4. Load local Zora tokens as fallback
    if (fs.existsSync(DB_FILE)) {
      try {
        console.log("📊 Loading from local Zora file...");
        const data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
        const localTokens: TokenData[] = data.tokens || [];
        console.log(`📊 Found ${localTokens.length} tokens in local Zora file`);
        
        // Only add tokens that aren't already in our list
        const existingAddresses = new Set(tokens.map(t => t.address.toLowerCase()));
        const newLocalTokens = localTokens.filter(t => !existingAddresses.has(t.address.toLowerCase()));
        tokens = [...tokens, ...newLocalTokens];
        console.log(`✅ Added ${newLocalTokens.length} new tokens from local file`);
      } catch (fileError) {
        console.error("❌ Error reading local file:", fileError);
      }
    } else {
      console.log("⚠️ Local Zora file not found");
    }

    // 5. Add sample tokens if we have no real data
    if (tokens.length === 0) {
      console.log("⚠️ No tokens found, adding sample data...");
      tokens = [...tokens, ...sampleTokens];
    }



    console.log(`📊 Total tokens before deduplication: ${tokens.length}`);

    // Remove duplicates based on address
    const uniqueTokens = tokens.filter((token, index, self) => 
      index === self.findIndex(t => t.address.toLowerCase() === token.address.toLowerCase())
    );
    console.log(`📊 Total unique tokens after deduplication: ${uniqueTokens.length}`);

    // Filter by market cap and volume - only allow pairs > $50k market cap and > $10k volume
    const filteredTokens = uniqueTokens.filter((token: TokenData) => {
      const marketCap = typeof token.marketCap === 'string' ? parseFloat(token.marketCap) : (token.marketCap || 0);
      const volume24h = typeof token.volume24h === 'string' ? parseFloat(token.volume24h) : (token.volume24h || 0);
      
      return marketCap >= 50000 && volume24h >= 10000;
    });
    console.log(`📊 Total tokens after market cap ($50k+) and volume ($10k+) filter: ${filteredTokens.length}`);

    // Search filter
    if (search) {
      const searchLower = search.toLowerCase();
      tokens = filteredTokens.filter((token: TokenData) => 
        token.name?.toLowerCase().includes(searchLower) ||
        token.symbol?.toLowerCase().includes(searchLower) ||
        token.address?.toLowerCase().includes(searchLower)
      );
    } else {
      tokens = filteredTokens;
    }

    // Sort tokens - prioritize scored tokens first, then by score, then by the requested sort
    tokens.sort((a: TokenData, b: TokenData) => {
      // First, prioritize tokens with scores
      const aHasScore = typeof a.score === 'number' && a.score > 0;
      const bHasScore = typeof b.score === 'number' && b.score > 0;
      
      if (aHasScore && !bHasScore) return -1;
      if (!aHasScore && bHasScore) return 1;
      
      // If both have scores, sort by score first (highest first)
      if (aHasScore && bHasScore) {
        const scoreDiff = (b.score || 0) - (a.score || 0);
        if (Math.abs(scoreDiff) > 5) return scoreDiff; // If score difference is significant, use it
      }
      
      // Then sort by the requested field
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

    // Add enhanced tags to tokens
    const tokensWithTags = tokens.map((token: TokenData) => {
      const tags: string[] = [];
      
      // Add source tag
      tags.push(token.source.toUpperCase());
      
      // NEW tag - if created in last 10 days (always check, even if tags exist)
      if (token.createdAt) {
        try {
          const created = new Date(token.createdAt);
          const now = new Date();
          const daysDiff = (now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
          if (daysDiff <= 10 && daysDiff >= 0 && !tags.includes('NEW')) {
            tags.push('NEW');
          }
        } catch (dateError) {
          // Invalid date, skip NEW tag
        }
      }
      
      // SURGING tag - based on volume/market cap moves with positive price movement
      const marketCap = parseFloat(String(token.marketCap) || '0');
      const volume = parseFloat(String(token.volume24h) || '0');
      const priceChange1h = token.priceChange?.h1 || 0;
      const priceChange24h = token.priceChange?.h24 || 0;
      
      // Calculate surge score based on volume, market cap, and positive price movement
      let surgeScore = 0;
      
      // Only consider positive price movements for surging
      if (priceChange1h > 0 || priceChange24h > 0) {
        
        // Volume-based scoring (higher weight for volume)
        if (volume > 1000000) surgeScore += 4; // $1M+ volume
        else if (volume > 500000) surgeScore += 3; // $500K+ volume
        else if (volume > 100000) surgeScore += 2; // $100K+ volume
        else if (volume > 50000) surgeScore += 1; // $50K+ volume
        
        // Market cap movement scoring
        if (marketCap > 10000000) { // > $10M market cap
          if (priceChange1h > 2 || priceChange24h > 5) surgeScore += 2; // Moderate moves for large caps
        } else if (marketCap > 1000000) { // $1M - $10M market cap
          if (priceChange1h > 3 || priceChange24h > 8) surgeScore += 2; // Moderate moves for medium caps
        } else if (marketCap > 100000) { // $100K - $1M market cap
          if (priceChange1h > 5 || priceChange24h > 15) surgeScore += 2; // Moderate moves for small caps
        } else { // < $100K market cap
          if (priceChange1h > 10 || priceChange24h > 25) surgeScore += 2; // Moderate moves for micro caps
        }
        
        // Volume to market cap ratio bonus
        if (marketCap > 0) {
          const volumeToMC = volume / marketCap;
          if (volumeToMC > 0.5) surgeScore += 2; // High volume relative to market cap
          else if (volumeToMC > 0.2) surgeScore += 1; // Moderate volume relative to market cap
        }
      }
      
      if (surgeScore >= 4) {
        tags.push('SURGING');
      }
      
      // VOLUME tag - if volume > $50K in 24h
      if (volume > 50000) {
        tags.push('VOLUME');
      }
      
      // RUNNER tag - if market cap < $500K and volume > $10K
      if (marketCap < 500000 && volume > 10000) {
        tags.push('RUNNER');
      }
      
      // TRENDING tag - if holders > 500
      const holders = parseInt(String(token.uniqueHolders) || '0');
      if (holders > 500) {
        tags.push('TRENDING');
      }
      
      // LIQUIDITY tag - if liquidity > $50K
      const liquidity = parseFloat(String(token.liquidity?.usd || '0'));
      if (liquidity > 50000) {
        tags.push('LIQUIDITY');
      }
      
      // MOONSHOT tag - if market cap < $100K but volume > $5K
      if (marketCap < 100000 && volume > 5000) {
        tags.push('MOONSHOT');
      }
      
      // ESTABLISHED tag - if market cap > $5M
      if (marketCap > 5000000) {
        tags.push('ESTABLISHED');
      }
      
      // GAINER tag - if market cap delta > 20%
      const marketCapDelta24h = parseFloat(String(token.marketCapDelta24h) || '0');
      if (marketCapDelta24h > 20) {
        tags.push('GAINER');
      }
      
      return {
        ...token,
        tags
      };
    });

    console.log(`🎯 Final result: ${tokensWithTags.length} tokens with tags`);

    return new Response(JSON.stringify({
      tokens: tokensWithTags,
      total: tokensWithTags.length,
      sources: ['cypherscope', 'zora', 'clanker', 'screener', 'zora-local', 'sample'],
      debug: {
        cypherscopeCount: tokens.filter(t => t.source === 'zora' && t.id).length,
        zoraCount: tokens.filter(t => t.source === 'zora' && !t.id).length,
        clankerCount: tokens.filter(t => t.source === 'clanker').length,
        screenerCount: tokens.filter(t => t.source === 'screener').length,
        zoraLocalCount: tokens.filter(t => t.source === 'zora' && !t.id && !t.source).length,
        sampleCount: tokens.filter(t => t.source === 'sample').length
      }
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("❌ API Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to fetch tokens";
    return new Response(JSON.stringify({ 
      error: errorMessage,
      tokens: sampleTokens.map(token => ({ 
        ...token, 
        tags: ['SAMPLE', 'NEW', 'VOLUME'] // Add some default tags for sample tokens
      })),
      total: sampleTokens.length
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
} 