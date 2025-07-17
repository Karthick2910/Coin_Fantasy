const axios = require('axios');

let wallet = {
  usd: 10000, 
  eth: 5000
};

let orders = [];
let currentPrice = 3500; // Fallback ETH price in USD
let priceHistory = [];

// Mock price simulation for testing when API is rate limited
let mockPriceEnabled = false;
let mockBasePrice = 3500;

function simulatePriceMovement() {
  if (!mockPriceEnabled) return;
  
  // Simulate realistic price movements
  const change = (Math.random() - 0.5) * 20; // ±$10 movement
  mockBasePrice += change;
  
  // Keep price within reasonable bounds
  if (mockBasePrice < 3000) mockBasePrice = 3000;
  if (mockBasePrice > 4500) mockBasePrice = 4500;
  
  currentPrice = mockBasePrice;
  
  // Store in price history
  priceHistory.push({
    price: mockBasePrice,
    timestamp: new Date()
  });
  
  if (priceHistory.length > 100) {
    priceHistory.shift();
  }
  
  console.log(`Mock ETH price: ${mockBasePrice.toFixed(2)}`);
}

function enableMockPriceSimulation() {
  mockPriceEnabled = true;
  console.log('Mock price simulation enabled');
}

// Order types
const ORDER_TYPES = {
  BUY: 'buy',
  SELL: 'sell'
};

const ORDER_STATUS = {
  PENDING: 'pending',
  FILLED: 'filled',
  CANCELLED: 'cancelled'
};

// Price caching and rate limiting
let lastPriceFetch = 0;
let cachedPrice = null;
const PRICE_CACHE_DURATION = 10000; // 10 seconds cache
const MIN_REQUEST_INTERVAL = 15000; // 15 seconds between requests

// Fetch current ETH price from CoinGecko with rate limiting
async function fetchEthPrice() {
  const now = Date.now();
  
  // Return cached price if still valid
  if (cachedPrice && (now - lastPriceFetch) < PRICE_CACHE_DURATION) {
    return cachedPrice;
  }
  
  // Rate limiting - don't make requests too frequently
  if ((now - lastPriceFetch) < MIN_REQUEST_INTERVAL) {
    console.log('Rate limited - using cached price');
    return cachedPrice || currentPrice;
  }
  
  try {
    console.log('Fetching ETH price from CoinGecko...');
    
    const response = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd', {
      timeout: 10000,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'CryptoTradingBot/1.0'
      }
    });
    
    const price = response.data.ethereum.usd;
    
    // Update cache
    cachedPrice = price;
    currentPrice = price;
    lastPriceFetch = now;
    
    // Store price history (keep last 100 entries)
    priceHistory.push({
      price: price,
      timestamp: new Date()
    });
    
    if (priceHistory.length > 100) {
      priceHistory.shift();
    }
    
    console.log(`ETH price updated: ${price}`);
    return price;
    
  } catch (error) {
    console.error('Error fetching ETH price:', error.response?.status || error.message);
    
    // Handle specific error codes
    if (error.response?.status === 429) {
      console.log('Rate limit exceeded - will retry later');
      // Increase the minimum interval temporarily
      setTimeout(() => {
        console.log('Rate limit cooldown period over');
      }, 60000); // 1 minute cooldown
    }
    
    // Return cached price or current price as fallback
    return cachedPrice || currentPrice || 3500; // Fallback price
  }
}

// Process pending orders
function processOrders() {
  orders.forEach(order => {
    if (order.status === ORDER_STATUS.PENDING) {
      if (order.type === ORDER_TYPES.BUY && currentPrice <= order.price) {
        // Execute buy order
        const totalCost = order.price * order.amount;
        if (wallet.usd >= totalCost) {
          wallet.usd -= totalCost;
          wallet.eth += order.amount;
          order.status = ORDER_STATUS.FILLED;
          order.filledAt = new Date();
          order.filledPrice = currentPrice;
          console.log(`Buy order filled: ${order.amount} ETH at $${currentPrice}`);
        }
      } else if (order.type === ORDER_TYPES.SELL && currentPrice >= order.price) {
        // Execute sell order
        if (wallet.eth >= order.amount) {
          wallet.eth -= order.amount;
          wallet.usd += order.price * order.amount;
          order.status = ORDER_STATUS.FILLED;
          order.filledAt = new Date();
          order.filledPrice = currentPrice;
          console.log(`Sell order filled: ${order.amount} ETH at $${currentPrice}`);
        }
      }
    }
  });
}

// Start price monitoring with increased interval
async function startPriceMonitoring() {
  console.log('Starting price monitoring...');
  
  // Initial price fetch
  await fetchEthPrice();
  
  setInterval(async () => {
    if (mockPriceEnabled) {
      simulatePriceMovement();
    } else {
      const price = await fetchEthPrice();
      if (price && price !== currentPrice) {
        processOrders();
      }
    }
  }, 20000); // Increased to 20 seconds to respect rate limits
  
  // Separate interval for order processing (more frequent)
  setInterval(() => {
    if (currentPrice > 0) {
      processOrders();
    }
  }, 5000); // Process orders every 5 seconds
  
  // Mock price simulation interval
  setInterval(() => {
    if (mockPriceEnabled) {
      simulatePriceMovement();
      processOrders();
    }
  }, 3000); // Update mock price every 3 seconds
}

module.exports = {
  wallet,
  orders,
  currentPrice,
  priceHistory,
  mockPriceEnabled,
  simulatePriceMovement,
  enableMockPriceSimulation,
  ORDER_TYPES,
  ORDER_STATUS,
  fetchEthPrice,
  processOrders,
  startPriceMonitoring,
};