/**
 * Utility functions for token liquidity validation
 */

export interface TokenLiquidityInfo {
  liquidity: number; // USD liquidity
  price: number;
  pairAddress?: string;
  chainId?: string;
}

/**
 * Get token liquidity from DexScreener
 */
export async function getTokenLiquidity(tokenAddress: string): Promise<TokenLiquidityInfo | null> {
  try {
    const response = await fetch(
      `https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`,
      { cache: "no-store" }
    );
    
    if (!response.ok) {
      return null;
    }
    
    const data = await response.json();
    const pairs = data.pairs || [];
    
    if (pairs.length === 0) {
      return null;
    }
    
    // Find the best pair with highest liquidity on Base chain
    const basePairs = pairs.filter((p: any) => 
      p.chainId === 'base' || p.chainId === '8453'
    );
    
    const bestPair = (basePairs.length > 0 ? basePairs : pairs).reduce((best: any, current: any) => {
      const bestLiquidity = parseFloat(best.liquidity?.usd || "0");
      const currentLiquidity = parseFloat(current.liquidity?.usd || "0");
      return currentLiquidity > bestLiquidity ? current : best;
    }, pairs[0]);
    
    const liquidity = parseFloat(bestPair.liquidity?.usd || "0");
    const price = parseFloat(bestPair.priceUsd || "0");
    
    return {
      liquidity,
      price,
      pairAddress: bestPair.pairAddress,
      chainId: bestPair.chainId
    };
  } catch (error) {
    console.error(`Error fetching token liquidity for ${tokenAddress}:`, error);
    return null;
  }
}

/**
 * Get maximum bet size based on token liquidity
 * Tiered system:
 * - < 1M liquidity: Not allowed (minimum requirement)
 * - 1M - 5M liquidity: Max $50 bet
 * - 5M - 10M liquidity: Max $200 bet
 * - 10M - 50M liquidity: Max $500 bet
 * - 50M+ liquidity: Max $2000 bet
 */
export function getMaxBetSize(liquidity: number): number {
  if (liquidity < 1_000_000) {
    return 0; // Not allowed
  } else if (liquidity < 5_000_000) {
    return 50;
  } else if (liquidity < 10_000_000) {
    return 200;
  } else if (liquidity < 50_000_000) {
    return 500;
  } else {
    return 2000;
  }
}

/**
 * Get minimum liquidity required (1M)
 */
export const MIN_LIQUIDITY = 1_000_000;


