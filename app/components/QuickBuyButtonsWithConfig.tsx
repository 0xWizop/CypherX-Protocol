"use client";

import React from 'react';
import QuickBuyButton, { QuickBuyButtons as BaseQuickBuyButtons } from './QuickBuyButton';
import { useQuickBuyConfig } from '@/app/hooks/useQuickBuyConfig';

interface QuickBuyButtonsWithConfigProps {
  token: {
    address: string;
    symbol: string;
    name?: string;
    pairAddress?: string;
  };
  amounts?: number[];
  walletAddress?: string;
  privateKey?: string;
  onSuccess?: (txHash: string) => void;
  className?: string;
  disabled?: boolean;
}

/**
 * QuickBuyButtons component that automatically loads and uses saved user preferences
 */
export function QuickBuyButtonsWithConfig(props: QuickBuyButtonsWithConfigProps) {
  const { config } = useQuickBuyConfig();
  
  // Use saved config amounts if no custom amounts provided
  const finalAmounts = props.amounts || config.amounts || [0.01, 0.025, 0.05, 0.1];

  return (
    <BaseQuickBuyButtons
      {...props}
      amounts={finalAmounts}
    />
  );
}

export default QuickBuyButtonsWithConfig;



