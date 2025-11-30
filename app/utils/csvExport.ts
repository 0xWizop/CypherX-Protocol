/**
 * CSV Export Utilities
 * Functions to export transaction data to CSV format
 */

export interface TransactionCSVRow {
  date: string;
  time: string;
  type: string;
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  amountOut: string;
  valueUsd: string;
  gasCostUsd: string;
  txHash: string;
  status: string;
}

/**
 * Convert transactions to CSV format
 */
export function transactionsToCSV(transactions: any[]): string {
  if (transactions.length === 0) {
    return '';
  }

  // CSV Headers
  const headers = [
    'Date',
    'Time',
    'Type',
    'Token In',
    'Token Out',
    'Amount In',
    'Amount Out',
    'Value (USD)',
    'Gas Cost (USD)',
    'Transaction Hash',
    'Status'
  ];

  // Convert transactions to CSV rows
  const rows = transactions.map(tx => {
    const date = tx.timestamp 
      ? new Date(typeof tx.timestamp === 'number' ? tx.timestamp : tx.timestamp.toDate?.() || tx.timestamp)
      : new Date();
    
    const dateStr = date.toISOString().split('T')[0];
    const timeStr = date.toTimeString().split(' ')[0];
    
    const type = tx.type?.toUpperCase() || 'SWAP';
    const tokenIn = tx.tokenIn || tx.inputToken || 'ETH';
    const tokenOut = tx.tokenOut || tx.outputToken || '-';
    const amountIn = tx.amountIn || tx.inputAmount || '0';
    const amountOut = tx.amountOut || tx.outputAmount || '0';
    const valueUsd = tx.valueUsd || tx.inputValue || tx.outputValue || '0';
    const gasCostUsd = tx.gasCostUsd || tx.gasCost || '0';
    const txHash = tx.txHash || tx.hash || '-';
    const status = tx.status?.toUpperCase() || 'COMPLETED';

    return [
      dateStr,
      timeStr,
      type,
      tokenIn,
      tokenOut,
      amountIn,
      amountOut,
      parseFloat(valueUsd).toFixed(2),
      parseFloat(gasCostUsd).toFixed(2),
      txHash,
      status
    ];
  });

  // Combine headers and rows
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n');

  return csvContent;
}

/**
 * Download CSV file
 */
export function downloadCSV(csvContent: string, filename: string) {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
}


