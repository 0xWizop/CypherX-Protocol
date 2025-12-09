"use client";

import React, { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

export default function TransactionPage() {
  const params = useParams();
  const txHash = params?.txHash as string;
  const router = useRouter();

  useEffect(() => {
    // Redirect to explorer tx route
    if (txHash) {
      router.replace(`/explorer/tx/${txHash}`);
    }
  }, [txHash, router]);

  // Show loading state while redirecting
  return (
    <div className="min-h-screen bg-gray-950 text-gray-200 flex items-center justify-center">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        <p className="mt-4 text-gray-400">Redirecting...</p>
      </div>
    </div>
  );
}





































