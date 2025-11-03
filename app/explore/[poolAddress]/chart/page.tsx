"use client";
import dynamic from "next/dynamic";
import React from "react";

// Use dynamic import to avoid static export analysis issues
const ChartV2 = dynamic(async () => {
  const mod: any = await import("../chart-v2/page");
  return mod.default ? mod.default : mod;
}, { ssr: false });

export default function ChartPageWrapper() {
  return <ChartV2 />;
}