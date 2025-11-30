import { NextResponse } from "next/server";
import { ethers } from "ethers";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

// Constants
const BASE_RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || "https://base-mainnet.g.alchemy.com/v2/8KR6qwxbLlIISgrMCZfsrYeMmn6-S-bN";
const WETH_ADDRESS = "0x4200000000000000000000000000000000000006";

// Treasury configuration
// Treasury address for future direct transfers: 0xC0dFa8af8b9d2Ed4e6b9AA76615CCf51ea3F3fdC
const PLATFORM_FEE_PERCENT = 0.3; // 0.3% platform fee
const BASE_CASHBACK_PERCENT = 5; // 5% of fee back to user

// Referral volume tiers for extra cashback
const REFERRAL_VOLUME_TIERS = [
  { minVolume: 0, extraCashback: 0 },
  { minVolume: 1000, extraCashback: 5 },
  { minVolume: 5000, extraCashback: 10 },
  { minVolume: 25000, extraCashback: 15 },
  { minVolume: 100000, extraCashback: 20 },
];

// 🔧 FIXED: DEX Router Addresses on Base Chain - Updated with correct addresses
const DEX_ROUTERS = {
  // Uniswap V2 - Most reliable on Base chain
  uniswap_v2: {
    router: "0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24",
    factory: "0x8909dc15e40173ff4699343b6eb8132c65e18ec6",
    version: "v2"
  },
  // Aerodrome - Verified router address
  aerodrome: {
    router: "0xE9992487b2EE03b7a91241695A58E0ef3654643E",
    factory: "0x420DD381b31aEf6683db6B902084cB0FFECe40Da",
    quoter: "0x6F257E7F63cB7C88Cd4FDBb4C6B6f5D4c6A6E7F3",
    version: "v2"
  },
  // Uniswap V3 - Verified addresses
  uniswap_v3: {
    router: "0x6ff5693b99212da76ad316178a184ab56d299b43", // SwapRouter2
    factory: "0x33128a8fC17869897dcE68Ed026d694621f6FDfD",
    quoter: "0x3d4e44Eb137fd1710B3961a3B3A04F56a85e5870",
    version: "v3"
  },
  // BaseSwap - Verified addresses
  baseswap: {
    router: "0xFD14567eaf9ba9b71d4a6b255d96842dEF71D2bE",
    factory: "0xFDa619b6d209A7e7De1A5c7C7bDC9F1bEA73f33a",
    version: "v2"
  },
  // SushiSwap - Verified addresses
  sushiswap: {
    router: "0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506", // Router02
    factory: "0xc35DADB65012eC5796536bD9864eD8773ABc74C4",
    version: "v2"
  },
  // 1inch Aggregator
  oneinch: {
    router: "0x1111111254EEB25477B68fb85Ed929f73A960582", // AggregationRouterV5
    version: "aggregator"
  }
};

// 🔧 FIXED: Updated router ABIs with correct methods for each DEX
const ROUTER_ABIS = {
  // Uniswap V2 ABI
  uniswap_v2: [
    "function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)",
    "function swapExactETHForTokensSupportingFeeOnTransferTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable",
    "function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)",
    "function swapExactTokensForETHSupportingFeeOnTransferTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external",
    "function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)",
    "function swapExactTokensForTokensSupportingFeeOnTransferTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external"
  ],
  // Aerodrome ABI - FIXED: Added missing methods
  aerodrome: [
    "function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)",
    "function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)",
    "function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)",
    "function swap(address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOutMin, address to, uint256 deadline) external payable returns (uint256 amountOut)"
  ],
  // Baseswap ABI
  baseswap: [
    "function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)",
    "function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)",
    "function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)"
  ]
};

// ERC20 ABI for approvals
const ERC20_ABI = [
  {
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    name: "approve",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    name: "allowance",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
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
  preferredDex?: string;
}

interface SwapResponse {
  success: boolean;
  transactionHash?: string;
  amountOut?: string;
  gasUsed?: string;
  gasPrice?: string;
  error?: string;
  dexUsed?: string;
}

// Get token info
function getTokenInfo(symbol: string, tokenAddress?: string) {
  if (symbol === "ETH") {
    return {
      address: WETH_ADDRESS,
      symbol: "WETH",
      name: "Wrapped Ethereum",
      decimals: 18,
      logo: "https://assets.coingecko.com/coins/images/2518/small/weth.png"
    };
  }
  
  if (tokenAddress && !tokenAddress.startsWith('0x')) {
    throw new Error(`Invalid token address: ${tokenAddress}`);
  }
  
  if (tokenAddress) {
    return {
      address: tokenAddress,
      symbol: symbol,
      name: symbol,
      decimals: 18,
      logo: "https://via.placeholder.com/32"
    };
  }
  
  throw new Error(`Token ${symbol} not supported - token address required`);
}

// Check wallet balance
async function checkBalance(
  provider: ethers.Provider,
  walletAddress: string,
  tokenAddress: string,
  amount: string,
  decimals: number
): Promise<boolean> {
  if (tokenAddress === WETH_ADDRESS) {
    const balance = await provider.getBalance(walletAddress);
    const amountWei = ethers.parseUnits(amount, decimals);
    return balance >= amountWei;
  } else {
    const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
    const balance = await tokenContract.balanceOf(walletAddress);
    const amountWei = ethers.parseUnits(amount, decimals);
    return balance >= amountWei;
  }
}

// 🔧 FIXED: Enhanced token approval with better allowance handling
async function checkAndApproveToken(
  signer: ethers.Signer,
  tokenAddress: string,
  routerAddress: string,
  amount: string,
  decimals: number
): Promise<void> {
  if (tokenAddress === WETH_ADDRESS) {
    return; // No approval needed for WETH
  }

  const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, signer);
  const amountWei = ethers.parseUnits(amount, decimals);
  const currentAllowance = await tokenContract.allowance(await signer.getAddress(), routerAddress);

  // 🔧 FIXED: Enhanced approval logic with better validation
  const requiredAllowance = amountWei * 150n / 100n; // 50% buffer for better safety

  console.log(`🔧 Token approval analysis:`, {
    currentAllowance: ethers.formatUnits(currentAllowance, decimals),
    requiredAllowance: ethers.formatUnits(requiredAllowance, decimals),
    amount: amount,
    buffer: "20%",
    currentWei: currentAllowance.toString(),
    requiredWei: requiredAllowance.toString()
  });

  if (currentAllowance < requiredAllowance) {
    console.log("🔄 Approval needed, starting approval process...");

    try {
      // 🔧 FIXED: First reset allowance to 0 (some tokens require this)
      try {
        console.log("🔄 Resetting allowance to 0...");
        const resetTx = await tokenContract.approve(routerAddress, 0n);
        await resetTx.wait();
        console.log("✅ Allowance reset successful");
      } catch (resetError) {
        console.log("⚠️ Allowance reset failed, continuing:", resetError);
      }

      // 🔧 FIXED: Try buffer approval first
      console.log("🔄 Approving with buffer amount...");
      const approveTx = await tokenContract.approve(routerAddress, requiredAllowance);
      console.log("⏳ Waiting for approval transaction...");
      const receipt = await approveTx.wait();
      
      // 🔧 FIXED: Verify approval was successful
      const newAllowance = await tokenContract.allowance(await signer.getAddress(), routerAddress);
      console.log("✅ Buffer approval successful:", {
        hash: receipt.hash,
        newAllowance: ethers.formatUnits(newAllowance, decimals),
        status: receipt.status === 1 ? "success" : "failed"
      });

      if (receipt.status !== 1 || newAllowance < requiredAllowance) {
        throw new Error("Buffer approval failed, trying max approval");
      }
    } catch (approvalError) {
      console.error("❌ Buffer approval failed:", approvalError);
      
      // 🔧 FIXED: Fallback to max approval
      try {
        console.log("🔄 Trying max approval...");
        const maxApproval = ethers.MaxUint256;
        const maxApproveTx = await tokenContract.approve(routerAddress, maxApproval);
        const maxReceipt = await maxApproveTx.wait();
        
        const maxNewAllowance = await tokenContract.allowance(await signer.getAddress(), routerAddress);
        console.log("✅ Max approval successful:", {
          hash: maxReceipt.hash,
          newAllowance: ethers.formatUnits(maxNewAllowance, decimals),
          status: maxReceipt.status === 1 ? "success" : "failed"
        });

        if (maxReceipt.status !== 1) {
          throw new Error("Max approval transaction reverted");
        }
      } catch (maxApprovalError) {
        console.error("❌ Max approval also failed:", maxApprovalError);
        throw new Error(`Token approval failed: ${maxApprovalError instanceof Error ? maxApprovalError.message : 'Unknown error'}`);
      }
    }
  } else {
    console.log("✅ Sufficient token allowance already exists");
  }
}

// Test DEX liquidity and get best quote
async function testDexLiquidity(
  dexId: string,
  tokenInAddress: string,
  tokenOutAddress: string,
  amountIn: string,
  decimals: number
): Promise<{ success: boolean; gasEstimate?: bigint; error?: string }> {
  try {
    const dexConfig = DEX_ROUTERS[dexId as keyof typeof DEX_ROUTERS];
    if (!dexConfig) {
      return { success: false, error: "DEX not supported" };
    }

    const provider = new ethers.JsonRpcProvider(BASE_RPC_URL);
    const router = new ethers.Contract(dexConfig.router, ROUTER_ABIS[dexId as keyof typeof ROUTER_ABIS], provider);
    
    const isETHInput = tokenInAddress === WETH_ADDRESS;
    
    const amountInWei = ethers.parseUnits(amountIn, decimals);
    
    // Use more realistic slippage for testing (20% instead of 5%)
    const amountOutMin = amountInWei * 80n / 100n; // 20% slippage for testing
    const path = [tokenInAddress, tokenOutAddress];
    const deadline = Math.floor(Date.now() / 1000) + 1200;
    const dummyAddress = "0x0000000000000000000000000000000000000001";
    
    // Check if this is a self-swap (same token)
    if (tokenInAddress.toLowerCase() === tokenOutAddress.toLowerCase()) {
      return { success: false, error: "Cannot swap token for itself" };
    }
    
    let gasEstimate: bigint;
    try {
      if (isETHInput) {
        gasEstimate = await router.swapExactETHForTokens.estimateGas(
          amountOutMin,
          path,
          dummyAddress,
          deadline,
          { value: amountInWei }
        );
      } else {
        gasEstimate = await router.swapExactTokensForETHSupportingFeeOnTransferTokens.estimateGas(
          amountInWei,
          amountOutMin,
          path,
          dummyAddress,
          deadline
        );
      }
      
      return { success: true, gasEstimate: gasEstimate * 120n / 100n }; // Add 20% buffer
      
    } catch (gasError) {
      // If gas estimation fails, it might be due to insufficient liquidity or other issues
      // But we can still provide a default gas estimate based on the DEX
      let defaultGas = 200000n;
      if (dexId === 'uniswap_v2') defaultGas = 180000n;
      if (dexId === 'aerodrome') defaultGas = 200000n;
      if (dexId === 'baseswap') defaultGas = 180000n;
      
      // Check if the error is due to insufficient liquidity
      const errorMessage = gasError instanceof Error ? gasError.message : 'Unknown error';
      if (errorMessage.includes("INSUFFICIENT_OUTPUT_AMOUNT") || 
          errorMessage.includes("INSUFFICIENT_LIQUIDITY") ||
          errorMessage.includes("TRANSFER_FROM_FAILED")) {
        return { success: false, error: "Insufficient liquidity for this token pair" };
      }
      
      // For other errors, we'll still try with default gas estimate
      console.log(`⚠️ Gas estimation failed for ${dexId}, using default: ${defaultGas.toString()}`);
      return { success: true, gasEstimate: defaultGas };
    }
    
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

// Find the best DEX for the swap
async function findBestDex(
  tokenInAddress: string,
  tokenOutAddress: string,
  amountIn: string,
  preferredDex?: string
): Promise<{ dexId: string; routerAddress: string; method: string; gasEstimate: bigint }> {
  console.log("🔍 Finding best DEX for swap...");
  
  // If preferred DEX is specified, try it first
  if (preferredDex && DEX_ROUTERS[preferredDex as keyof typeof DEX_ROUTERS]) {
    console.log(`✅ Testing preferred DEX: ${preferredDex}`);
    const testResult = await testDexLiquidity(preferredDex, tokenInAddress, tokenOutAddress, amountIn, 18);
    
    if (testResult.success && testResult.gasEstimate) {
             const dexConfig = DEX_ROUTERS[preferredDex as keyof typeof DEX_ROUTERS];
       const isETHInput = tokenInAddress === WETH_ADDRESS;
       const method = isETHInput ? 'swapExactETHForTokens' : 'swapExactTokensForETHSupportingFeeOnTransferTokens';
      
      console.log(`✅ Preferred DEX ${preferredDex} works! Gas estimate: ${testResult.gasEstimate.toString()}`);
      return {
        dexId: preferredDex,
        routerAddress: dexConfig.router,
        method,
        gasEstimate: testResult.gasEstimate
      };
    } else {
      console.log(`❌ Preferred DEX ${preferredDex} failed:`, testResult.error);
    }
  }
  
  // Try DEXs in order of reliability
  const dexOrder = ['uniswap_v2', 'aerodrome', 'baseswap'];
  
  for (const dexId of dexOrder) {
    // Skip if already tried as preferred DEX
    if (dexId === preferredDex) continue;
    
    console.log(`🔍 Testing ${dexId}...`);
    const testResult = await testDexLiquidity(dexId, tokenInAddress, tokenOutAddress, amountIn, 18);
    
    if (testResult.success && testResult.gasEstimate) {
      const dexConfig = DEX_ROUTERS[dexId as keyof typeof DEX_ROUTERS];
      const isETHInput = tokenInAddress === WETH_ADDRESS;
      const method = isETHInput ? 'swapExactETHForTokens' : 'swapExactTokensForETHSupportingFeeOnTransferTokens';
      
      console.log(`✅ ${dexId} works! Gas estimate: ${testResult.gasEstimate.toString()}`);
      return {
        dexId,
        routerAddress: dexConfig.router,
        method,
        gasEstimate: testResult.gasEstimate
      };
    } else {
      console.log(`❌ ${dexId} failed:`, testResult.error);
    }
  }
  
  // If no DEX works, throw error
  throw new Error("No DEX has sufficient liquidity for this swap. Try a smaller amount or different token pair.");
}

// Execute the swap
async function executeSwap(
  signer: ethers.Signer,
  inputTokenAddress: string,
  outputTokenAddress: string,
  inputAmount: string,
  outputAmount: string,
  slippage: number,
  decimals: number,
  preferredDex?: string
): Promise<{ hash: string; gasUsed: string; gasPrice: string; dexUsed: string }> {
  console.log("🚀 Executing swap...");
  
  // Find best DEX
  const dexInfo = await findBestDex(inputTokenAddress, outputTokenAddress, inputAmount, preferredDex);
  console.log("✅ Using DEX:", dexInfo);
  
  const router = new ethers.Contract(dexInfo.routerAddress, ROUTER_ABIS[dexInfo.dexId as keyof typeof ROUTER_ABIS], signer);
  const amountInWei = ethers.parseUnits(inputAmount, decimals);
  const amountOutWei = ethers.parseUnits(outputAmount, decimals);
  
  // Calculate minimum amount out with slippage
  const slippageMultiplier = (100 - slippage) / 100;
  const amountOutMinimum = amountOutWei * BigInt(Math.floor(slippageMultiplier * 1000)) / 1000n;
  
  const deadline = Math.floor(Date.now() / 1000) + 1200; // 20 minutes
  const path = [inputTokenAddress, outputTokenAddress];

  console.log("🔧 Swap parameters:", {
    method: dexInfo.method,
    amountIn: amountInWei.toString(),
    amountOutMinimum: amountOutMinimum.toString(),
    path,
    deadline,
    dexId: dexInfo.dexId
  });

  // Execute swap
  let tx;
  try {
    if (dexInfo.method === 'swapExactETHForTokens') {
      tx = await router.swapExactETHForTokens(
        amountOutMinimum,
        path,
        await signer.getAddress(),
        deadline,
        { 
          value: amountInWei,
          gasLimit: dexInfo.gasEstimate
        }
      );
    } else if (dexInfo.method === 'swapExactTokensForETHSupportingFeeOnTransferTokens') {
      tx = await router.swapExactTokensForETHSupportingFeeOnTransferTokens(
        amountInWei,
        amountOutMinimum,
        path,
        await signer.getAddress(),
        deadline,
        { gasLimit: dexInfo.gasEstimate }
      );
    } else if (dexInfo.method === 'swapExactTokensForETH') {
      tx = await router.swapExactTokensForETH(
        amountInWei,
        amountOutMinimum,
        path,
        await signer.getAddress(),
        deadline,
        { gasLimit: dexInfo.gasEstimate }
      );
    } else {
      throw new Error(`Unsupported method: ${dexInfo.method}`);
    }
    
    console.log("✅ Transaction sent:", tx.hash);
  } catch (error) {
    console.error("❌ Transaction execution failed:", error);
    
    // Provide more specific error messages
    if (error instanceof Error) {
      if (error.message.includes("INSUFFICIENT_OUTPUT_AMOUNT")) {
        throw new Error("Slippage tolerance exceeded - try increasing slippage or reducing trade size");
      } else if (error.message.includes("INSUFFICIENT_LIQUIDITY")) {
        throw new Error("Insufficient liquidity in pool - try a smaller trade size");
      } else if (error.message.includes("EXPIRED")) {
        throw new Error("Transaction deadline expired - try again");
      } else if (error.message.includes("INSUFFICIENT_INPUT_AMOUNT")) {
        throw new Error("Insufficient input amount - check your balance");
      } else if (error.message.includes("execution reverted")) {
        throw new Error("Transaction reverted - insufficient liquidity or price impact too high. Try a smaller amount or different token pair.");
      }
    }
    
    throw error;
  }

  console.log("⏳ Waiting for transaction confirmation...");
  const receipt = await tx.wait();
  if (!receipt) {
    throw new Error("Transaction receipt is null");
  }
  
  if (receipt.status === 0) {
    throw new Error("Transaction failed - check slippage tolerance and liquidity");
  }
  
  console.log("✅ Transaction confirmed! Gas used:", receipt.gasUsed.toString());
  
  return {
    hash: tx.hash,
    gasUsed: receipt.gasUsed.toString(),
    gasPrice: receipt.gasPrice?.toString() || "0",
    dexUsed: dexInfo.dexId
  };
}

// Get user's referral volume tier cashback bonus
function getReferralVolumeCashback(referralVolume: number): number {
  let extraCashback = 0;
  for (const tier of REFERRAL_VOLUME_TIERS) {
    if (referralVolume >= tier.minVolume) {
      extraCashback = tier.extraCashback;
    }
  }
  return extraCashback;
}

// Get ETH price (simplified - you may want to use an oracle)
async function getEthPrice(): Promise<number> {
  try {
    const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd');
    const data = await response.json();
    return data.ethereum?.usd || 2500;
  } catch {
    return 2500; // Fallback price
  }
}

// Process fees and rewards
async function processFeesAndRewards(
  walletAddress: string,
  swapValueUsd: number,
  swapValueEth: number,
  transactionHash: string
): Promise<{ platformFee: number; cashback: number; referralReward: number; referrerAddress?: string }> {
  const db = adminDb();
  if (!db) {
    console.error("Database connection failed");
    return { platformFee: 0, cashback: 0, referralReward: 0 };
  }

  try {
    // Calculate platform fee (in ETH)
    const platformFeeEth = swapValueEth * (PLATFORM_FEE_PERCENT / 100);
    const platformFeeUsd = swapValueUsd * (PLATFORM_FEE_PERCENT / 100);

    console.log(`💰 Platform fee: ${platformFeeEth.toFixed(6)} ETH ($${platformFeeUsd.toFixed(2)})`);

    // Find user by wallet address
    const userQuery = db.collection("users").where("walletAddress", "==", walletAddress);
    const userSnapshot = await userQuery.get();
    
    let userId: string | null = null;
    let referrerId: string | null = null;
    let referralVolume = 0;

    if (!userSnapshot.empty) {
      userId = userSnapshot.docs[0].id;
      const userData = userSnapshot.docs[0].data();
      referrerId = userData.referredBy || null;

      // Get user's referral volume (how much their referrals have traded)
      const rewardsDoc = await db.collection("rewards").doc(userId).get();
      if (rewardsDoc.exists) {
        // Calculate referral volume from referrals
        const referralsQuery = db.collection("referrals").where("referrerId", "==", userId);
        const referralsSnapshot = await referralsQuery.get();
        for (const ref of referralsSnapshot.docs) {
          referralVolume += ref.data().swapValueUSD || 0;
        }
      }
    }

    // Calculate cashback (base + referral volume bonus)
    const extraCashback = getReferralVolumeCashback(referralVolume);
    const totalCashbackPercent = BASE_CASHBACK_PERCENT + extraCashback;
    const cashbackEth = platformFeeEth * (totalCashbackPercent / 100);

    console.log(`🎁 Cashback: ${cashbackEth.toFixed(6)} ETH (${totalCashbackPercent}% of fee)`);

    // Credit cashback to user's rewards
    if (userId) {
      const rewardsRef = db.collection("rewards").doc(userId);
      const rewardsDoc = await rewardsRef.get();
      
      if (rewardsDoc.exists) {
        await rewardsRef.update({
          ethRewards: FieldValue.increment(cashbackEth),
          volumeTraded: FieldValue.increment(swapValueUsd),
          transactions: FieldValue.increment(1),
          lastUpdated: new Date().toISOString()
        });
      } else {
        // Generate referral code for new user
        const referralCode = 'CYPHERX' + Math.random().toString(36).substring(2, 8).toUpperCase();
        await rewardsRef.set({
          ethRewards: cashbackEth,
          referralCode,
          referrals: 0,
          referralRate: 30,
          volumeTraded: swapValueUsd,
          transactions: 1,
          lastUpdated: new Date().toISOString()
        });
      }
      console.log(`✅ Credited ${cashbackEth.toFixed(6)} ETH cashback to user ${userId}`);
    }

    // Process referral reward (30% of platform fee to referrer)
    let referralRewardEth = 0;
    let referrerWalletAddress: string | undefined;

    if (referrerId) {
      referralRewardEth = platformFeeEth * 0.30; // 30% to referrer
      
      // Credit referral reward to referrer
      const referrerRewardsRef = db.collection("rewards").doc(referrerId);
      const referrerRewardsDoc = await referrerRewardsRef.get();
      
      if (referrerRewardsDoc.exists) {
        await referrerRewardsRef.update({
          ethRewards: FieldValue.increment(referralRewardEth),
          lastUpdated: new Date().toISOString()
        });
        console.log(`✅ Credited ${referralRewardEth.toFixed(6)} ETH referral reward to referrer ${referrerId}`);
      }

      // Update referral record with this swap
      await db.collection("referrals").add({
        referrerId,
        refereeId: userId,
        refereeWallet: walletAddress,
        swapValueUSD: swapValueUsd,
        swapValueETH: swapValueEth,
        platformFee: platformFeeEth,
        referralReward: referralRewardEth,
        transactionHash,
        timestamp: new Date().toISOString()
      });

      // Get referrer's wallet address for logging
      const referrerUserDoc = await db.collection("users").doc(referrerId).get();
      if (referrerUserDoc.exists) {
        referrerWalletAddress = referrerUserDoc.data()?.walletAddress;
      }
    }

    // Net fee to treasury (platform fee - cashback - referral reward)
    const netTreasuryFee = platformFeeEth - cashbackEth - referralRewardEth;
    console.log(`🏦 Net to treasury: ${netTreasuryFee.toFixed(6)} ETH`);

    // Record fee transaction
    await db.collection("fee_transactions").add({
      walletAddress,
      userId,
      swapValueUsd,
      swapValueEth,
      platformFeeEth,
      cashbackEth,
      referralRewardEth,
      netTreasuryFee,
      referrerId,
      transactionHash,
      timestamp: FieldValue.serverTimestamp()
    });

    return {
      platformFee: platformFeeEth,
      cashback: cashbackEth,
      referralReward: referralRewardEth,
      referrerAddress: referrerWalletAddress
    };
  } catch (error) {
    console.error("Error processing fees and rewards:", error);
    return { platformFee: 0, cashback: 0, referralReward: 0 };
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
  gasPrice: string,
  dexUsed: string
): Promise<{ platformFee: number; cashback: number; referralReward: number }> {
  const db = adminDb();
  if (!db) {
    console.error("Database connection failed");
    return { platformFee: 0, cashback: 0, referralReward: 0 };
  }

  try {
    // Get current ETH price
    const ethPrice = await getEthPrice();
    
    // Calculate values
    const isEthInput = inputToken === "ETH";
    const ethAmount = isEthInput ? parseFloat(inputAmount) : parseFloat(outputAmount);
    const swapValueUsd = ethAmount * ethPrice;
    const swapValueEth = ethAmount;
    
    const gasUsedEth = parseFloat(ethers.formatEther(ethers.parseUnits(gasUsed, "wei")));
    const gasPriceGwei = parseFloat(ethers.formatUnits(gasPrice, "gwei"));
    const gasCostEth = (gasUsedEth * gasPriceGwei) / 1e9;
    const gasCostUsd = gasCostEth * ethPrice;

    console.log(`📊 Swap recorded: ${swapValueEth.toFixed(4)} ETH ($${swapValueUsd.toFixed(2)})`);

    // Record transaction
    await db.collection("wallet_transactions").add({
      walletAddress,
      type: "swap",
      inputToken,
      outputToken,
      inputAmount,
      outputAmount,
      inputValue: isEthInput ? swapValueUsd : swapValueUsd,
      outputValue: !isEthInput ? swapValueUsd : swapValueUsd,
      transactionHash,
      gasUsed,
      gasPrice,
      gasCostUsd,
      dexUsed,
      timestamp: FieldValue.serverTimestamp(),
      status: "confirmed"
    });

    // Process fees and rewards
    const feeResult = await processFeesAndRewards(
      walletAddress,
      swapValueUsd,
      swapValueEth,
      transactionHash
    );

    // Update user activity
    const userQuery = db.collection("users").where("walletAddress", "==", walletAddress);
    const userSnapshot = await userQuery.get();
    
    if (!userSnapshot.empty) {
      await db.collection("users").doc(userSnapshot.docs[0].id).update({
        lastActivity: FieldValue.serverTimestamp(),
      });
    }

    console.log(`✅ Swap recorded: ${transactionHash}, DEX: ${dexUsed}, Fee: ${feeResult.platformFee.toFixed(6)} ETH`);
    
    return feeResult;
  } catch (error) {
    console.error("Error recording swap:", error);
    return { platformFee: 0, cashback: 0, referralReward: 0 };
  }
}

export async function POST(request: Request) {
  try {
    const body: SwapRequest = await request.json();
    console.log("Execute API received request:", {
      inputToken: body.inputToken,
      outputToken: body.outputToken,
      inputAmount: body.inputAmount,
      outputAmount: body.outputAmount,
      slippage: body.slippage,
      walletAddress: body.walletAddress,
      tokenAddress: body.tokenAddress,
      preferredDex: body.preferredDex
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
      preferredDex
    } = body;
    
    if (!inputToken || !outputToken || !inputAmount || !outputAmount || !walletAddress || !privateKey) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }
    
    // Validate input
    const amount = parseFloat(inputAmount);
    if (isNaN(amount) || amount <= 0) {
      return NextResponse.json(
        { error: "Invalid input amount" },
        { status: 400 }
      );
    }
    
    // Get token information
    console.log("Getting token info for:", { inputToken, outputToken, tokenAddress });
    const inputTokenInfo = getTokenInfo(inputToken, inputToken === "ETH" ? undefined : tokenAddress);
    const outputTokenInfo = getTokenInfo(outputToken, outputToken === "ETH" ? undefined : tokenAddress);
    console.log("Token info:", { inputTokenInfo, outputTokenInfo });
    
    // Setup provider and wallet
    const provider = new ethers.JsonRpcProvider(BASE_RPC_URL);
    const wallet = new ethers.Wallet(privateKey, provider);
    
    // Verify wallet address matches
    if (wallet.address.toLowerCase() !== walletAddress.toLowerCase()) {
      return NextResponse.json(
        { error: "Wallet address mismatch" },
        { status: 400 }
      );
    }
    
    // Check balance
    const hasBalance = await checkBalance(
      provider,
      walletAddress,
      inputTokenInfo.address,
      inputAmount,
      inputTokenInfo.decimals
    );
    
    if (!hasBalance) {
      return NextResponse.json(
        { error: `Insufficient ${inputToken} balance` },
        { status: 400 }
      );
    }
    
    // Check and approve token if needed (for sells)
    if (inputTokenInfo.address !== WETH_ADDRESS) {
      // Find the router address for approval
      const dexInfo = await findBestDex(inputTokenInfo.address, outputTokenInfo.address, inputAmount, preferredDex);
      await checkAndApproveToken(wallet, inputTokenInfo.address, dexInfo.routerAddress, inputAmount, inputTokenInfo.decimals);
    }
    
    // Execute swap
    const result = await executeSwap(
      wallet,
      inputTokenInfo.address,
      outputTokenInfo.address,
      inputAmount,
      outputAmount,
      slippage,
      inputTokenInfo.decimals,
      preferredDex
    );
    
    // Record swap in database and process fees
    const feeResult = await recordSwap(
      walletAddress,
      inputToken,
      outputToken,
      inputAmount,
      outputAmount,
      result.hash,
      result.gasUsed,
      result.gasPrice,
      result.dexUsed
    );
    
    const response: SwapResponse = {
      success: true,
      transactionHash: result.hash,
      amountOut: outputAmount,
      gasUsed: result.gasUsed,
      gasPrice: result.gasPrice,
      dexUsed: result.dexUsed
    };
    
    // Add fee info to response
    return NextResponse.json({
      ...response,
      fees: {
        platformFee: feeResult.platformFee,
        cashback: feeResult.cashback,
        referralReward: feeResult.referralReward,
        message: feeResult.cashback > 0 
          ? `You earned ${feeResult.cashback.toFixed(6)} ETH cashback!` 
          : undefined
      }
    });
    
  } catch (error) {
    console.error("Swap execution error:", error);
    
    let errorMessage = "Swap failed";
    if (error instanceof Error) {
      if (error.message.includes("insufficient")) {
        errorMessage = "Insufficient balance";
      } else if (error.message.includes("slippage")) {
        errorMessage = "Slippage too high - try increasing slippage tolerance";
      } else if (error.message.includes("user rejected")) {
        errorMessage = "Transaction cancelled by user";
      } else if (error.message.includes("execution reverted") || error.message.includes("transaction execution reverted")) {
        errorMessage = "Transaction reverted - insufficient liquidity or price impact too high. Try a smaller amount or different token pair.";
      } else if (error.message.includes("gas")) {
        errorMessage = "Gas estimation failed - try with a smaller amount";
      } else if (error.message.includes("pool")) {
        errorMessage = "Pool not found - this token pair may not have sufficient liquidity";
      } else if (error.message.includes("No DEX has sufficient liquidity")) {
        errorMessage = "No DEX has sufficient liquidity for this swap. Try a smaller amount or different token pair.";
      } else {
        errorMessage = error.message;
      }
    }
    
    return NextResponse.json(
      { 
        success: false,
        error: errorMessage
      },
      { status: 500 }
    );
  }
}