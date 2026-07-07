"use client";

import { useState } from "react";

interface StrategyStep { step: number; title: string; detail: string; }

interface Strategy {
  priority: number;
  name: string;
  tagline: string;
  category: string;
  categoryColor: string;
  description: string;
  industryNote: string;
  process: StrategyStep[];
  bestFor: string[];
  tips: string[];
  supported: boolean;
}

// Priority order based on industry adoption rate, historical revenue performance,
// and proven effectiveness across top NFT projects (BAYC, Azuki, Art Blocks,
// Nike/RTFKT, Adidas Originals, Nouns DAO, NBA Top Shot, VeeFriends).
const STRATEGIES: Strategy[] = [
  {
    priority: 1,
    name: "Public Mint (Fixed Price)",
    tagline: "Set a price. Open the sale. First come, first served.",
    category: "Pricing Model",
    categoryColor: "#3b82f6",
    industryNote: "Used by 99%+ of NFT projects worldwide. The universal baseline of every NFT launch — from CryptoPunks to Bored Apes. No project ships without this.",
    description:
      "Every NFT in the wave is priced equally at a fixed ETH/TWD amount. Any wallet can purchase during the sale window. The simplest, most battle-tested model in the NFT industry — and the one buyers understand best.",
    process: [
      { step: 1, title: "Configure Wave Pricing", detail: "Set the ETH price and TWD equivalent in the NFT Waves page. Optionally set a per-wallet mint limit (e.g. max 3) to prevent single wallets from taking all supply." },
      { step: 2, title: "Set Sale Window", detail: "Define exact open and close datetime. The contract only accepts mints within this window." },
      { step: 3, title: "Ensure NFT Records Are Ready", detail: "All NFT records for this wave must be generated, IPFS hashes stored, and status set to Available before the sale opens." },
      { step: 4, title: "Announce Publicly", detail: "Post on all channels at least 48 hours before. Include price, supply, per-wallet limit, and exact start time." },
      { step: 5, title: "Accept Orders", detail: "For offline walk-in buyers, staff creates orders manually in BearthAdmin. Online buyers use the public mint page. Both record NFT + payment details." },
      { step: 6, title: "Confirm Payments", detail: "Confirm ETH/TWD payment per order. System updates status to confirmed and triggers fulfillment." },
      { step: 7, title: "Deliver NFTs", detail: "Assign specific NFT serial numbers to each order. Transfer to customer wallets. Mark as Delivered." },
      { step: 8, title: "Close Wave", detail: "When sold out or window expires, close the wave. Announce sell-out — it drives secondary market momentum on OpenSea." },
    ],
    bestFor: ["All waves", "First-time buyers", "Maximum accessibility", "Predictable revenue"],
    tips: [
      "Always set a per-wallet cap — it prevents whales from buying everything and ensures wider community distribution.",
      "A clean sell-out announcement drives immediate OpenSea secondary activity — post it the moment you sell out.",
      "Pair with Blind Box reveal to add excitement even to a fixed-price sale.",
    ],
    supported: true,
  },
  {
    priority: 2,
    name: "Whitelist / Allowlist Presale",
    tagline: "Reward your early community with guaranteed access before public opens.",
    category: "Access Control",
    categoryColor: "#059669",
    industryNote: "Used by BAYC, Azuki, Moonbirds, Doodles, and 95%+ of major projects. The standard pre-launch mechanism. Whitelist spots became coveted assets in their own right during the 2021–2022 bull market.",
    description:
      "Pre-approved wallet addresses get early mint access — often at the same or lower price — before public sale opens. Uses a Merkle tree on-chain for gas-efficient verification. Creates exclusivity, rewards loyal early supporters, and builds social buzz before launch.",
    process: [
      { step: 1, title: "Collect Eligible Wallets", detail: "Gather wallets from community members, early supporters, social media contest winners, or event attendees. Maintain a clean list with no duplicates." },
      { step: 2, title: "Generate Merkle Tree", detail: "Feed the wallet list into the Merkle generator. This creates a compact cryptographic proof verifiable on-chain without storing every address in the contract." },
      { step: 3, title: "Upload Merkle Root to Contract", detail: "Technical team calls setMerkleRoot() on the smart contract. This sets the gatekeeper for the whitelist phase." },
      { step: 4, title: "Set Presale Window", detail: "Configure whitelist window (typically 24–48 hours before public). Optionally set a lower presale price as a reward for early commitment." },
      { step: 5, title: "Notify Whitelisted Wallets", detail: "Email or DM every whitelisted address with exact window dates, instructions, and wallet verification steps. No surprises." },
      { step: 6, title: "Whitelisted Buyers Mint", detail: "During the presale window, only Merkle-verified addresses can mint. Each buyer submits a Merkle proof with their transaction." },
      { step: 7, title: "Transition to Public", detail: "After the whitelist window, remaining NFTs automatically open for public mint at standard price." },
    ],
    bestFor: ["Genesis wave", "Early community rewards", "Anti-bot protection", "Launch hype building"],
    tips: [
      "Keep the whitelist window short (24–48 hours) — scarcity creates urgency for non-whitelisted buyers.",
      "Announce whitelist criteria clearly in advance. Opaque criteria cause community backlash.",
      "Whitelist spots that are tradeable (as NFTs themselves) create secondary markets and additional hype.",
    ],
    supported: true,
  },
  {
    priority: 3,
    name: "Blind Box + Reveal",
    tagline: "Mint blind. Reveal on a set date. The reveal becomes a cultural moment.",
    category: "Sales Format",
    categoryColor: "#d97706",
    industryNote: "BAYC's reveal was one of the biggest cultural moments in NFT history. Azuki, Doodles, Moonbirds — virtually every top project uses this. The reveal event extends the marketing lifecycle of the launch by weeks.",
    description:
      "All buyers mint identical placeholder images. The actual art and traits are hidden until a public reveal date. The reveal creates a coordinated community moment — everyone discovers their NFT at the same time, generating massive social engagement and post-reveal trading activity.",
    process: [
      { step: 1, title: "Prepare Hidden Metadata", detail: "Generate all NFT images and metadata in advance but store them hidden. Deploy a blind/placeholder image (e.g. sealed box art) as the initial tokenURI for all minted NFTs." },
      { step: 2, title: "Mint Blind NFTs", detail: "Sell the blind boxes at fixed or dutch price. All tokens show identical placeholder art. Buyers know their traits will be revealed on a specific date." },
      { step: 3, title: "Build Anticipation", detail: "Share teaser art, trait previews, and rarity breakdowns in the weeks before reveal. Community speculation and hype builds organic marketing." },
      { step: 4, title: "Upload Real Metadata to IPFS", detail: "Before reveal date, upload all real NFT images and metadata JSON files to Filebase/IPFS. Store all hashes in the DB." },
      { step: 5, title: "Execute Reveal", detail: "At the reveal date, technical team calls the contract to update the base URI to point to the real IPFS metadata. All tokens now show their actual art." },
      { step: 6, title: "Announce Reveal Publicly", detail: "Post reveal announcement simultaneously on all channels. Encourage holders to share their revealed NFTs. Compile a community reveal compilation." },
      { step: 7, title: "Monitor Post-Reveal Activity", detail: "Rare NFTs immediately start trading on OpenSea at premiums. Monitor floor price movements and community reactions." },
    ],
    bestFor: ["All waves", "Launch marketing", "Community engagement", "Post-reveal trading"],
    tips: [
      "The reveal countdown itself is marketing — run a 72-hour countdown social campaign.",
      "Ensure metadata is 100% final before reveal — a post-reveal metadata change destroys community trust permanently.",
      "Consider a live-streamed reveal event where the team reveals NFTs in real time for maximum engagement.",
    ],
    supported: true,
  },
  {
    priority: 4,
    name: "Dutch Auction",
    tagline: "Price starts high and drops. The market finds its own price.",
    category: "Auction",
    categoryColor: "#7c3aed",
    industryNote: "Art Blocks — the highest-grossing generative art NFT platform — uses Dutch Auction almost exclusively. Nouns DAO runs a daily Dutch Auction for every new Noun, generating consistent revenue for years. Transparent and provably fair.",
    description:
      "Price starts at a high point and automatically drops at set intervals until NFTs are sold or the floor price is reached. Buyers decide when the price is right for them. Eliminates the guesswork of fixed pricing and prevents under-pricing or over-pricing a new collection.",
    process: [
      { step: 1, title: "Set Starting Price", detail: "Set a high starting price (e.g. 0.5 ETH). This should be above where you expect most buyers to purchase — the auction will find the real market price." },
      { step: 2, title: "Set Floor Price", detail: "Define the minimum price the auction will ever reach (e.g. 0.1 ETH). The NFT will never sell below this, protecting project value." },
      { step: 3, title: "Set Drop Interval", detail: "Configure how often the price drops (e.g. -0.05 ETH every 10 minutes). Faster drops create more urgency; slower drops allow more deliberation." },
      { step: 4, title: "Configure Smart Contract", detail: "Technical team implements the Dutch Auction price curve in the contract. The price decrements are calculated on-chain — fully transparent and trustless." },
      { step: 5, title: "Open the Auction", detail: "Launch at the announced time. Price begins dropping automatically. Buyers monitor and purchase when the price hits their comfortable level." },
      { step: 6, title: "Monitor in Real Time", detail: "Track purchase rate. If selling very fast at starting price, the starting price was too low. If reaching floor with inventory remaining, lower future starting prices." },
      { step: 7, title: "Close and Record", detail: "When sold out or floor reached, close the auction. Create BearthAdmin orders for all auction purchases. The final clearing price is the price paid by the last buyer." },
    ],
    bestFor: ["Rare / Legendary tier NFTs", "Genesis wave", "Price discovery", "Transparent pricing"],
    tips: [
      "Art Blocks' success with Dutch Auction is entirely because it removes price uncertainty — both for the project and buyers.",
      "Always set a floor price — a Dutch Auction with no floor going to zero destroys the project's value.",
      "Announce the Dutch Auction mechanics clearly in advance so buyers understand how to participate.",
    ],
    supported: false,
  },
  {
    priority: 5,
    name: "Holder Priority Sale",
    tagline: "Your existing holders get first access to the next wave. Loyalty earns privileges.",
    category: "Loyalty",
    categoryColor: "#16a34a",
    industryNote: "Yuga Labs' BAYC → Mutant Ape Yacht Club holder-priority sale generated over $96M in 3 hours. The Otherside land sale to BAYC/MAYC holders generated $317M. The single most revenue-generating retention strategy in NFT history.",
    description:
      "Existing NFT holders from previous waves receive exclusive early access to mint the next wave — often at a loyalty discount — before the general public. Rewards commitment, reduces early-holder sell pressure, and creates a self-reinforcing reason to hold rather than sell.",
    process: [
      { step: 1, title: "Snapshot Current Holders", detail: "At a specific block height, capture all wallet addresses currently holding Bearth NFTs from previous waves. This list is the priority access group." },
      { step: 2, title: "Build Allowlist from Snapshot", detail: "Generate a Merkle tree from the snapshot wallets. Upload root to contract — only snapshot wallets can mint during the priority window." },
      { step: 3, title: "Set Priority Window and Price", detail: "Open a 24–48 hour exclusive window before the public sale. Optionally set a loyalty price (e.g. 10% below public) as a genuine reward for holding." },
      { step: 4, title: "Announce Snapshot Date in Advance", detail: "Tell your community the snapshot date before it happens. Holders who know a snapshot is coming are less likely to sell — this alone reduces sell pressure." },
      { step: 5, title: "Notify All Snapshot Holders", detail: "Communicate with all eligible wallets. Include the priority window, price, and mint instructions. Emphasise this is exclusive to holders." },
      { step: 6, title: "Priority Window Opens", detail: "Snapshot holders mint during their exclusive window. Public cannot participate yet. Monitor uptake rate in real time." },
      { step: 7, title: "Open to Public", detail: "After the priority window closes, remaining supply opens to public at standard price. Announce the transition." },
    ],
    bestFor: ["All waves after Wave 1", "Rewarding early buyers", "Reducing sell pressure", "Building multi-wave collection"],
    tips: [
      "Announce snapshot dates — this alone reduces sell pressure significantly as holders don't want to miss the snapshot.",
      "The Yuga Labs model worked because MAYC had genuine value. The new wave must be worth holding for.",
      "Consider airdropping bonus NFTs to holders of all previous waves as a surprise reward — unexpected value creates loyalty.",
    ],
    supported: false,
  },
  {
    priority: 6,
    name: "Physical + NFT Bundle (Phygital)",
    tagline: "Digital NFT meets physical product. The NFT authenticates the physical item.",
    category: "Sales Format",
    categoryColor: "#d97706",
    industryNote: "Nike/RTFKT generated $185M+ bundling physical sneakers with NFTs. Adidas Originals 'Into the Metaverse' ($22M in 24h) included physical merchandise with NFTs. The phygital model is now considered a benchmark for brand NFT launches.",
    description:
      "The NFT and a physical Bearth product are sold together as a package at a price lower than buying separately. The NFT acts as a digital certificate of authenticity for the physical item, and the physical product gives the NFT lasting real-world value beyond speculation.",
    process: [
      { step: 1, title: "Define Bundle Package", detail: "Pair a specific NFT wave with a specific physical product (e.g. Wave 1 NFT + Limited Hoodie). The pairing should feel coherent — the product should visually or thematically match the NFT." },
      { step: 2, title: "Set Bundle Price", detail: "Price the bundle 10–15% below the NFT price + product price combined. This is the buyer's incentive to get both." },
      { step: 3, title: "Prepare Physical Inventory", detail: "Ensure sufficient physical product stock exists before the bundle sale opens. Overselling without stock destroys trust. Reserve stock in the inventory system." },
      { step: 4, title: "Create Bundle Order in Admin", detail: "When staff creates a bundle order, the system simultaneously reserves an NFT record from the wave AND reduces available product stock. Both are held for this customer." },
      { step: 5, title: "Confirm Both Payments", detail: "Confirm NFT payment (ETH + TWD) and product payment (TWD). Both tracked in the same order. Can be paid together or separately." },
      { step: 6, title: "Fulfill NFT Side", detail: "Assign specific NFT serial. Get customer wallet address. Transfer NFT to wallet. Mark NFT as Delivered." },
      { step: 7, title: "Fulfill Physical Side", detail: "Pick and pack product. Ship via carrier with tracking number. Mark as Shipped → Delivered when customer confirms receipt." },
      { step: 8, title: "Complete Order", detail: "Order is complete when BOTH the NFT is delivered to wallet AND the physical product is delivered to address. Full closure recorded in system." },
    ],
    bestFor: ["Bearth's core model", "Brand connection", "Higher average order value", "Collector appeal"],
    tips: [
      "Photography showing the NFT alongside the physical product is your strongest marketing asset — produce this before launch.",
      "The NFT can function as a digital certificate of authenticity for limited-edition physical items — lean into this narrative.",
      "Nike/RTFKT's success shows that the physical item drives NFT value, not just the other way around.",
    ],
    supported: true,
  },
  {
    priority: 7,
    name: "English Auction (Bidding)",
    tagline: "Let buyers compete. Highest bid wins. Maximum price extraction.",
    category: "Auction",
    categoryColor: "#7c3aed",
    industryNote: "Beeple's 'Everydays' sold for $69M at Christie's via English Auction. Nouns DAO auctions one Noun per day via English Auction and has consistently generated $50K–$200K+ per Noun. The format that broke NFT records.",
    description:
      "Price starts low and competitive bidding drives it up until the auction deadline. The highest bidder wins. Most effective for 1-of-1 or very limited legendary pieces where competitive buying maximises revenue far beyond any fixed price you could set.",
    process: [
      { step: 1, title: "Select NFTs for Auction", detail: "Reserve this format for your most rare, unique, or artistically exceptional NFTs. Legendary tier, 1-of-1 collaborations, or Genesis edition pieces." },
      { step: 2, title: "Set Starting Bid", detail: "Set a low starting bid (e.g. 0.01 ETH) to attract initial attention. The final price will be determined by bidder competition, not your starting price." },
      { step: 3, title: "Set Auction Duration", detail: "Typical duration: 24–72 hours. Longer auctions build more bids; shorter auctions create more urgency. Nouns runs 24-hour daily auctions." },
      { step: 4, title: "Set Bid Increment", detail: "Minimum bid increment (e.g. 0.01 ETH above current highest). Prevents trivial bid increments that waste gas." },
      { step: 5, title: "Anti-Snipe Extension", detail: "Configure a time extension (e.g. +5 minutes) if a bid is placed in the final 2 minutes. Prevents last-second sniping and keeps the auction fair." },
      { step: 6, title: "Run and Monitor", detail: "Announce the auction live. Share current bid updates on social to drive competitive bidding. Each new bid is a social media moment." },
      { step: 7, title: "Close and Settle", detail: "At deadline, highest bidder wins. Return all losing bids. Winner mints at their winning bid price. Record in BearthAdmin." },
    ],
    bestFor: ["1-of-1 NFTs", "Legendary tier", "Artist collaborations", "Maximum revenue extraction"],
    tips: [
      "Nouns DAO's daily auction model generates revenue continuously — consider a slow-release auction model for select Bearth legendaries.",
      "Share bidding updates in real time on social media — each new bid is content and drives more bids.",
      "English Auction for 1 legendary NFT often generates more revenue than selling 10 rares at fixed price.",
    ],
    supported: false,
  },
  {
    priority: 8,
    name: "Membership / Access Pass NFT",
    tagline: "The NFT is your membership card. Hold it to unlock ongoing benefits.",
    category: "Utility",
    categoryColor: "#0891b2",
    industryNote: "Gary Vee's VeeFriends ($100M+ total sales) uses NFTs as conference tickets and business meeting access passes. Moonbirds' 'nesting' mechanic locks NFTs in place for tiered rewards. Membership NFTs have among the highest long-term holder retention of any NFT type.",
    description:
      "The NFT functions as a permanent membership card granting holders exclusive, ongoing benefits: private event invitations, product discounts, early whitelist access to future waves, private community channels. Benefits persist as long as the holder owns the NFT.",
    process: [
      { step: 1, title: "Define Membership Tiers", detail: "Map NFT waves or rarity tiers to membership levels: e.g. Wave 1 = Gold Member, Wave 2 = Silver Member, Common rarity = Bronze. Each tier has distinct, escalating benefits." },
      { step: 2, title: "Define Concrete Benefits Per Tier", detail: "Be specific: Gold = private event invitations + 20% product discount + first whitelist slot. Silver = 15% discount + second whitelist slot. Bronze = 10% discount. Vague benefits reduce NFT value." },
      { step: 3, title: "Encode Membership Tier in Metadata", detail: "Add 'Membership Tier: Gold' as an on-chain trait. Any platform that reads NFT metadata — OpenSea, wallets, third-party apps — can verify membership tier instantly." },
      { step: 4, title: "Build Wallet Verification", detail: "Technical team deploys a verification endpoint: customer connects wallet → system checks holdings on-chain → returns their membership tier and active benefits." },
      { step: 5, title: "Integrate Discounts in Admin", detail: "When processing a product order for a holder, staff enters customer wallet → system auto-applies the membership discount → records discount in order notes." },
      { step: 6, title: "Manage Event Invitations", detail: "For events, generate the attendance allowlist directly from current NFT holder snapshot. Only wallets holding Bearth NFTs receive event invitations." },
      { step: 7, title: "Update and Expand Benefits", detail: "Regularly announce new benefits for holders. New benefits = reason to hold and not sell. Track benefit usage to understand which rewards are most valued." },
    ],
    bestFor: ["Long-term retention", "Community building", "Repeat product purchases", "Ongoing NFT utility"],
    tips: [
      "VeeFriends' success proves the membership model: the NFT's value is its access rights, not just the art.",
      "Benefits must be genuinely valuable. Weak benefits reduce NFT value and encourage selling.",
      "When an NFT is sold on OpenSea, the new holder automatically inherits all membership benefits — this is a strong selling point for secondaries.",
    ],
    supported: false,
  },
  {
    priority: 9,
    name: "Staking Rewards",
    tagline: "Lock your NFT. Earn rewards over time. Loyalty is measured in blocks.",
    category: "Utility",
    categoryColor: "#0891b2",
    industryNote: "ApeCoin staking for BAYC/MAYC holders reduced the total circulating BAYC supply on the market and sustained high floor prices for months. Multiple top-10 projects have implemented staking as a primary holder retention tool.",
    description:
      "NFT holders stake (lock) their Bearth NFT in a staking contract to earn rewards over time. Staked NFTs cannot be sold until unstaked. This reduces circulating supply on OpenSea, supports floor price, and keeps the community actively engaged with the project.",
    process: [
      { step: 1, title: "Deploy Staking Contract", detail: "Technical team deploys a separate ERC-721 staking contract. Holders approve the staking contract to manage their tokens, then lock them in. Staked NFTs are non-transferable." },
      { step: 2, title: "Define Reward Structure", detail: "Set reward rate (e.g. 10 Bearth Points per NFT per day staked). Define what points redeem for: product discounts, exclusive merch, future NFT airdrops, early whitelist access." },
      { step: 3, title: "Set Rarity Multipliers", detail: "Legendary earns 4× points per day. Epic 3×. Rare 2×. Common 1×. Multipliers incentivise holding rarer pieces and increase their secondary market value." },
      { step: 4, title: "Holder Stakes NFT", detail: "Holder approves the staking contract then stakes via the Bearth platform. NFT is locked in contract. Points accumulate every block." },
      { step: 5, title: "Claim Rewards Without Unstaking", detail: "Holder can claim accumulated rewards at any time without unstaking their NFT. Rewards applied as discount codes, airdrop eligibility, or points balance." },
      { step: 6, title: "Unstake to Sell", detail: "To sell on OpenSea, holder must unstake first (NFT returns to wallet). All unclaimed rewards are retained even after unstaking." },
      { step: 7, title: "Track in Admin", detail: "Admin dashboard shows total NFTs staked per wave, total rewards distributed, top stakers, and pending reward pool. Use for community reporting." },
    ],
    bestFor: ["Reducing sell pressure", "Floor price support", "Long-term engagement", "Community loyalty"],
    tips: [
      "Publish a live staking dashboard — seeing rewards accumulate in real time is powerfully motivating for holders.",
      "Minimum staking periods (e.g. 30 days) increase commitment and further reduce circulating supply.",
      "The BAYC ApeCoin staking model shows that well-designed staking can sustain a floor price for months even in bear markets.",
    ],
    supported: false,
  },
  {
    priority: 10,
    name: "Token-Gated Commerce",
    tagline: "Hold a Bearth NFT to unlock exclusive products and experiences.",
    category: "Utility",
    categoryColor: "#0891b2",
    industryNote: "Adidas Originals NFT holders got exclusive physical streetwear drops unavailable to the public. BAYC commercial rights to their ape's IP gave commercial value beyond art. Token-gating is now standard practice for brand NFT programmes.",
    description:
      "Owning a Bearth NFT unlocks exclusive pricing, early access, or unique products unavailable to the public. The NFT holder's wallet is verified on-chain — if they hold a qualifying token, all gates open automatically. Creates real ongoing utility for every holder.",
    process: [
      { step: 1, title: "Define Gating Rules", detail: "Specify exactly which NFTs unlock which benefits: Wave 1 NFT = 20% off all products + early access to new waves. Legendary NFT = 30% off + exclusive limited-edition product drops." },
      { step: 2, title: "Build Wallet Verification", detail: "Technical team deploys a verification endpoint. Customer provides wallet → system calls contract → returns applicable discount tier. No manual checking required." },
      { step: 3, title: "Apply Discount in Admin", detail: "Staff enters customer wallet when processing product order → admin auto-applies discount → records in order notes. Simple workflow, no room for error." },
      { step: 4, title: "Create Holder-Exclusive Products", detail: "Design specific products (limited colourways, special packaging) only accessible to NFT holders. These cannot be purchased by non-holders at any price." },
      { step: 5, title: "Gate Future Wave Access", detail: "For token-gated new wave access: snapshot current holders → create allowlist → holders get a priority mint window before public. Token-gating creates a closed loop." },
      { step: 6, title: "Communicate Benefits Actively", detail: "Publish and regularly update the full list of token-gating benefits. New benefits added = reason for existing holders to hold and for new buyers to purchase." },
    ],
    bestFor: ["Holder retention", "Product sales", "NFT utility", "Brand loyalty"],
    tips: [
      "Adidas's success shows that exclusive physical drops are more compelling than discount percentages.",
      "Create at least one benefit per quarter to maintain engagement — inactivity kills holder loyalty.",
      "When an NFT sells on OpenSea, the new holder inherits all token-gating benefits — this increases secondary sale prices.",
    ],
    supported: false,
  },
  {
    priority: 11,
    name: "Referral / Affiliate Sale",
    tagline: "Your community becomes your sales team. Commission for every confirmed sale.",
    category: "Community",
    categoryColor: "#db2777",
    industryNote: "Used widely in offline NFT sales across Asia and emerging markets. Ambassador programmes with referral commissions have driven significant sales volume for projects without large marketing budgets. Highly effective for community-led growth.",
    description:
      "External referrers — agents, community ambassadors, influencers — earn a percentage commission for every sale they bring in. Works for both online and offline channels. The referrer system is already built in BearthAdmin — needs commission automation to be complete.",
    process: [
      { step: 1, title: "Register Referrer in Admin", detail: "Referrers page → Add new referrer. Enter name, contact details, and assigned commission rate (%). Each referrer receives a unique referral code." },
      { step: 2, title: "Distribute Referral Codes", detail: "Share the unique code with each referrer. They pass it to buyers verbally (offline events) or include it in their content (online)." },
      { step: 3, title: "Link Order to Referrer", detail: "When creating an order in BearthAdmin, staff selects the referrer from the dropdown. The order is permanently linked to that referrer." },
      { step: 4, title: "Auto-Calculate Commission", detail: "On payment confirmation, the system calculates the referrer's commission automatically based on their rate and confirmed order amount. No manual calculation." },
      { step: 5, title: "Track in Reports", detail: "Referrer reports show total sales brought, confirmed commission earned, and pending payout per referrer and per wave." },
      { step: 6, title: "Process Payouts", detail: "On the agreed schedule (weekly or monthly), review each referrer's confirmed commissions. Process payment. Mark as paid in system." },
    ],
    bestFor: ["Offline events", "Community ambassadors", "Influencer marketing", "Markets without direct digital access"],
    tips: [
      "Tier your referrers — top performers earn higher commission rates. Competition between referrers increases total sales.",
      "Give buyers a small discount (3–5%) when using a referral code — incentivises them to actually use the code.",
      "Track ROI per referrer — some referrers bring volume, some bring high-value buyers. Invest accordingly.",
    ],
    supported: true,
  },
  {
    priority: 12,
    name: "Tiered Pricing by Rarity",
    tagline: "Common is accessible. Legendary commands a premium. Buyers choose their tier.",
    category: "Pricing Model",
    categoryColor: "#3b82f6",
    industryNote: "Standard in generative art NFTs and gaming NFT projects. Allows projects to monetise their full rarity spectrum. Games like Axie Infinity price their characters by rarity tier — it's the baseline model for any NFT with rarity attributes.",
    description:
      "Each rarity tier has its own price point. Buyers select which rarity tier they want to purchase, pay that tier's price, and receive a random NFT from that tier. Allows simultaneous sale of common NFTs at low prices and legendary NFTs at significant premiums.",
    process: [
      { step: 1, title: "Assign Rarity to All NFT Records", detail: "Every NFT must have a rarity tier assigned (Common / Rare / Epic / Legendary). This comes from the generation process and rarity weights set in the layer system." },
      { step: 2, title: "Set Price Per Tier", detail: "Price each tier to reflect relative scarcity: e.g. Common = 0.03 ETH, Rare = 0.08 ETH, Epic = 0.2 ETH, Legendary = 0.5 ETH." },
      { step: 3, title: "Configure Wave for Tiered Pricing", detail: "In NFT Waves, set up tier-based pricing alongside or instead of a single wave price. The wave now has up to 4 price points." },
      { step: 4, title: "Buyer Selects Tier", detail: "Buyer declares which rarity they want to purchase. System confirms availability in that tier and assigns a random NFT record of that rarity." },
      { step: 5, title: "Process Order", detail: "Create order in BearthAdmin with the selected tier and its price. Assign the next available NFT of matching rarity. Confirm payment. Deliver." },
      { step: 6, title: "Show Live Inventory Per Tier", detail: "Display remaining count per tier in real time during the sale. 'Only 2 Legendary left' is powerful social proof that drives urgent purchasing." },
    ],
    bestFor: ["All waves", "Maximising revenue on rare NFTs", "Buyer choice and control", "Mixed-rarity waves"],
    tips: [
      "Show live remaining counts per tier — scarcity visibility on the rarest tiers creates urgency.",
      "Consider combining Legendary tier with Dutch or English Auction for maximum price extraction.",
      "Price gaps between tiers should reflect true scarcity ratios — if Legendary is 10× rarer than Common, it should be priced significantly higher.",
    ],
    supported: false,
  },
  {
    priority: 13,
    name: "Mystery Box / Pack Sale",
    tagline: "Buy a sealed pack. Open it to discover what you received.",
    category: "Sales Format",
    categoryColor: "#d97706",
    industryNote: "NBA Top Shot — the highest-grossing NFT platform by total sales volume ($1B+) — is built entirely on the mystery pack model. Sorare (fantasy football NFTs) uses the same pack mechanics. Trading card collectors are the largest single collector demographic in NFTs.",
    description:
      "Buyers purchase a sealed mystery box containing a random set of NFTs. The contents are unknown until opened — creating the excitement of a trading card pack opening. Every open is a social sharing moment. Extremely effective for high-volume sales and community content generation.",
    process: [
      { step: 1, title: "Define Box Contents and Rarity Distribution", detail: "Set pack size (e.g. Pack of 3 NFTs) and guaranteed rarity composition: e.g. 2 Commons + 1 guaranteed Rare, with a 10% chance of an Epic replacing the Rare." },
      { step: 2, title: "Set Pack Price", detail: "Price at a discount versus buying each NFT individually. E.g. Pack of 3 = 0.18 ETH vs 3 separate at 0.24 ETH. The uncertainty is the trade-off for the discount." },
      { step: 3, title: "Seal Packs with Verifiable Randomness", detail: "Use a provably fair randomness mechanism (Chainlink VRF or commit-reveal scheme) to pre-assign NFTs to packs. All randomness is verifiable on-chain — no manipulation." },
      { step: 4, title: "Create Orders for Packs", detail: "In BearthAdmin, create pack orders. System reserves the pre-assigned NFTs for each pack. Payment confirmed before reveal." },
      { step: 5, title: "Reveal Packs", detail: "At purchase or at a designated reveal time, the pack contents are revealed. NFTs are assigned to the buyer's wallet." },
      { step: 6, title: "Capture the Social Moment", detail: "Encourage buyers to share their pack reveal on social media. Compile 'best pulls' content. Celebrate lucky buyers publicly." },
      { step: 7, title: "Deliver NFTs", detail: "Transfer all revealed NFTs to the buyer's wallet. Mark order as complete in fulfillment." },
    ],
    bestFor: ["High-volume sales", "Trading card collectors", "Clearing inventory", "Social media content"],
    tips: [
      "Guarantee at least one non-Common NFT in every pack — all-Common packs feel like a bad deal and damage trust.",
      "NBA Top Shot's success is proof that the pack mechanic is one of the most effective NFT revenue models — don't underestimate it.",
      "Post compilation videos of the best pack reveals — this content generates more purchases than almost any other marketing.",
    ],
    supported: false,
  },
  {
    priority: 14,
    name: "Flash Sale / Time-Limited Drop",
    tagline: "Limited NFTs. Deep discount. Short window. Pure urgency.",
    category: "Pricing Model",
    categoryColor: "#3b82f6",
    industryNote: "Popularised by Streetwear and sneaker culture (Supreme drops) applied to NFTs. Projects use flash sales to reactivate stale buyer interest, clear remaining wave inventory, and generate sudden social media activity between major drops.",
    description:
      "A small batch of NFTs sold at a significant discount for a very short window (1–4 hours), announced with minimal advance notice to maximise FOMO. Effective for re-engaging buyers who hesitated during the main sale and generating content between major launch events.",
    process: [
      { step: 1, title: "Select Flash Batch", detail: "Choose a limited number of remaining NFTs (20–50 max). Common to Rare tier is appropriate — do not flash-sale your Legendary pieces, it devalues them permanently." },
      { step: 2, title: "Set Discounted Price", detail: "30–50% below the wave price. The discount must be significant enough to create an immediate decision. A 10% discount is not compelling enough for a flash sale." },
      { step: 3, title: "Set Time Window", detail: "1–4 hours maximum. Shorter is more urgent. Set an exact start time — no ambiguity." },
      { step: 4, title: "Announce Last Minute", detail: "Post on all social channels 15–30 minutes before start. No advance notice — the surprise creates the most activity. 'Flash sale starts in 20 minutes' is the announcement." },
      { step: 5, title: "Process Orders Fast", detail: "Accept offline orders in BearthAdmin as they come in. Close at the exact end time regardless of stock remaining — no extensions." },
      { step: 6, title: "Post-Sale Announcement", detail: "Immediately post sell-out (if achieved) or remaining count. Both generate engagement. Sell-outs confirm demand; remaining stock invites hesitant buyers." },
    ],
    bestFor: ["Clearing wave inventory", "Re-engaging inactive buyers", "Social media content", "Between-wave momentum"],
    tips: [
      "Never flash-sale your most valuable NFTs — it permanently anchors your pricing lower in buyers' minds.",
      "Run maximum 1–2 flash sales per wave cycle to keep them special. Too frequent = buyers wait for flash prices.",
      "The surprise announcement is the mechanic — buyers who follow you on social are your flash sale audience.",
    ],
    supported: false,
  },
  {
    priority: 15,
    name: "Subscription / Season Pass",
    tagline: "Buy the full season upfront. Guaranteed access to every wave at a locked price.",
    category: "Loyalty",
    categoryColor: "#16a34a",
    industryNote: "Multi-season projects including Proof Collective (Moonbirds ecosystem) and Yuga Labs have used season pass mechanics. Provides revenue predictability for the project and price certainty for committed buyers — a win for both sides.",
    description:
      "A season pass grants guaranteed mint access to every wave in a defined season at a fixed, locked-in price. Buyers commit upfront before any wave launches. Provides Bearth with predictable early revenue and buyers with protection against wave price increases.",
    process: [
      { step: 1, title: "Define the Season", detail: "Group waves into a season (e.g. Waves 1–4 = Season 1). Calculate total value if bought separately vs the season pass price. A 20–25% season discount is a compelling offer." },
      { step: 2, title: "Launch Pass Sales Pre-Wave", detail: "Sell season passes before any wave launches. Issue a Season Pass NFT as proof of purchase — it's both a functional key and a collectible." },
      { step: 3, title: "Track Pass Holders in Admin", detail: "Maintain a list of season pass holders with wallet address, pass serial number, and which waves have been redeemed." },
      { step: 4, title: "Priority Access Every Wave", detail: "At each wave launch, pass holders get the first mint window (before whitelist or public). Their locked price applies regardless of that wave's public price." },
      { step: 5, title: "Record Redemptions", detail: "When a pass holder mints their wave NFT, mark the redemption against their pass in admin. Track remaining unclaimed waves per pass." },
      { step: 6, title: "Season Completion Reward", detail: "At season end, tally pass holders who used every wave mint. Reward full-season completionists with a bonus airdrop, exclusive NFT, or next season's pass at a further discount." },
    ],
    bestFor: ["Revenue predictability", "Multi-wave collectors", "Long-term community building"],
    tips: [
      "The Season Pass NFT itself is a collectible — design it as a prestige item, not just a functional key.",
      "Define in advance whether missed waves carry forward or are forfeited — ambiguity creates disputes.",
      "Season pass holders are your most valuable customers — treat them with exclusive communication and early access to announcements.",
    ],
    supported: false,
  },
  {
    priority: 16,
    name: "Burn-to-Mint / Upgrade",
    tagline: "Burn commons to forge something rarer. Supply shrinks. Value rises.",
    category: "Utility",
    categoryColor: "#0891b2",
    industryNote: "Yuga Labs' Mutant Serum mechanic (burn serum + BAYC = Mutant Ape) was applied to 10,000 NFTs and generated over $96M. Multiple top gaming NFT projects use burn mechanics to reduce total supply and create upgrade paths.",
    description:
      "Holders destroy (burn) lower-rarity NFTs to mint a higher-rarity one. Total NFT supply decreases with every burn, making remaining pieces scarcer and potentially more valuable. Creates deflationary dynamics and gives multi-NFT holders a purpose for accumulating.",
    process: [
      { step: 1, title: "Define Burn Ratios", detail: "Set conversion rates: Burn 3 Common → Mint 1 Rare. Burn 3 Rare → Mint 1 Epic. Burn 3 Epic → Mint 1 Legendary. Ratios should feel achievable but not trivially easy." },
      { step: 2, title: "Deploy Burn Contract", detail: "Technical team adds a burn-and-mint function to the smart contract. Contract verifies ownership of required tokens, burns them permanently, and mints the upgraded token." },
      { step: 3, title: "Holder Initiates Burn", detail: "Holder selects the NFTs to burn via the Bearth platform interface. Confirms the transaction. Burned NFTs are permanently destroyed — this is irreversible." },
      { step: 4, title: "Update DB Records", detail: "Burned NFTs marked as Destroyed in nft_records. New upgraded NFT record created with the correct rarity tier and fresh metadata." },
      { step: 5, title: "Upgraded NFT Metadata", detail: "New NFT gets upgraded metadata with its rarity tier. Add an 'Upgraded' or 'Forged' trait to permanently distinguish it on OpenSea. Unique provenance adds collector value." },
      { step: 6, title: "Publish Burn Statistics", detail: "Track and publicly report total NFTs burned, total supply remaining, and rarity distribution changes. Scarcity metrics drive collector interest." },
    ],
    bestFor: ["Reducing total supply", "Rewarding multi-NFT holders", "Secondary market value", "Long-term engagement"],
    tips: [
      "Announce burn mechanics before your first wave launches — it encourages buyers to accumulate multiples from day one.",
      "The 'Forged' or 'Upgraded' trait makes upgraded NFTs uniquely identifiable on OpenSea — collectors value verifiable provenance.",
      "Track and celebrate total supply burned publicly — 'X NFTs burned this week' is compelling deflationary narrative.",
    ],
    supported: false,
  },
  {
    priority: 17,
    name: "OTC / Private Sale",
    tagline: "High-value buyer. Custom price. Off-market transaction.",
    category: "Direct Sales",
    categoryColor: "#6b7280",
    industryNote: "Large OTC NFT transactions are common for high-value pieces. Christie's and Sotheby's facilitate private OTC sales for premium NFTs. Most transactions above $50K are handled OTC rather than through public smart contract mints.",
    description:
      "A direct negotiated sale between Bearth and a high-value buyer at a custom price. Specific serial numbers can be requested. No smart contract interaction required — staff manages the entire transaction in BearthAdmin. The entire sale is private and off-market.",
    process: [
      { step: 1, title: "Buyer Inquiry", detail: "High-value buyer contacts Bearth directly. States desired quantity, any specific NFTs by serial, and their budget range." },
      { step: 2, title: "Negotiate Terms", detail: "Staff negotiates price per NFT — typically a bulk discount for volume or a premium for specific rare serials. Agree on payment method." },
      { step: 3, title: "Create OTC Order in Admin", detail: "Staff creates a manual order in BearthAdmin. Select specific NFT records. Set negotiated price. Note 'OTC — Private Sale' in payment notes." },
      { step: 4, title: "Confirm Payment", detail: "Receive payment via agreed method (bank transfer, ETH direct, cash for offline). Confirm in admin." },
      { step: 5, title: "Transfer NFTs", detail: "Deliver all OTC NFTs to buyer's wallet(s). Mark each as Delivered. Complete the order." },
    ],
    bestFor: ["High-net-worth individuals", "Institutions", "Specific serial collectors", "Large volume buyers"],
    tips: [
      "Get terms confirmed in writing (email or contract) before processing — protects both parties.",
      "OTC buyers are often your highest-LTV customers — white-glove service and personal attention are expected.",
      "Do not publicly announce OTC prices — they are often at discounts or premiums that can confuse the market.",
    ],
    supported: true,
  },
  {
    priority: 18,
    name: "Physical Event Exclusive",
    tagline: "You had to be there. Event-only NFTs that cannot be bought online.",
    category: "Events",
    categoryColor: "#ea580c",
    industryNote: "Gary Vee's VeeFriends Conference NFTs (VeeCon) required holding a specific NFT to attend — making the NFT a literal event ticket. Multiple projects have issued event-exclusive NFTs as proof-of-attendance tokens (POAPs).",
    description:
      "A specific batch of NFTs is exclusively purchasable at physical events. Not available online, not on OpenSea. Attendees must physically be present and check in to become eligible. Creates powerful IRL community moments and strong FOMO for those who didn't attend.",
    process: [
      { step: 1, title: "Designate Event-Only NFT Batch", detail: "In NFT Records, mark a specific batch as Event-Only. These are reserved exclusively for event attendees and cannot be purchased through any other channel." },
      { step: 2, title: "Set Up Event Check-In", detail: "Create a QR code or check-in station at the venue. Attendee scans QR → provides wallet address → staff registers them as eligible in admin." },
      { step: 3, title: "Create Orders On-Site", detail: "Eligible attendees purchase during the event window. Staff creates offline orders in BearthAdmin immediately. Accept cash, card, or crypto." },
      { step: 4, title: "Mark Event Edition in Metadata", detail: "All event-exclusive NFTs carry an 'Event Edition: [Event Name]' trait in metadata. Permanently verifiable on OpenSea. Adds permanent collector and historical value." },
      { step: 5, title: "Transfer After Event", detail: "Deliver event NFTs to registered wallets within 24–48 hours after the event concludes. Mark as Delivered in fulfillment." },
    ],
    bestFor: ["IRL events", "Collector communities", "Event monetisation", "Proof of attendance"],
    tips: [
      "The event-exclusive trait in metadata makes these permanently verifiable as authentic event NFTs — a strong collector selling point.",
      "Limit the batch tightly (50–200 max) — rarity makes it more coveted.",
      "Announce event exclusives in the weeks before the event — the NFT becomes a reason to attend.",
    ],
    supported: false,
  },
  {
    priority: 19,
    name: "Corporate / Bulk Purchase",
    tagline: "Volume discounts for companies buying NFTs as corporate gifts or collectibles.",
    category: "Direct Sales",
    categoryColor: "#6b7280",
    industryNote: "Corporate gifting of NFTs is a growing B2B market. Companies including Gucci, Samsung, and various Asian conglomerates have purchased NFTs at scale for corporate branding and employee/client gifting programmes.",
    description:
      "Companies purchase NFTs in bulk for corporate gifts, team rewards, client appreciation, or branded collectibles. Volume-based discount tiers apply. Multiple delivery wallets can be specified in a single order.",
    process: [
      { step: 1, title: "Define Volume Discount Tiers", detail: "E.g. 10+ NFTs = 10% off, 25+ = 15% off, 50+ = 20% off. Publish these tiers publicly so companies can plan their budgets." },
      { step: 2, title: "Corporate Inquiry", detail: "Company contacts Bearth with quantity, rarity tier preference, delivery timeline, and whether they need a corporate invoice." },
      { step: 3, title: "Create Bulk Order in Admin", detail: "Single order with multiple NFT items. Apply volume discount. List all delivery wallets if the company wants individual delivery to multiple addresses." },
      { step: 4, title: "Issue Corporate Invoice", detail: "Generate invoice with company name, registration number, itemised breakdown, and tax details. Payment via bank transfer." },
      { step: 5, title: "Batch Deliver", detail: "Transfer all NFTs to specified wallet(s). If multiple wallets, batch-process transfers. Confirm completion with corporate contact." },
    ],
    bestFor: ["B2B sales", "Corporate gifting", "Event giveaways", "Client appreciation"],
    tips: [
      "Offer custom NFT packaging inserts for corporate orders — the physical presentation of a digital gift matters.",
      "Corporate buyers often want white-label or co-branded experiences — consider a corporate edition programme.",
    ],
    supported: true,
  },
  {
    priority: 20,
    name: "Gift Purchase",
    tagline: "Buy an NFT for someone else. Delivered straight to their wallet.",
    category: "Direct Sales",
    categoryColor: "#6b7280",
    industryNote: "NFT gifting is an underserved but growing segment. Holiday and birthday gifting of NFTs has increased year-on-year. Simple to implement but often overlooked — enabling gifting opens purchases to buyers who want an NFT for someone else.",
    description:
      "A buyer purchases an NFT to be sent directly to another person's wallet address. The NFT goes to the recipient, not the buyer. Simple workflow in BearthAdmin — record the recipient wallet separately and deliver there.",
    process: [
      { step: 1, title: "Record Gift Purchase", detail: "Staff creates the order. Mark as Gift Purchase. Record buyer's contact and payment details as usual." },
      { step: 2, title: "Collect Recipient Wallet", detail: "Record the recipient's wallet address in a separate field. Verify the address format is valid (0x... with correct length) before processing." },
      { step: 3, title: "Confirm Payment from Buyer", detail: "Buyer pays in full. The gift recipient pays nothing." },
      { step: 4, title: "Deliver to Recipient Wallet", detail: "When transferring, use the recipient wallet address (not buyer's). NFT goes directly to the gift recipient." },
      { step: 5, title: "Notify Both Parties", detail: "Confirm delivery to buyer. Optionally notify recipient that they have received an NFT (with OpenSea viewing instructions)." },
    ],
    bestFor: ["Birthday and holiday gifting", "Referral bonuses", "Competition prizes", "Peer-to-peer gifting"],
    tips: ["Add a gift message field so buyers can include a personal note with the order.", "Create a digital gift certificate template — a PDF with the NFT image, gift message, and delivery confirmation."],
    supported: true,
  },
  {
    priority: 21,
    name: "Cross-Project Collaboration",
    tagline: "Partner with another project. Share audiences. Grow both communities.",
    category: "Community",
    categoryColor: "#db2777",
    industryNote: "Yuga Labs' partnerships with Otherside brought multiple NFT communities together for land sales. Azuki collaborated with multiple brands. Cross-project collaborations are now a standard growth tactic for established NFT projects.",
    description:
      "Partner with another NFT project to offer their holders early access or discounts on Bearth NFTs — and vice versa. Audience cross-pollination benefits both communities with minimal marketing cost.",
    process: [
      { step: 1, title: "Identify Compatible Partner", detail: "Choose a project with complementary audience and similar values. Audience should overlap naturally, not compete directly with Bearth." },
      { step: 2, title: "Define Mutual Offer", detail: "Agree terms: e.g. Partner holders get 24hr early access + 10% discount on Bearth Wave 3. Bearth holders get same on partner's next drop." },
      { step: 3, title: "Build Partner Holder Allowlist", detail: "Partner provides holder wallet list or Bearth verifies on-chain. Generate Merkle tree. Upload to contract for the collaboration window." },
      { step: 4, title: "Joint Simultaneous Announcement", detail: "Both projects announce together. Cross-post and tag each other. Joint announcement doubles the reach." },
      { step: 5, title: "Track Collaboration Orders", detail: "Tag all collaboration orders in BearthAdmin ('Collab — [Partner Name]'). Report on new unique wallets acquired from the collaboration." },
    ],
    bestFor: ["Audience expansion", "Community cross-pollination", "Brand partnerships"],
    tips: ["The new unique wallets acquired is your primary ROI metric for collaborations.", "Choose partners whose community has purchasing power — follower count alone is not a proxy for buying intent."],
    supported: false,
  },
  {
    priority: 22,
    name: "Artist / Creator Edition",
    tagline: "Co-create with a known artist. Premium price. Shared royalties. Maximum reach.",
    category: "Special",
    categoryColor: "#9333ea",
    industryNote: "Beeple's collaborations, Pak's editions, and multiple celebrity NFT drops have proven the artist collaboration model. The artist's audience adds immediate distribution. Royalty splits via ERC-2981 ensure the artist earns on every future secondary trade.",
    description:
      "A limited NFT series co-created with a known artist, musician, or celebrity. Commands a significant price premium above standard waves. The smart contract encodes a royalty split — both Bearth and the collaborating creator earn automatically on every future OpenSea secondary trade.",
    process: [
      { step: 1, title: "Define Collaboration", detail: "Agree scope: number of NFTs, creative direction, revenue split for primary sale and ongoing ERC-2981 royalties. Both parties should have marketing commitments written in." },
      { step: 2, title: "Create Artwork Together", detail: "Artist contributes unique layers, signature elements, or a full design. These NFTs should be visually distinct from standard Bearth waves." },
      { step: 3, title: "Encode Royalty Split in Contract", detail: "Technical team sets ERC-2981 royalty configuration so every future OpenSea secondary sale automatically distributes royalties: X% to Bearth, Y% to the artist. Fully on-chain, no manual distribution." },
      { step: 4, title: "Set Premium Pricing", detail: "Price significantly above standard wave. For 1-of-1 or very limited editions, use English Auction. Artist's brand commands a premium." },
      { step: 5, title: "Joint Launch", detail: "Coordinate announcement with the artist. Their audience is the primary distribution channel. Both parties post simultaneously for maximum reach." },
      { step: 6, title: "Tag as Artist Edition", detail: "Add 'Artist Edition: [Name]' trait to all metadata. Permanently identifiable on OpenSea. Historical provenance is part of the value." },
    ],
    bestFor: ["New audience acquisition", "Premium revenue", "Prestige and press", "Royalty income from secondaries"],
    tips: [
      "The artist's community size matters less than their community's purchasing power — choose based on collector overlap.",
      "ERC-2981 royalties on the artist edition mean Bearth earns passively on every future resale for the life of the project.",
      "The 'Artist Edition' metadata trait makes these permanently verifiable on OpenSea — collector provenance drives long-term secondary value.",
    ],
    supported: false,
  },
];

const CATEGORIES = ["All", "Pricing Model", "Auction", "Access Control", "Sales Format", "Community", "Loyalty", "Direct Sales", "Events", "Utility", "Special"];

const CAT_COLOR: Record<string, string> = {
  "Pricing Model":  "#3b82f6",
  "Auction":        "#7c3aed",
  "Access Control": "#059669",
  "Sales Format":   "#d97706",
  "Community":      "#db2777",
  "Loyalty":        "#16a34a",
  "Direct Sales":   "#6b7280",
  "Events":         "#ea580c",
  "Utility":        "#0891b2",
  "Special":        "#9333ea",
};

export default function StrategiesPage() {
  const [selected, setSelected] = useState<Strategy | null>(null);
  const [category, setCategory] = useState("All");
  const [search, setSearch] = useState("");

  const filtered = STRATEGIES.filter(s => {
    const matchCat = category === "All" || s.category === category;
    const matchSearch = !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.description.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  return (
    <div className="flex h-full overflow-hidden" style={{ background: "#f0f2f7" }}>

      {/* ── Left: Strategy List ── */}
      <div
        className="flex flex-col flex-shrink-0 overflow-hidden bg-white"
        style={{
          width: selected ? "380px" : "100%",
          borderRight: selected ? "1px solid #e5e7eb" : "none",
          transition: "width 0.2s ease",
        }}
      >
        {/* List header */}
        <div className="flex-shrink-0 px-4 pt-4 pb-3 space-y-2" style={{ borderBottom: "1px solid #e5e7eb" }}>
          <div>
            <h1 className="text-base font-bold" style={{ color: "#24315f" }}>NFT Selling Strategies</h1>
            <p className="text-xs" style={{ color: "#9bafc5" }}>
              {STRATEGIES.length} strategies ranked by industry adoption · {STRATEGIES.filter(s => s.supported).length} live in system · Click any to view full guide
            </p>
          </div>
          <input
            type="text"
            placeholder="Search strategies..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full px-3 py-1.5 rounded-lg text-xs outline-none"
            style={{ border: "1px solid #e5e7eb", color: "#111827" }}
          />
          <div className="flex flex-wrap gap-1">
            {CATEGORIES.map(cat => (
              <button key={cat} onClick={() => setCategory(cat)}
                className="px-2 py-0.5 rounded text-[10px] font-semibold"
                style={category === cat
                  ? { background: cat === "All" ? "#24315f" : CAT_COLOR[cat], color: "#fff" }
                  : { background: "#f3f4f6", color: "#6b7280" }}>
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Strategy rows */}
        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
                <th className="py-2 pl-4 pr-2 text-left text-[10px] font-bold uppercase tracking-wider w-12" style={{ color: "#9bafc5" }}>#</th>
                <th className="py-2 px-2 text-left text-[10px] font-bold uppercase tracking-wider" style={{ color: "#9bafc5" }}>Strategy</th>
                <th className="py-2 px-2 text-left text-[10px] font-bold uppercase tracking-wider" style={{ color: "#9bafc5" }}>Category</th>
                <th className="py-2 pl-2 pr-4 text-center text-[10px] font-bold uppercase tracking-wider w-14" style={{ color: "#9bafc5" }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(s => {
                const isActive = selected?.priority === s.priority;
                const color = CAT_COLOR[s.category];
                return (
                  <tr
                    key={s.priority}
                    onClick={() => setSelected(isActive ? null : s)}
                    className="cursor-pointer transition-colors"
                    style={{
                      borderBottom: "1px solid #f3f4f6",
                      background: isActive ? `${color}0d` : "transparent",
                      borderLeft: isActive ? `3px solid ${color}` : "3px solid transparent",
                    }}
                    onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = "#f9fafb"; }}
                    onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                  >
                    <td className="py-2.5 pl-4 pr-2">
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-black"
                        style={{ background: isActive ? `${color}20` : "#f3f4f6", color: isActive ? color : "#9bafc5" }}>
                        {String(s.priority).padStart(2, "0")}
                      </div>
                    </td>
                    <td className="py-2.5 px-2">
                      <p className="text-xs font-semibold leading-tight" style={{ color: isActive ? color : "#111827" }}>{s.name}</p>
                      {!selected && <p className="text-[10px] mt-0.5 leading-tight line-clamp-1" style={{ color: "#9bafc5" }}>{s.tagline}</p>}
                    </td>
                    <td className="py-2.5 px-2">
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold whitespace-nowrap"
                        style={{ background: `${color}18`, color }}>
                        {s.category}
                      </span>
                    </td>
                    <td className="py-2.5 pl-2 pr-4 text-center">
                      {s.supported
                        ? <span className="inline-block w-2 h-2 rounded-full" style={{ background: "#16a34a" }} title="Live" />
                        : <span className="inline-block w-2 h-2 rounded-full" style={{ background: "#e5e7eb" }} title="Not yet implemented" />}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {filtered.length === 0 && (
            <div className="flex items-center justify-center h-32">
              <p className="text-xs" style={{ color: "#9bafc5" }}>No strategies match your search.</p>
            </div>
          )}

          {/* Legend */}
          <div className="px-4 py-3 flex items-center gap-3" style={{ borderTop: "1px solid #f3f4f6" }}>
            <span className="flex items-center gap-1.5 text-[10px]" style={{ color: "#9bafc5" }}>
              <span className="w-2 h-2 rounded-full inline-block" style={{ background: "#16a34a" }} />Live in system
            </span>
            <span className="flex items-center gap-1.5 text-[10px]" style={{ color: "#9bafc5" }}>
              <span className="w-2 h-2 rounded-full inline-block" style={{ background: "#e5e7eb" }} />Not yet implemented
            </span>
          </div>
        </div>
      </div>

      {/* ── Right: Detail Panel ── */}
      {selected && (() => {
        const color = CAT_COLOR[selected.category];
        return (
          <div className="flex-1 overflow-y-auto p-5 space-y-4 min-w-0">

            {/* Back */}
            <button onClick={() => setSelected(null)} className="flex items-center gap-1.5 text-xs font-medium" style={{ color: "#9bafc5" }}>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
              </svg>
              Back to list
            </button>

            {/* Title card */}
            <div className="bg-white rounded-2xl p-5" style={{ border: "1px solid #e5e7eb" }}>
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center text-lg font-black"
                  style={{ background: `${color}18`, color }}>
                  {String(selected.priority).padStart(2, "0")}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center flex-wrap gap-2 mb-1">
                    <h2 className="text-base font-bold" style={{ color: "#111827" }}>{selected.name}</h2>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                      style={{ background: `${color}18`, color }}>{selected.category}</span>
                    {selected.supported
                      ? <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: "rgba(22,163,74,0.1)", color: "#16a34a" }}>✓ Live in System</span>
                      : <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: "#f3f4f6", color: "#9bafc5" }}>Not yet implemented</span>}
                  </div>
                  <p className="text-xs font-semibold italic mb-2" style={{ color }}>&ldquo;{selected.tagline}&rdquo;</p>
                  <p className="text-xs leading-relaxed" style={{ color: "#6b7280" }}>{selected.description}</p>
                </div>
              </div>

              {/* Industry note */}
              <div className="mt-4 p-3 rounded-xl" style={{ background: `${color}0a`, border: `1px solid ${color}25` }}>
                <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color }}>Industry Evidence</p>
                <p className="text-xs leading-relaxed" style={{ color: "#374151" }}>{selected.industryNote}</p>
              </div>

              {/* Best for */}
              <div className="flex flex-wrap gap-1.5 mt-3 pt-3" style={{ borderTop: "1px solid #f3f4f6" }}>
                <span className="text-[10px] font-semibold self-center" style={{ color: "#9bafc5" }}>Best for:</span>
                {selected.bestFor.map(t => (
                  <span key={t} className="px-2 py-0.5 rounded text-[10px] font-medium"
                    style={{ background: "#f3f4f6", color: "#374151" }}>{t}</span>
                ))}
              </div>
            </div>

            {/* Process steps */}
            <div className="bg-white rounded-2xl p-5" style={{ border: "1px solid #e5e7eb" }}>
              <h3 className="text-sm font-bold mb-4" style={{ color: "#24315f" }}>Step-by-Step Process</h3>
              <div className="space-y-0">
                {selected.process.map((step, i) => (
                  <div key={step.step} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold z-10"
                        style={{ background: `${color}15`, color, border: `1.5px solid ${color}35` }}>
                        {step.step}
                      </div>
                      {i < selected.process.length - 1 && (
                        <div className="w-px flex-1 my-1" style={{ background: `${color}20`, minHeight: "16px" }} />
                      )}
                    </div>
                    <div className="flex-1 pb-4 min-w-0">
                      <p className="text-xs font-semibold mb-0.5" style={{ color: "#111827" }}>{step.title}</p>
                      <p className="text-xs leading-relaxed" style={{ color: "#6b7280" }}>{step.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Tips */}
            <div className="bg-white rounded-2xl p-5" style={{ border: "1px solid #e5e7eb" }}>
              <h3 className="text-sm font-bold mb-3" style={{ color: "#24315f" }}>Tips & Best Practices</h3>
              <div className="space-y-2.5">
                {selected.tips.map((tip, i) => (
                  <div key={i} className="flex items-start gap-2.5">
                    <div className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold mt-0.5"
                      style={{ background: "rgba(234,179,8,0.12)", color: "#ca8a04" }}>★</div>
                    <p className="text-xs leading-relaxed" style={{ color: "#374151" }}>{tip}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
