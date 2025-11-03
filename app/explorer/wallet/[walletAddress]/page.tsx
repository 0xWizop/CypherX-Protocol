"use client";

import { useEffect } from "react";
import { useRouter, useParams } from "next/navigation";

export default function WalletAliasPage() {
  const router = useRouter();
  const params = useParams();
  const walletAddress = params.walletAddress as string;

  useEffect(() => {
    if (walletAddress) {
      router.replace(`/explorer/address/${walletAddress}`);
    } else {
      router.replace(`/explorer`);
    }
  }, [router, walletAddress]);

  return null;
}











