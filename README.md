# PayFlow — USDC Payment Requests on Arc Testnet

Create shareable USDC payment links on Arc Testnet. Anyone with the link can pay directly from MetaMask; the app polls on-chain and auto-updates to "Paid" on confirmation.

## Stack

- **Next.js 14** (App Router)
- **Arc Testnet** — Chain ID 5042002, RPC `https://rpc.testnet.arc.network`
- **USDC** at `0x3600000000000000000000000000000000000000` (native system contract, 6 decimals via ERC-20 interface)
- No backend — localStorage + direct JSON-RPC calls

## Deploy to Vercel (2 minutes)

### Option A — Vercel CLI
```bash
npm i -g vercel
vercel --prod
```

### Option B — Vercel Dashboard
1. Push this folder to a GitHub repo
2. Go to [vercel.com/new](https://vercel.com/new)
3. Import the repo → click **Deploy**
4. Done — live URL in ~60 seconds

## Local development
```bash
npm install
npm run dev
# open http://localhost:3000
```

## Usage

1. Connect MetaMask (app auto-adds Arc Testnet)
2. Create a request: enter amount, description, recipient address
3. Copy the generated link and share it
4. Recipient opens the link → clicks Pay → MetaMask signs the ERC-20 transfer
5. Status auto-flips to **Paid** when the transaction confirms on-chain

## Get test USDC
Visit [faucet.circle.com](https://faucet.circle.com) → select Arc Testnet → receive 1 USDC/day.
