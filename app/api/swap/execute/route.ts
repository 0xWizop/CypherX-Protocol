import { NextResponse } from "next/server";
import { ethers } from "ethers";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { processSwapRewards } from "@/lib/swap-rewards";

// Constants
const BASE_RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || "https://base-mainnet.g.alchemy.com/v2/8KR6qwxbLlIISgrMCZfsrYeMmn6-S-bN";
const WETH_ADDRESS = "0x4200000000000000000000000000000000000006";
const BASE_CHAIN_ID = "8453";

// 0x API Configuration
const ZEROX_API_KEY = process.env.ZEROX_API_KEY || "";
const ZEROX_API_URL = "https://api.0x.org";

// Treasury configuration
// Platform fee is 0.3% (0.003) - calculated inline where needed
// Rewards are now handled by processSwapRewards from lib/swap-rewards.ts

// ERC20 ABI for approvals
const ERC20_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function balanceOf(address account) external view returns (uint256)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function decimals() external view returns (uint8)",
];

interface SwapRequest {
  inputToken: string;
  outputToken: string;
  inputAmount: string;
  outputAmount: string;
  slippage: number;
  walletAddress: string;
  privateKey: string;
  tokenAddress?: string;
  outputTokenAddress?: string;
}

interface ZeroXQuote {
  buyAmount: string;
  sellAmount: string;
  allowanceTarget?: string;
  transaction: {
    to: string;
    data: string;
    value: string;
    gas: string;
    gasPrice: string;
  };
  permit2?: {
    eip712: object;
  };
  issues?: {
    allowance?: {
      spender: string;
      actual: string;
      expected: string;
    };
    balance?: {
      token: string;
      actual: string;
      expected: string;
    };
  };
}

// Get token address from symbol
function getTokenAddress(symbol: string, tokenAddress?: string): string {
  if (symbol === "ETH" || symbol === "WETH") {
    return WETH_ADDRESS;
  }
  if (tokenAddress) {
    return tokenAddress;
  }
  throw new Error(`Token address required for ${symbol}`);
}

// Get token decimals
async function getTokenDecimals(provider: ethers.Provider, tokenAddress: string): Promise<number> {
  if (tokenAddress.toLowerCase() === WETH_ADDRESS.toLowerCase()) {
    return 18;
  }
  try {
    const contract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
    return await contract.decimals();
  } catch {
    return 18;
  }
}

// Check wallet balance
async function checkBalance(
  provider: ethers.Provider,
  walletAddress: string,
  tokenAddress: string,
  amount: string,
  decimals: number
): Promise<boolean> {
  const amountWei = ethers.parseUnits(amount, decimals);
  
  if (tokenAddress.toLowerCase() === WETH_ADDRESS.toLowerCase()) {
    const balance = await provider.getBalance(walletAddress);
    return balance >= amountWei;
  } else {
    const contract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
    const balance = await contract.balanceOf(walletAddress);
    return balance >= amountWei;
  }
}

// Fetch quote from 0x API
async function get0xQuote(
  sellToken: string,
  buyToken: string,
  sellAmount: string,
  takerAddress: string,
  slippageBps: number = 100
): Promise<ZeroXQuote> {
  const url = new URL(`${ZEROX_API_URL}/swap/allowance-holder/quote`);
  url.searchParams.set("chainId", BASE_CHAIN_ID);
  url.searchParams.set("sellToken", sellToken);
  url.searchParams.set("buyToken", buyToken);
  url.searchParams.set("sellAmount", sellAmount);
  url.searchParams.set("taker", takerAddress);
  url.searchParams.set("slippageBps", slippageBps.toString());
      
  // Add affiliate fee if configured
  const feeRecipient = process.env.ZEROX_FEE_RECIPIENT;
  const feeBps = process.env.ZEROX_FEE_BPS;
  if (feeRecipient && feeBps) {
    url.searchParams.set("integratorFeeRecipient", feeRecipient);
    url.searchParams.set("integratorFeeBps", feeBps);
      }

  console.log("🔍 Fetching 0x quote:", {
    sellToken,
    buyToken,
    sellAmount,
    takerAddress,
    slippageBps,
    hasApiKey: !!ZEROX_API_KEY
  });

  const headers: Record<string, string> = {
    Accept: "application/json",
    "0x-version": "v2",
  };
  
  if (ZEROX_API_KEY) {
    headers["0x-api-key"] = ZEROX_API_KEY;
  }

  const response = await fetch(url.toString(), {
    headers,
    cache: "no-store",
  });

  const data = await response.json();

  if (!response.ok) {
    console.error("❌ 0x Quote Error:", {
      status: response.status,
      error: data
    });
    throw new Error(
      data?.reason || 
      data?.validationErrors?.[0]?.description || 
      `0x API error: ${response.status}`
    );
  }

  console.log("✅ 0x Quote received:", {
    buyAmount: data.buyAmount,
    sellAmount: data.sellAmount,
    hasAllowanceIssue: !!data.issues?.allowance,
    hasBalanceIssue: !!data.issues?.balance
  });

  return data;
  }
  
// Check and approve token spending
async function checkAndApproveToken(
  signer: ethers.Signer,
  tokenAddress: string,
  spenderAddress: string,
  amount: bigint
): Promise<void> {
  // ETH doesn't need approval
  if (tokenAddress.toLowerCase() === WETH_ADDRESS.toLowerCase()) {
    return;
  }

  const contract = new ethers.Contract(tokenAddress, ERC20_ABI, signer);
  const signerAddress = await signer.getAddress();
  const currentAllowance = await contract.allowance(signerAddress, spenderAddress);

  console.log("🔧 Token allowance check:", {
    currentAllowance: currentAllowance.toString(),
    requiredAmount: amount.toString(),
    needsApproval: currentAllowance < amount
  });

  if (currentAllowance < amount) {
    console.log("🔄 Approving token...");
    
    // Use max approval for convenience
    const maxApproval = ethers.MaxUint256;
    const approveTx = await contract.approve(spenderAddress, maxApproval);
    console.log("⏳ Waiting for approval tx:", approveTx.hash);
    
    const receipt = await approveTx.wait();
    console.log("✅ Token approved:", receipt.hash);
  } else {
    console.log("✅ Token already has sufficient allowance");
  }
}

// Get ETH price
async function getEthPrice(): Promise<number> {
  try {
    const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd', {
      cache: 'no-store'
    });
    const data = await response.json();
    return data.ethereum?.usd || 2500;
  } catch {
    return 2500;
  }
}

// Process fees and rewards (legacy function - now uses unified system)
async function processFeesAndRewards(
  walletAddress: string,
  swapValueUsd: number,
  swapValueEth: number,
  transactionHash: string,
  inputToken: string,
  outputToken: string,
  inputAmount: string,
  outputAmount: string,
  feeBps?: number
): Promise<{ platformFee: number; cashback: number; referralReward: number; treasuryFee: number; affiliateFee: number }> {
  try {
    const result = await processSwapRewards({
      walletAddress,
      swapValueUSD: swapValueUsd,
      swapValueETH: swapValueEth,
      transactionHash,
      inputToken,
      outputToken,
      inputAmount,
      outputAmount,
      feeBps
    });

    if (!result.success) {
      console.error("Reward processing failed:", result.error);
      return { platformFee: 0, cashback: 0, referralReward: 0, treasuryFee: 0, affiliateFee: 0 };
    }

    // Convert USD fees to ETH for backward compatibility
    const ethPrice = await getEthPrice();
    const platformFeeEth = (swapValueUsd * (0.0075 / 100)) / ethPrice; // 0.75% in ETH
    const treasuryFeeEth = result.rewards.treasuryFee / ethPrice;
    const affiliateFeeEth = result.rewards.affiliateFee / ethPrice;
    const cashbackEth = result.rewards.cashbackAmount / ethPrice;
    const referralRewardEth = result.rewards.referralReward / ethPrice;

    return {
      platformFee: platformFeeEth,
      cashback: cashbackEth,
      referralReward: referralRewardEth,
      treasuryFee: treasuryFeeEth,
      affiliateFee: affiliateFeeEth
    };
  } catch (error) {
    console.error("Error processing fees:", error);
    return { platformFee: 0, cashback: 0, referralReward: 0, treasuryFee: 0, affiliateFee: 0 };
  }
}

// Record swap in database
async function recordSwap(
  walletAddress: string,
  inputToken: string,
  outputToken: string,
  inputAmount: string,
  outputAmount: string,
  transactionHash: string,
  gasUsed: string,
  feeBps?: number
): Promise<{ platformFee: number; cashback: number; referralReward: number; treasuryFee: number; affiliateFee: number }> {
  try {
  const db = adminDb();
  if (!db) {
    return { platformFee: 0, cashback: 0, referralReward: 0, treasuryFee: 0, affiliateFee: 0 };
  }

    const ethPrice = await getEthPrice();
    const isEthInput = inputToken === "ETH" || inputToken === "WETH";
    const ethAmount = isEthInput ? parseFloat(inputAmount) : parseFloat(outputAmount);
    const swapValueUsd = ethAmount * ethPrice;
    const swapValueEth = ethAmount;
    
    console.log(`📊 Swap: ${swapValueEth.toFixed(4)} ETH ($${swapValueUsd.toFixed(2)})`);

    await db.collection("wallet_transactions").add({
      walletAddress,
      type: "swap",
      inputToken,
      outputToken,
      inputAmount,
      outputAmount,
      inputValue: swapValueUsd,
      outputValue: swapValueUsd,
      transactionHash,
      gasUsed,
      timestamp: FieldValue.serverTimestamp(),
      status: "confirmed",
      dexUsed: "0x"
    });

    const feeResult = await processFeesAndRewards(
      walletAddress,
      swapValueUsd,
      swapValueEth,
      transactionHash,
      inputToken,
      outputToken,
      inputAmount,
      outputAmount,
      feeBps
    );

    const userQuery = db.collection("users").where("walletAddress", "==", walletAddress);
    const userSnapshot = await userQuery.get();
    
    if (!userSnapshot.empty) {
      await db.collection("users").doc(userSnapshot.docs[0].id).update({
        lastActivity: FieldValue.serverTimestamp(),
      });
    }
    
    return feeResult;
  } catch (error) {
    console.error("Error recording swap:", error);
    return { platformFee: 0, cashback: 0, referralReward: 0, treasuryFee: 0, affiliateFee: 0 };
  }
}

export async function POST(request: Request) {
  try {
    const body: SwapRequest = await request.json();
    console.log("🔄 Swap request:", {
      inputToken: body.inputToken,
      outputToken: body.outputToken,
      inputAmount: body.inputAmount,
      walletAddress: body.walletAddress.slice(0, 10) + "...",
      tokenAddress: body.tokenAddress,
      outputTokenAddress: body.outputTokenAddress
    });
    
    const { 
      inputToken, 
      outputToken, 
      inputAmount, 
      outputAmount, 
      slippage, 
      walletAddress, 
      privateKey,
      tokenAddress,
      outputTokenAddress
    } = body;
    
    if (!inputToken || !outputToken || !inputAmount || !walletAddress || !privateKey) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    
    const amount = parseFloat(inputAmount);
    if (isNaN(amount) || amount <= 0) {
      return NextResponse.json({ error: "Invalid input amount" }, { status: 400 });
    }
    
    // Setup provider and wallet
    const provider = new ethers.JsonRpcProvider(BASE_RPC_URL);
    const wallet = new ethers.Wallet(privateKey, provider);
    
    if (wallet.address.toLowerCase() !== walletAddress.toLowerCase()) {
      return NextResponse.json({ error: "Wallet address mismatch" }, { status: 400 });
    }

    // Get token addresses - use specific addresses if provided
    const sellTokenAddress = getTokenAddress(inputToken, tokenAddress);
    const buyTokenAddress = getTokenAddress(outputToken, outputTokenAddress);

    // Check if it's a native ETH swap (use WETH for 0x)
    const isSellingETH = inputToken === "ETH";
    const actualSellToken = isSellingETH ? WETH_ADDRESS : sellTokenAddress;
    const actualBuyToken = outputToken === "ETH" ? WETH_ADDRESS : buyTokenAddress;

    // Get token decimals for both tokens
    const sellDecimals = await getTokenDecimals(provider, actualSellToken);
    const buyDecimals = await getTokenDecimals(provider, actualBuyToken);
    
    // Check balance
    const hasBalance = await checkBalance(
      provider,
      walletAddress,
      isSellingETH ? WETH_ADDRESS : actualSellToken,
      inputAmount,
      sellDecimals
    );

    // For ETH, check native balance
    if (isSellingETH) {
      const ethBalance = await provider.getBalance(walletAddress);
      const requiredWei = ethers.parseEther(inputAmount);
      if (ethBalance < requiredWei) {
        return NextResponse.json({ 
          success: false,
          error: `Insufficient ETH balance. Have: ${ethers.formatEther(ethBalance)}, Need: ${inputAmount}` 
        }, { status: 400 });
      }
    } else if (!hasBalance) {
      return NextResponse.json({ 
        success: false,
        error: `Insufficient ${inputToken} balance` 
      }, { status: 400 });
    }
    
    // Calculate sell amount in wei
    const sellAmountWei = ethers.parseUnits(inputAmount, sellDecimals).toString();
    const slippageBps = Math.round((slippage || 0.5) * 100);

    // Get 0x quote
    console.log("📊 Getting 0x quote...");
    const quote = await get0xQuote(
      actualSellToken,
      actualBuyToken,
      sellAmountWei,
      walletAddress,
      slippageBps
    );

    // Handle token approval if needed (not for ETH)
    if (!isSellingETH) {
      // Get the spender address from allowanceTarget or issues
      const spenderAddress = quote.allowanceTarget || quote.issues?.allowance?.spender;
      
      if (spenderAddress) {
        console.log("🔐 Checking token approval for:", spenderAddress);
        await checkAndApproveToken(
          wallet,
          actualSellToken,
          spenderAddress,
          BigInt(sellAmountWei)
        );
      }
    }
    
    // Execute the swap transaction
    console.log("🚀 Executing swap via 0x...");
    
    const txParams: ethers.TransactionRequest = {
      to: quote.transaction.to,
      data: quote.transaction.data,
      gasLimit: BigInt(quote.transaction.gas) * 120n / 100n, // 20% buffer
    };

    // For ETH swaps, include value
    if (isSellingETH) {
      txParams.value = BigInt(quote.transaction.value || sellAmountWei);
    }

    const tx = await wallet.sendTransaction(txParams);
    console.log("⏳ Transaction sent:", tx.hash);

    const receipt = await tx.wait();
    if (!receipt || receipt.status === 0) {
      throw new Error("Transaction failed");
    }

    console.log("✅ Swap successful:", {
      hash: tx.hash,
      gasUsed: receipt.gasUsed.toString()
    });
    
    // Calculate swap value for rewards
    const ethPrice = await getEthPrice();
    const isEthInput = inputToken === "ETH" || inputToken === "WETH";
    const ethAmount = isEthInput ? parseFloat(inputAmount) : parseFloat(outputAmount || ethers.formatUnits(quote.buyAmount, buyDecimals));
    const swapValueUsd = ethAmount * ethPrice;
    
    // Record swap and process fees
    const feeResult = await recordSwap(
      walletAddress,
      inputToken,
      outputToken,
      inputAmount,
      outputAmount || ethers.formatUnits(quote.buyAmount, buyDecimals),
      tx.hash,
      receipt.gasUsed.toString(),
      parseFloat(process.env.ZEROX_FEE_BPS || '0')
    );

    // Calculate cashback percentage
    const cashbackPercent = feeResult.cashback > 0 && swapValueUsd > 0 
      ? ((feeResult.cashback * ethPrice) / swapValueUsd * 100).toFixed(2)
      : '0';

    return NextResponse.json({
      success: true,
      transactionHash: tx.hash,
      amountOut: ethers.formatUnits(quote.buyAmount, buyDecimals),
      gasUsed: receipt.gasUsed.toString(),
      dexUsed: "0x",
      fees: {
        platformFee: feeResult.platformFee,
        cashback: feeResult.cashback,
        referralReward: feeResult.referralReward,
        treasuryFee: feeResult.treasuryFee,
        affiliateFee: feeResult.affiliateFee,
        message: feeResult.cashback > 0 
          ? `You earned ${feeResult.cashback.toFixed(6)} ETH cashback!` 
          : undefined
      },
      rewards: {
        cashbackAmount: feeResult.cashback,
        cashbackPercent,
        points: Math.floor(swapValueUsd * 0.1),
        treasuryFee: feeResult.treasuryFee,
        affiliateFee: feeResult.affiliateFee
      }
    });
    
  } catch (error) {
    console.error("❌ Swap error:", error);
    
    let errorMessage = "Swap failed";
    if (error instanceof Error) {
      const msg = error.message.toLowerCase();
      
      if (msg.includes("insufficient") || msg.includes("balance")) {
        errorMessage = "Insufficient balance for this swap";
      } else if (msg.includes("slippage") || msg.includes("output amount")) {
        errorMessage = "Price moved too much - try increasing slippage";
      } else if (msg.includes("liquidity")) {
        errorMessage = "Insufficient liquidity - try a smaller amount";
      } else if (msg.includes("user rejected") || msg.includes("cancelled")) {
        errorMessage = "Transaction cancelled";
      } else if (msg.includes("gas")) {
        errorMessage = "Gas estimation failed - try with a smaller amount";
      } else if (msg.includes("allowance") || msg.includes("approval")) {
        errorMessage = "Token approval failed - please try again";
      } else if (msg.includes("0x api") || msg.includes("quote")) {
        errorMessage = "Unable to get price quote - try a different token pair or amount";
      } else {
        errorMessage = error.message;
      }
    }
    
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
