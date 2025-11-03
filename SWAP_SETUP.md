# Swap Setup Guide

## 🔧 Quick Fix for Swap Issues

### 1. Set 0x API Key

Add to your `.env` file (or `.env.local`):

```env
ZEROX_API_KEY=your_0x_api_key_here
```

**Get your API key:**
- Sign up at [0x Dashboard](https://dashboard.0x.org/)
- Follow the [Getting Started guide](https://0x.org/docs/0x-swap-api/introduction)
- Copy your API key to `.env`

### 2. Test the Price Endpoint

The swap should now work! When you:
1. Enter an amount in the "You Pay" field
2. Wait 500ms (debounced)
3. The price will be fetched from `/api/0x/price`
4. The "You Receive" amount will be populated

### 3. Check Browser Console

You should see:
- ✅ `🔍 Fetching 0x price:` - when price is requested
- ✅ `✅ Price received:` - when price is successfully fetched
- ❌ `❌ Price fetch failed:` - if there's an error

## 🔍 Troubleshooting

### "Cannot get price" or empty receive amount

**Possible causes:**
1. **Missing API Key**
   - Check that `ZEROX_API_KEY` is set in `.env`
   - Restart your dev server after adding it

2. **Invalid Token Address**
   - Ensure the token address is valid and exists on Base
   - Check that `pair?.baseToken?.address` is set

3. **Insufficient Liquidity**
   - The 0x API returns `liquidityAvailable: false` if there's no liquidity
   - Try a different token pair

4. **Network Issues**
   - Check that you're on Base network (chainId: 8453)
   - Verify the token exists on Base

### "ZEROX_API_KEY not set" warning

This appears in server logs if the API key is missing. Add it to `.env`:
```env
ZEROX_API_KEY=your_key_here
```

### Price not updating

- The price fetch is debounced by 500ms to avoid too many requests
- If you type quickly, wait a moment for the fetch to complete
- Check browser console for errors

## 📚 0x API Documentation

- [0x Swap API Guide](https://0x.org/docs/0x-swap-api/guides/build-token-swap-dapp-nextjs)
- [0x Troubleshooting](https://0x.org/docs/0x-swap-api/guides/troubleshooting-swap-api)
- [0x API Reference](https://0x.org/docs/api)

## 🚀 Next Steps

After price fetching works:

1. **Add Quote Endpoint** - For firm quotes when user clicks "Review Trade"
2. **Token Approval** - Handle ERC20 token approvals for AllowanceHolder
3. **Transaction Execution** - Submit swap transactions
4. **Error Handling** - Better UX for error states

## 💡 Tips

- Use the **price endpoint** (`/api/0x/price`) for browsing/indicative prices
- Use the **quote endpoint** (`/api/0x/quote`) when user is ready to trade
- Always check `liquidityAvailable` before showing prices
- Handle token decimals properly (not all tokens use 18 decimals)






