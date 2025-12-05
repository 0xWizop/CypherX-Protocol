import { NextResponse } from "next/server";
import { ethers } from "ethers";

// Constants
const BASE_RPC_URL = "https://base-mainnet.g.alchemy.com/v2/8KR6qwxbLlIISgrMCZfsrYeMmn6-S-bN";

// Search result types
interface TokenSearchResult {
  type: "token";
  address: string;
  poolAddress?: string;
  secondaryPoolAddress?: string;
  name: string;
  symbol: string;
  marketCap?: number;
  volume24h?: number;
  priceUsd?: string;
  liquidity?: { usd: number };
  source: string;
  imageUrl?: string;
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
  txns?: {
    h1: { buys: number; sells: number };
    h6: { buys: number; sells: number };
    h24: { buys: number; sells: number };
  };
  // Additional metadata from DexScreener
  fdv?: number;
  pairCreatedAt?: number;
  dexId?: string;
  url?: string;
  metrics?: {
    priceChange24h: number;
    priceChange1h: number;
    priceChange6h: number;
    priceChange5m: number;
    totalTxns24h: number;
    totalTxns1h: number;
    totalTxns6h: number;
    buyRatio24h: number;
    buyRatio1h: number;
    volumeChange24h: number;
    liquidityChange24h: number;
  };
}

interface WalletSearchResult {
  type: "wallet";
  address: string;
  balance?: string;
  transactionCount?: number;
  lastActivity?: string | null;
}

interface TransactionSearchResult {
  type: "transaction";
  hash: string;
  blockNumber?: number | null;
  from: string;
  to: string;
  value?: string;
  status?: number | null;
  timestamp?: number;
}

interface BlockSearchResult {
  type: "block";
  number: number;
  hash: string | null;
  timestamp?: number;
  transactions?: number;
  gasUsed?: string | null;
  gasLimit?: string | null;
}

interface NewsSearchResult {
  type: "news";
  id: string;
  title: string;
  content: string;
  author: string;
  source: string;
  publishedAt: string;
  slug: string;
  thumbnailUrl?: string;
}

interface SearchResult {
  tokens: TokenSearchResult[];
  wallets: WalletSearchResult[];
  transactions: TransactionSearchResult[];
  blocks: BlockSearchResult[];
  news: NewsSearchResult[];
}

// Helper function to check if string is an Ethereum address
function isEthereumAddress(str: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(str);
}

// Helper function to check if string is a transaction hash
function isTransactionHash(str: string): boolean {
  return /^0x[a-fA-F0-9]{64}$/.test(str);
}

// Helper function to check if string is a block number
function isBlockNumber(str: string): boolean {
  return /^\d+$/.test(str);
}

// Search tokens from multiple sources
async function searchTokens(query: string, baseUrl: string): Promise<TokenSearchResult[]> {
  const results: TokenSearchResult[] = [];
  
  try {
    console.log('[Search API] Searching tokens with query:', query, 'baseUrl:', baseUrl);
    
    // First, try to search in our tokens collection
    const tokensUrl = `${baseUrl}/api/tokens?search=${encodeURIComponent(query)}&limit=10`;
    console.log('[Search API] Fetching from:', tokensUrl);
    
    let response;
    try {
      response = await fetch(tokensUrl, {
        headers: {
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(8000), // 8 second timeout
      });
    } catch (fetchError) {
      console.error('[Search API] Failed to fetch from internal tokens API:', fetchError);
      // Fall through to DexScreener search
    }
    
    if (response?.ok) {
      const data = await response.json();
      if (data.tokens) {
        // Enhance our tokens with DexScreener data using the same pattern as token screener
        const enhancedTokensArrays = await Promise.all(
          data.tokens.map(async (token: any) => {
            // Use the same DexScreener API pattern as token screener
            const dexResponse = await fetch(`https://api.dexscreener.com/tokens/v1/base/${token.address}`, {
              headers: { Accept: "application/json" }
            });
            
            if (dexResponse.ok) {
              const dexData = await dexResponse.json();
              const pairs = Array.isArray(dexData) ? dexData : [dexData];

              // Also fetch from the 'latest' endpoint which often has more pairs
              let morePairs: any[] = [];
              try {
                const dexResponse2 = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${token.address}`, {
                  headers: { Accept: "application/json" }
                });
                if (dexResponse2.ok) {
                  const dexData2 = await dexResponse2.json();
                  morePairs = Array.isArray(dexData2?.pairs) ? dexData2.pairs : [];
                }
              } catch (_) {}

              // Merge and dedupe pairs by pairAddress
              const combinedMap: Record<string, any> = {};
              [...pairs, ...morePairs].forEach((p: any) => {
                const key = String(p?.pairAddress || "").toLowerCase();
                if (key) combinedMap[key] = p;
              });
              const combinedPairs: any[] = Object.values(combinedMap);

              // Select only supported pools: those configured in our tokens collection (pool/pair and pool2/pair2)
              const wantedPoolsSet = new Set<string>();
              if (token.poolAddress) wantedPoolsSet.add(String(token.poolAddress).toLowerCase());
              if (token.secondaryPoolAddress) wantedPoolsSet.add(String(token.secondaryPoolAddress).toLowerCase());
              const selectedPairs = combinedPairs.filter((p: any) => wantedPoolsSet.has(String(p?.pairAddress || "").toLowerCase()));

              const mapped: TokenSearchResult[] = selectedPairs.map((pair: any) => {
                const priceChange = pair.priceChange || {};
                const volume = pair.volume || {};
                const txns = pair.txns || {};
                const priceUsd = parseFloat(pair.priceUsd || "0");
                const marketCap = parseFloat(pair.marketCap || "0");
                const liquidityUsd = parseFloat(pair.liquidity?.usd || "0");
                const volume24h = parseFloat(volume.h24 || "0");
                const volume1h = parseFloat(volume.h1 || "0");
                const priceChange24h = parseFloat(priceChange.h24 || "0");
                const priceChange1h = parseFloat(priceChange.h1 || "0");
                const priceChange6h = parseFloat(priceChange.h6 || "0");
                const priceChange5m = parseFloat(priceChange.m5 || "0");
                const totalTxns24h = (txns.h24?.buys || 0) + (txns.h24?.sells || 0);
                const totalTxns1h = (txns.h1?.buys || 0) + (txns.h1?.sells || 0);
                const totalTxns6h = (txns.h6?.buys || 0) + (txns.h6?.sells || 0);
                const buyRatio24h = totalTxns24h > 0 ? (txns.h24?.buys || 0) / totalTxns24h : 0;
                const buyRatio1h = totalTxns1h > 0 ? (txns.h1?.buys || 0) / totalTxns1h : 0;
                return {
                  type: "token" as const,
                  address: token.address,
                  poolAddress: pair.pairAddress || token.poolAddress,
                  secondaryPoolAddress: token.secondaryPoolAddress,
                  name: token.name,
                  symbol: token.symbol,
                  marketCap: marketCap || token.marketCap,
                  volume24h: volume24h || token.volume24h,
                  priceUsd: priceUsd > 0 ? priceUsd.toString() : undefined,
                  liquidity: { usd: liquidityUsd },
                  source: "CypherX",
                  imageUrl: pair.info?.imageUrl || undefined,
                  priceChange: {
                    m5: priceChange5m,
                    h1: priceChange1h,
                    h6: priceChange6h,
                    h24: priceChange24h
                  },
                  volume: {
                    h1: volume1h,
                    h24: volume24h
                  },
                  txns: {
                    h1: { buys: txns.h1?.buys || 0, sells: txns.h1?.sells || 0 },
                    h6: { buys: txns.h6?.buys || 0, sells: txns.h6?.sells || 0 },
                    h24: { buys: txns.h24?.buys || 0, sells: txns.h24?.sells || 0 }
                  },
                  fdv: parseFloat(pair.fdv || "0"),
                  pairCreatedAt: pair.pairCreatedAt,
                  dexId: pair.dexId,
                  url: pair.url,
                  metrics: {
                    priceChange24h,
                    priceChange1h,
                    priceChange6h,
                    priceChange5m,
                    totalTxns24h,
                    totalTxns1h,
                    totalTxns6h,
                    buyRatio24h,
                    buyRatio1h,
                    volumeChange24h: volume24h > 0 ? ((volume24h - parseFloat(volume.h6 || "0")) / volume24h) * 100 : 0,
                    liquidityChange24h: liquidityUsd > 0 ? ((liquidityUsd - parseFloat(pair.liquidity?.h24 || "0")) / liquidityUsd) * 100 : 0
                  }
                };
              });

              // Ensure we include all configured pools: fetch any missing wanted pairs explicitly
              const wantedPoolsSet2 = new Set<string>();
              if (token.poolAddress) wantedPoolsSet2.add(String(token.poolAddress).toLowerCase());
              if (token.secondaryPoolAddress) wantedPoolsSet2.add(String(token.secondaryPoolAddress).toLowerCase());
              const found = new Set<string>(mapped.map(m => String(m.poolAddress || '').toLowerCase()).filter(Boolean));
              const missing = Array.from(wantedPoolsSet2).filter(w => !found.has(w));
              if (missing.length > 0) {
                for (const w of missing) {
                  try {
                    const pairRes = await fetch(`https://api.dexscreener.com/latest/dex/pairs/base/${w}`, { headers: { Accept: "application/json" } });
                    if (!pairRes.ok) continue;
                    const pairData = await pairRes.json();
                    const pair = Array.isArray(pairData?.pairs) ? pairData.pairs[0] : pairData?.pair || pairData;
                    if (!pair?.pairAddress) continue;
                    const priceChange = pair.priceChange || {};
                    const volume = pair.volume || {};
                    const txns = pair.txns || {};
                    const priceUsd = parseFloat(pair.priceUsd || "0");
                    const marketCap = parseFloat(pair.marketCap || "0");
                    const liquidityUsd = parseFloat(pair.liquidity?.usd || "0");
                    const volume24h = parseFloat(volume.h24 || "0");
                    const volume1h = parseFloat(volume.h1 || "0");
                    const priceChange24h = parseFloat(priceChange.h24 || "0");
                    const priceChange1h = parseFloat(priceChange.h1 || "0");
                    const priceChange6h = parseFloat(priceChange.h6 || "0");
                    const priceChange5m = parseFloat(priceChange.m5 || "0");
                    const totalTxns24h = (txns.h24?.buys || 0) + (txns.h24?.sells || 0);
                    const totalTxns1h = (txns.h1?.buys || 0) + (txns.h1?.sells || 0);
                    const totalTxns6h = (txns.h6?.buys || 0) + (txns.h6?.sells || 0);
                    const buyRatio24h = totalTxns24h > 0 ? (txns.h24?.buys || 0) / totalTxns24h : 0;
                    const buyRatio1h = totalTxns1h > 0 ? (txns.h1?.buys || 0) / totalTxns1h : 0;
                    mapped.push({
                      type: "token",
                      address: token.address,
                      poolAddress: pair.pairAddress,
                      secondaryPoolAddress: token.secondaryPoolAddress,
                      name: token.name,
                      symbol: token.symbol,
                      marketCap: marketCap || token.marketCap,
                      volume24h: volume24h || token.volume24h,
                      priceUsd: priceUsd > 0 ? priceUsd.toString() : undefined,
                      liquidity: { usd: liquidityUsd },
                      source: "CypherX",
                      imageUrl: pair.info?.imageUrl || undefined,
                      priceChange: { m5: priceChange5m, h1: priceChange1h, h6: priceChange6h, h24: priceChange24h },
                      volume: { h1: volume1h, h24: volume24h },
                      txns: {
                        h1: { buys: txns.h1?.buys || 0, sells: txns.h1?.sells || 0 },
                        h6: { buys: txns.h6?.buys || 0, sells: txns.h6?.sells || 0 },
                        h24: { buys: txns.h24?.buys || 0, sells: txns.h24?.sells || 0 }
                      },
                      fdv: parseFloat(pair.fdv || "0"),
                      pairCreatedAt: pair.pairCreatedAt,
                      dexId: pair.dexId,
                      url: pair.url,
                      metrics: {
                        priceChange24h,
                        priceChange1h,
                        priceChange6h,
                        priceChange5m,
                        totalTxns24h,
                        totalTxns1h,
                        totalTxns6h,
                        buyRatio24h,
                        buyRatio1h,
                        volumeChange24h: volume24h > 0 ? ((volume24h - parseFloat(volume.h6 || "0")) / volume24h) * 100 : 0,
                        liquidityChange24h: liquidityUsd > 0 ? ((liquidityUsd - parseFloat(pair.liquidity?.h24 || "0")) / liquidityUsd) * 100 : 0
                      }
                    });
                  } catch (_) {}
                }
              }
              // If no pairs returned, try explicit fetch of configured pairs
              if (mapped.length === 0 && wantedPoolsSet.size > 0) {
                const wantedArr = Array.from(wantedPoolsSet);
                const fetched: any[] = [];
                for (const w of wantedArr) {
                  try {
                    const pairRes = await fetch(`https://api.dexscreener.com/latest/dex/pairs/base/${w}`, { headers: { Accept: "application/json" } });
                    if (!pairRes.ok) continue;
                    const pairData = await pairRes.json();
                    const pair = Array.isArray(pairData?.pairs) ? pairData.pairs[0] : pairData?.pair || pairData;
                    if (pair?.pairAddress) fetched.push(pair);
                  } catch (_) {}
                }
                if (fetched.length > 0) {
                  return fetched.map((pair: any) => {
                    const priceChange = pair.priceChange || {};
                    const volume = pair.volume || {};
                    const txns = pair.txns || {};
                    const priceUsd = parseFloat(pair.priceUsd || "0");
                    const marketCap = parseFloat(pair.marketCap || "0");
                    const liquidityUsd = parseFloat(pair.liquidity?.usd || "0");
                    const volume24h = parseFloat(volume.h24 || "0");
                    const volume1h = parseFloat(volume.h1 || "0");
                    const priceChange24h = parseFloat(priceChange.h24 || "0");
                    const priceChange1h = parseFloat(priceChange.h1 || "0");
                    const priceChange6h = parseFloat(priceChange.h6 || "0");
                    const priceChange5m = parseFloat(priceChange.m5 || "0");
                    const totalTxns24h = (txns.h24?.buys || 0) + (txns.h24?.sells || 0);
                    const totalTxns1h = (txns.h1?.buys || 0) + (txns.h1?.sells || 0);
                    const totalTxns6h = (txns.h6?.buys || 0) + (txns.h6?.sells || 0);
                    const buyRatio24h = totalTxns24h > 0 ? (txns.h24?.buys || 0) / totalTxns24h : 0;
                    const buyRatio1h = totalTxns1h > 0 ? (txns.h1?.buys || 0) / totalTxns1h : 0;
                    return {
                      type: "token" as const,
                      address: token.address,
                      poolAddress: pair.pairAddress || token.poolAddress,
                      secondaryPoolAddress: token.secondaryPoolAddress,
                      name: token.name,
                      symbol: token.symbol,
                      marketCap: marketCap || token.marketCap,
                      volume24h: volume24h || token.volume24h,
                      priceUsd: priceUsd > 0 ? priceUsd.toString() : undefined,
                      liquidity: { usd: liquidityUsd },
                      source: "CypherX",
                      imageUrl: pair.info?.imageUrl || undefined,
                      priceChange: { m5: priceChange5m, h1: priceChange1h, h6: priceChange6h, h24: priceChange24h },
                      volume: { h1: volume1h, h24: volume24h },
                      txns: {
                        h1: { buys: txns.h1?.buys || 0, sells: txns.h1?.sells || 0 },
                        h6: { buys: txns.h6?.buys || 0, sells: txns.h6?.sells || 0 },
                        h24: { buys: txns.h24?.buys || 0, sells: txns.h24?.sells || 0 }
                      },
                      fdv: parseFloat(pair.fdv || "0"),
                      pairCreatedAt: pair.pairCreatedAt,
                      dexId: pair.dexId,
                      url: pair.url,
                      metrics: {
                        priceChange24h,
                        priceChange1h,
                        priceChange6h,
                        priceChange5m,
                        totalTxns24h,
                        totalTxns1h,
                        totalTxns6h,
                        buyRatio24h,
                        buyRatio1h,
                        volumeChange24h: volume24h > 0 ? ((volume24h - parseFloat(volume.h6 || "0")) / volume24h) * 100 : 0,
                        liquidityChange24h: liquidityUsd > 0 ? ((liquidityUsd - parseFloat(pair.liquidity?.h24 || "0")) / liquidityUsd) * 100 : 0
                      }
                    };
                  });
                }
              }
              // If still nothing, return empty array (we only show supported pools)
              if (mapped.length === 0) {
                return [] as TokenSearchResult[];
              }
              return mapped;
            }
            
            // Fallback to basic token data if DexScreener data not available
            return [{
              type: "token" as const,
              address: token.address,
              poolAddress: token.poolAddress,
              secondaryPoolAddress: token.secondaryPoolAddress,
              name: token.name,
              symbol: token.symbol,
              marketCap: token.marketCap,
              volume24h: token.volume24h,
              source: "CypherX",
              imageUrl: undefined
            }];
          })
        );
        // Flatten arrays and dedupe by poolAddress
        const flattened = enhancedTokensArrays.flat();
        const seenPools = new Set<string>();
        for (const r of flattened) {
          const key = (r.poolAddress || "").toLowerCase();
          if (key && !seenPools.has(key)) {
            seenPools.add(key);
            results.push(r);
          }
        }
      }
    }
  } catch (error: any) {
    console.error("[Search API] Error searching tokens:", error?.message || error);
  }

  // If no results from our DB, try DexScreener direct search as fallback
  if (results.length === 0 && query.length >= 2) {
    try {
      console.log('[Search API] No internal results, trying DexScreener search');
      const dexSearchUrl = `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(query)}`;
      const dexResponse = await fetch(dexSearchUrl, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(5000),
      });
      
      if (dexResponse.ok) {
        const dexData = await dexResponse.json();
        const pairs = dexData?.pairs || [];
        const basePairs = pairs.filter((p: any) => p.chainId === 'base').slice(0, 10);
        
        for (const pair of basePairs) {
          if (!pair.baseToken?.address) continue;
          results.push({
            type: "token",
            address: pair.baseToken.address,
            poolAddress: pair.pairAddress,
            name: pair.baseToken.name || 'Unknown',
            symbol: pair.baseToken.symbol || '???',
            marketCap: pair.marketCap || pair.fdv || 0,
            volume24h: pair.volume?.h24 || 0,
            priceUsd: pair.priceUsd,
            liquidity: pair.liquidity,
            source: 'dexscreener',
            imageUrl: pair.info?.imageUrl,
            priceChange: pair.priceChange,
            volume: pair.volume,
            txns: pair.txns,
            fdv: pair.fdv,
            pairCreatedAt: pair.pairCreatedAt,
            dexId: pair.dexId,
            url: pair.url,
          });
        }
      }
    } catch (dexError) {
      console.error('[Search API] External search fallback failed:', dexError);
    }
  }

  return results.slice(0, 10);
}

// Search news articles
async function searchNews(query: string, baseUrl: string): Promise<NewsSearchResult[]> {
  const results: NewsSearchResult[] = [];
  
  try {
    // Use absolute URL for internal API call with proper error handling
    const newsUrl = `${baseUrl}/api/news`;
    const response = await fetch(newsUrl, {
      headers: {
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });
    if (response.ok) {
      const articles = await response.json();
      
      // Filter articles by title, content, or author
      const filteredArticles = articles.filter((article: any) => {
        const searchText = query.toLowerCase();
        return (
          article.title?.toLowerCase().includes(searchText) ||
          article.content?.toLowerCase().includes(searchText) ||
          article.author?.toLowerCase().includes(searchText) ||
          article.source?.toLowerCase().includes(searchText)
        );
      });
      
      results.push(...filteredArticles.slice(0, 5).map((article: any) => ({
        type: "news" as const,
        id: article.id || article.slug,
        title: article.title,
        content: article.content,
        author: article.author,
        source: article.source,
        publishedAt: article.publishedAt,
        slug: article.slug,
        thumbnailUrl: article.thumbnailUrl
      })));
    }
  } catch (error: any) {
    console.error("Error searching news:", error);
    if (error.name === 'AbortError') {
      console.error("News search request timed out");
    } else if (error.message) {
      console.error("News search error message:", error.message);
    }
  }

  return results;
}


// Calendar events search removed

// Search wallet information
async function searchWallet(address: string): Promise<WalletSearchResult | null> {
  try {
    const provider = new ethers.JsonRpcProvider(BASE_RPC_URL);
    
    // Get wallet balance
    const balance = await provider.getBalance(address);
    
    // Get transaction count
    const transactionCount = await provider.getTransactionCount(address);
    
    // Get latest transaction for last activity
    const latestBlock = await provider.getBlockNumber();
    let lastActivity = null;
    
    try {
      // Try to get the latest transaction involving this address
      const filter = {
        fromBlock: latestBlock - 1000, // Last 1000 blocks
        toBlock: latestBlock,
        address: address
      };
      
      const logs = await provider.getLogs(filter);
      if (logs.length > 0) {
        const latestLog = logs[logs.length - 1];
        const block = await provider.getBlock(latestLog.blockNumber);
        lastActivity = new Date(block?.timestamp ? block.timestamp * 1000 : Date.now()).toISOString();
      }
    } catch (error) {
      console.error("Error getting last activity:", error);
    }
    
    return {
      type: "wallet",
      address,
      balance: ethers.formatEther(balance),
      transactionCount: transactionCount,
      lastActivity
    };
  } catch (error) {
    console.error("Error searching wallet:", error);
    return null;
  }
}

// Search transaction information
async function searchTransaction(hash: string): Promise<TransactionSearchResult | null> {
  try {
    const provider = new ethers.JsonRpcProvider(BASE_RPC_URL);
    
    // Get transaction receipt
    const receipt = await provider.getTransactionReceipt(hash);
    if (!receipt) return null;
    
    // Get transaction details
    const tx = await provider.getTransaction(hash);
    
    // Get block for timestamp
    const block = await provider.getBlock(receipt.blockNumber);
    
    return {
      type: "transaction",
      hash,
      blockNumber: receipt.blockNumber || undefined,
      from: receipt.from,
      to: receipt.to || "",
      value: tx?.value ? ethers.formatEther(tx.value) : undefined,
      status: receipt.status || undefined,
      timestamp: block?.timestamp ? block.timestamp * 1000 : undefined
    };
  } catch (error) {
    console.error("Error searching transaction:", error);
    return null;
  }
}

// Search block information
async function searchBlock(numberOrHash: string): Promise<BlockSearchResult | null> {
  try {
    const provider = new ethers.JsonRpcProvider(BASE_RPC_URL);
    
    let block;
    if (isBlockNumber(numberOrHash)) {
      block = await provider.getBlock(parseInt(numberOrHash));
    } else {
      block = await provider.getBlock(numberOrHash);
    }
    
    if (!block) return null;
    
    return {
      type: "block",
      number: block.number,
      hash: block.hash,
      timestamp: block.timestamp ? block.timestamp * 1000 : undefined,
      transactions: block.transactions.length,
      gasUsed: block.gasUsed?.toString(),
      gasLimit: block.gasLimit?.toString()
    };
  } catch (error) {
    console.error("Error searching block:", error);
    return null;
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const { searchParams } = url;
  const query = searchParams.get('q') || '';
  
  try {
    
    // Get base URL for internal API calls
    // Priority: NEXT_PUBLIC_BASE_URL > VERCEL_URL > construct from request
    let baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_APP_URL;
    
    if (!baseUrl && process.env.VERCEL_URL) {
      // On Vercel, use the VERCEL_URL with https
      baseUrl = `https://${process.env.VERCEL_URL}`;
    }
    
    if (!baseUrl) {
      // Fallback: construct from request URL
      const protocol = url.protocol || 'https:';
      const host = url.host || 'localhost:3000';
      baseUrl = `${protocol}//${host}`;
    }
    
    // Ensure baseUrl doesn't end with a slash and uses https in production
    baseUrl = baseUrl.replace(/\/$/, '');
    if (process.env.NODE_ENV === 'production' && baseUrl.startsWith('http://')) {
      baseUrl = baseUrl.replace('http://', 'https://');
    }
    
    console.log('[Search API] Using baseUrl:', baseUrl, 'Query:', query);
    
    if (!query || query.trim().length === 0) {
      return NextResponse.json({
        success: false,
        error: "Query parameter 'q' is required"
      }, { status: 400 });
    }

    const results: SearchResult = {
      tokens: [],
      wallets: [],
      transactions: [],
      blocks: [],
      news: []
    };

    // Determine query type and search accordingly
    if (isEthereumAddress(query)) {
      // Search for wallet
      const walletResult = await searchWallet(query);
      if (walletResult) {
        results.wallets.push(walletResult);
      }
      
      // Also search for tokens with this address
      const tokenResults = await searchTokens(query, baseUrl);
      results.tokens.push(...tokenResults);
      
    } else if (isTransactionHash(query)) {
      // Search for transaction
      const txResult = await searchTransaction(query);
      if (txResult) {
        results.transactions.push(txResult);
      }
      
    } else if (isBlockNumber(query)) {
      // Search for block
      const blockResult = await searchBlock(query);
      if (blockResult) {
        results.blocks.push(blockResult);
      }
      
    } else {
      // Search for tokens by name/symbol
      const tokenResults = await searchTokens(query, baseUrl);
      results.tokens.push(...tokenResults);
      
      // Search for news articles
      const newsResults = await searchNews(query, baseUrl);
      results.news.push(...newsResults);
      
      // If query looks like a block number, try searching for it
      if (isBlockNumber(query)) {
        const blockResult = await searchBlock(query);
        if (blockResult) {
          results.blocks.push(blockResult);
        }
      }
    }
    
    return NextResponse.json({
      success: true,
      query,
      results,
      totalResults: results.tokens.length + results.wallets.length + results.transactions.length + results.blocks.length + results.news.length
    });
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    console.error("[Search API] Error:", {
      message: errorMessage,
      stack: errorStack,
      query: query || 'unknown',
      environment: process.env.NODE_ENV,
      baseUrl: process.env.NEXT_PUBLIC_BASE_URL || 'not set',
      appUrl: process.env.NEXT_PUBLIC_APP_URL || 'not set'
    });
    
    return NextResponse.json({
      success: false,
      error: "Failed to perform search",
      details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
    }, { status: 500 });
  }
}
