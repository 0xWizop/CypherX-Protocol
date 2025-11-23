import path from "path";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    unoptimized: true,
    remotePatterns: [
      { protocol: "https", hostname: "i.imgur.com" },
      { protocol: "https", hostname: "images.typeform.com" },
      { protocol: "https", hostname: "landing.coingecko.com" },
      { protocol: "https", hostname: "upload.wikimedia.org" },
      { protocol: "https", hostname: "res.cloudinary.com" },
      { protocol: "https", hostname: "www.google.com" },
      { protocol: "https", hostname: "img.icons8.com" },
      { protocol: "https", hostname: "www.alchemy.com" },
      { protocol: "https", hostname: "lh7-us.googleusercontent.com" },
      { protocol: "https", hostname: "elitecity.io" },
      { protocol: "https", hostname: "images.mirror-media.xyz" },
      { protocol: "https", hostname: "www.datocms-assets.com" },
      { protocol: "https", hostname: "www.apple.com" },
      { protocol: "https", hostname: "assets.coingecko.com" },
      { protocol: "https", hostname: "www.coingecko.com" },
      { protocol: "https", hostname: "dd.dexscreener.com" },
      { protocol: "https", hostname: "images.seeklogo.com" },
      { protocol: "https", hostname: "firebasestorage.googleapis.com" },
      { protocol: "https", hostname: "cdn.dexscreener.com" },
      { protocol: "https", hostname: "scontent-iad4-1.choicecdn.com" },
      { protocol: "https", hostname: "dexscreener.com" },
      { protocol: "https", hostname: "tba-social.mypinata.cloud" },
    ],
  },
  experimental: {},
  allowedDevOrigins: ["192.168.86.250"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: `
              default-src 'self';
              script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.googleapis.com https://*.gstatic.com https://*.tradingview.com;
              connect-src 'self' https://*.googleapis.com https://*.dexscreener.com https://*.geckoterminal.com https://base-mainnet.g.alchemy.com wss://base-mainnet.g.alchemy.com https://api.coingecko.com http://localhost:3000 http://192.168.86.250:3000 https://*.tradingview.com https://*.walletconnect.com https://explorer-api.walletconnect.com https://pulse.walletconnect.org https://api.web3modal.org wss://*.walletconnect.com wss://relay.walletconnect.com https://*.reown.com;
              img-src 'self' data: https://i.imgur.com https://images.typeform.com https://landing.coingecko.com https://upload.wikimedia.org https://res.cloudinary.com https://www.google.com https://img.icons8.com https://www.alchemy.com https://lh7-us.googleusercontent.com https://elitecity.io https://images.mirror-media.xyz https://www.datocms-assets.com https://www.apple.com https://assets.coingecko.com https://www.coingecko.com https://dd.dexscreener.com https://images.seeklogo.com https://firebasestorage.googleapis.com https://cdn.dexscreener.com https://scontent-iad4-1.choicecdn.com https://dexscreener.com https://tba-social.mypinata.cloud https://*.tradingview.com https://*.coingecko.com https://*.dexscreener.com https://*.geckoterminal.com;
              style-src 'self' 'unsafe-inline' https://use.typekit.net https://fonts.googleapis.com https://*.tradingview.com;
              font-src 'self' data: https://fonts.gstatic.com https://*.tradingview.com;
              frame-src 'self' https://*.tradingview.com;
              child-src 'self' https://*.tradingview.com;
            `.replace(/\s+/g, " ").trim(),
          },
        ],
      },
    ];
  },
  webpack: (config: import("webpack").Configuration, { isServer }: { isServer: boolean }) => {
    if (process.env.NODE_ENV === 'development') {
      console.log("Webpack config running, isServer:", isServer);
    }

    // Add alias for `~` to resolve to `node_modules` (for @uniswap/widgets fonts)
    if (!config.resolve) config.resolve = {};
    if (!config.resolve.alias) config.resolve.alias = {};
    (config.resolve.alias as Record<string, string>)["~"] = "node_modules";

    // Alias '@zoralabs/coins-sdk' to a local stub to avoid breaking nested imports
    // from '@zoralabs/protocol-deployments' during bundling.
    (config.resolve.alias as Record<string, string>)["@zoralabs/coins-sdk"] =
      path.resolve(__dirname, "lib/zora-sdk-stub.ts");

    // Suppress console warnings for development
    if (!isServer) {
      config.ignoreWarnings = [
        // Suppress React DevTools warnings
        /Download the React DevTools/,
        // Suppress Lit dev mode warnings
        /Lit is in dev mode/,
        // Suppress other common development warnings
        /Warning: ReactDOM.render is deprecated/,
        /Warning: componentWillReceiveProps has been renamed/,
        /Warning: componentWillMount has been renamed/,
        /Warning: componentWillUpdate has been renamed/,
        // Suppress MetaMask SDK warnings (if not using it)
        /mm-sdk-analytics/,
        /Failed to send batch/,
        // Suppress WalletConnect warnings
        /WalletConnect Core is already initialized/,
        /Failed to fetch remote project configuration/,
        // Suppress React setState warnings
        /Cannot update a component.*while rendering/,
        // Suppress telemetry errors
        /Failed to execute inlined telemetry script/,
        /initCCA/,
      ];
    }

    if (!isServer && process.env.NODE_ENV === 'development') {
      console.log("Applying client-side Webpack fallback for Node.js modules");
      // Ensure config.resolve exists
      if (!config.resolve) {
        config.resolve = {};
      }
      // Safely spread config.resolve.fallback with a default empty object
      config.resolve.fallback = {
        ...(config.resolve.fallback ?? {}),
        net: false,
        tls: false,
        child_process: false,
        fs: false, // Added to handle the 'fs' module error
        path: false, // Added to handle potential 'path' module errors
        process: false, // Added to handle potential 'process' module errors
      };
    }

    return config;
  },
};

export default nextConfig;