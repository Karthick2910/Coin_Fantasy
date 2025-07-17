const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

let wallet = {
  usd: 10000, 
  eth: 5000
};

let orders = [];
// Initialize with fallback price
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

// Enable mock mode endpoint
app.post('/api/enable-mock', (req, res) => {
  mockPriceEnabled = true;
  console.log('Mock price simulation enabled');
  res.json({
    success: true,
    message: 'Mock price simulation enabled',
    currentPrice: mockBasePrice
  });
});

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

// API Routes

// Get wallet balance
app.get('/api/wallet', (req, res) => {
  res.json({
    success: true,
    wallet: wallet
  });
});

// Get current ETH price with caching
app.get('/api/price', async (req, res) => {
  try {
    const price = await fetchEthPrice();
    res.json({
      success: true,
      price: price || currentPrice,
      timestamp: new Date(),
      cached: price === cachedPrice
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch price',
      price: currentPrice, // Return last known price
      timestamp: new Date()
    });
  }
});

// Get price history
app.get('/api/price-history', (req, res) => {
  res.json({
    success: true,
    history: priceHistory
  });
});

// Place buy order
app.post('/api/orders/buy', (req, res) => {
  try {
    const { amount, price } = req.body;
    
    if (!amount || !price || amount <= 0 || price <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid amount or price'
      });
    }
    
    const totalCost = amount * price;
    if (wallet.usd < totalCost) {
      return res.status(400).json({
        success: false,
        error: 'Insufficient USD balance'
      });
    }
    
    const order = {
      id: Date.now().toString(),
      type: ORDER_TYPES.BUY,
      amount: parseFloat(amount),
      price: parseFloat(price),
      status: ORDER_STATUS.PENDING,
      createdAt: new Date(),
      filledAt: null,
      filledPrice: null
    };
    
    orders.push(order);
    
    res.json({
      success: true,
      order: order,
      message: `Buy order placed: ${amount} ETH at $${price}`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Place sell order
app.post('/api/orders/sell', (req, res) => {
  try {
    const { amount, price } = req.body;
    
    if (!amount || !price || amount <= 0 || price <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid amount or price'
      });
    }
    
    if (wallet.eth < amount) {
      return res.status(400).json({
        success: false,
        error: 'Insufficient ETH balance'
      });
    }
    
    const order = {
      id: Date.now().toString(),
      type: ORDER_TYPES.SELL,
      amount: parseFloat(amount),
      price: parseFloat(price),
      status: ORDER_STATUS.PENDING,
      createdAt: new Date(),
      filledAt: null,
      filledPrice: null
    };
    
    orders.push(order);
    
    res.json({
      success: true,
      order: order,
      message: `Sell order placed: ${amount} ETH at $${price}`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get all orders
app.get('/api/orders', (req, res) => {
  res.json({
    success: true,
    orders: orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  });
});

// Cancel order
app.delete('/api/orders/:id', (req, res) => {
  try {
    const orderId = req.params.id;
    const orderIndex = orders.findIndex(order => order.id === orderId);
    
    if (orderIndex === -1) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }
    
    if (orders[orderIndex].status !== ORDER_STATUS.PENDING) {
      return res.status(400).json({
        success: false,
        error: 'Order cannot be cancelled'
      });
    }
    
    orders[orderIndex].status = ORDER_STATUS.CANCELLED;
    
    res.json({
      success: true,
      message: 'Order cancelled successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get trading statistics
app.get('/api/stats', (req, res) => {
  const totalOrders = orders.length;
  const filledOrders = orders.filter(order => order.status === ORDER_STATUS.FILLED).length;
  const pendingOrders = orders.filter(order => order.status === ORDER_STATUS.PENDING).length;
  
  res.json({
    success: true,
    stats: {
      totalOrders,
      filledOrders,
      pendingOrders,
      portfolioValue: wallet.usd + (wallet.eth * currentPrice)
    }
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Error:', error);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

// Start server
app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  console.log('Starting price monitoring...');
  
  // Initial price fetch
  await fetchEthPrice();
  console.log(`Initial ETH price: $${currentPrice}`);
  
  // Start monitoring
  startPriceMonitoring();
});

module.exports = app;
