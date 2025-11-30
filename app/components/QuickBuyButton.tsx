"use client";

import React, { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { SiEthereum } from 'react-icons/si';
import toast from 'react-hot-toast';

interface QuickBuyButtonProps {
  token: {
    address: string;
    symbol: string;
    name?: string;
    pairAddress?: string;
  };
  amount: number; // Amount in ETH
  walletAddress?: string;
  privateKey?: string;
  onSuccess?: (txHash: string) => void;
  className?: string;
  disabled?: boolean;
}

/**
 * Quick Buy Button Component
 * Executes a swap immediately using the swap API
 */
export default function QuickBuyButton({
  token,
  amount,
  walletAddress,
  privateKey,
  onSuccess,
  className = "",
  disabled = false,
}: QuickBuyButtonProps) {
  const router = useRouter();
  const [isExecuting, setIsExecuting] = useState(false);

  const handleQuickBuy = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!walletAddress || !privateKey) {
      // Navigate to wallet connection or swap page
      router.push(`/discover/${token.pairAddress || token.address}/chart-v2`);
      return;
    }

    if (disabled || isExecuting) return;

    setIsExecuting(true);
    let loadingToast: string | undefined;
    
    try {
      // Step 1: Get swap quote
      const quoteResponse = await fetch('/api/0x/price', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sellToken: 'ETH',
          buyToken: token.address,
          sellAmount: (amount * 1e18).toString(), // Convert to wei
          slippagePercentage: 1, // 1% slippage for quick buys
        }),
      });

      const quoteData = await quoteResponse.json();
      
      if (!quoteData.success || !quoteData.price) {
        throw new Error(quoteData.error || 'Failed to get quote');
      }

      const buyAmount = (parseFloat(quoteData.buyAmount || '0') / 1e18).toFixed(6);

      // Step 2: Prepare transaction
      loadingToast = toast.loading('Preparing swap...');
      
      const prepareResponse = await fetch('/api/swap/prepare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inputToken: 'ETH',
          outputToken: token.symbol,
          amountIn: amount.toString(),
          slippage: 1,
          walletAddress,
          tokenAddress: token.address,
        }),
      });

      const prepareData = await prepareResponse.json();
      
      if (!prepareData.success) {
        throw new Error(prepareData.message || 'Failed to prepare transaction');
      }

      // Step 3: Execute swap
      toast.loading('Executing swap...', { id: loadingToast });
      
      const executeResponse = await fetch('/api/swap/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inputToken: 'ETH',
          outputToken: token.symbol,
          inputAmount: amount.toString(),
          outputAmount: buyAmount,
          slippage: 1,
          walletAddress,
          privateKey,
          tokenAddress: token.address,
        }),
      });

      const executeData = await executeResponse.json();
      
      if (executeData.success && executeData.transactionHash) {
        toast.success(`Swap completed! TX: ${executeData.transactionHash.slice(0, 10)}...`, { id: loadingToast });
        onSuccess?.(executeData.transactionHash);
        
        // Refresh page data after a short delay
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } else {
        throw new Error(executeData.error || 'Swap execution failed');
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Swap failed';
      if (loadingToast) {
        toast.error(errorMessage, { id: loadingToast });
      } else {
        toast.error(errorMessage);
      }
      console.error('Quick buy error:', error);
    } finally {
      setIsExecuting(false);
    }
  }, [token, amount, walletAddress, privateKey, onSuccess, router, disabled, isExecuting]);

  return (
    <button
      onClick={handleQuickBuy}
      disabled={disabled || isExecuting}
      className={`
        flex items-center gap-1 px-3 py-1.5 text-sm 
        bg-gray-700/20 border border-gray-600/30 rounded-full 
        hover:bg-gray-600/30 transition 
        text-gray-300 hover:text-gray-200
        disabled:opacity-50 disabled:cursor-not-allowed
        ${className}
      `}
    >
      <SiEthereum className="w-3 h-3 text-gray-400" />
      <span>{isExecuting ? '...' : amount}</span>
    </button>
  );
}

/**
 * Quick Buy Buttons Row Component
 * Renders multiple Quick Buy buttons for preset amounts
 */
interface QuickBuyButtonsProps {
  token: QuickBuyButtonProps['token'];
  amounts?: number[];
  walletAddress?: string;
  privateKey?: string;
  onSuccess?: (txHash: string) => void;
  className?: string;
  disabled?: boolean;
}

export function QuickBuyButtons({
  token,
  amounts,
  walletAddress,
  privateKey,
  onSuccess,
  className = "",
  disabled = false,
}: QuickBuyButtonsProps) {
  // Use provided amounts or default values
  const finalAmounts = amounts || [0.01, 0.025, 0.05, 0.1];

  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      {finalAmounts.map((amount) => (
        <QuickBuyButton
          key={amount}
          token={token}
          amount={amount}
          walletAddress={walletAddress}
          privateKey={privateKey}
          onSuccess={onSuccess}
          disabled={disabled}
        />
      ))}
    </div>
  );
}

