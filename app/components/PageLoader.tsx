"use client";

import React from "react";
import LoadingSpinner from "./LoadingSpinner";

const PageLoader: React.FC = () => {
  return (
    <div className="fixed inset-0 bg-gray-950/80 backdrop-blur-sm flex items-center justify-center z-[9999]">
      <div className="flex flex-col items-center justify-center">
        <LoadingSpinner size="xl" text="Loading Token Radar" />
      </div>
    </div>
  );
};

export default PageLoader;
