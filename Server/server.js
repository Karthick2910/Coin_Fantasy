const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3001;

const {
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
} = require('./trading');

app.use(cors());
app.use(express.json());

// Enable mock mode endpoint
app.post('/api/enable-mock', (req, res) => {
  enableMockPriceSimulation();
  res.json({
    success: true,
    message: 'Mock price simulation enabled',
    currentPrice: priceHistory.length > 0 ? priceHistory[priceHistory.length - 1].price : currentPrice
  });
});

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
      cached: price === currentPrice
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

// // Get trading statistics
// app.get('/api/stats', (req, res) => {
//   const totalOrders = orders.length;
//   const filledOrders = orders.filter(order => order.status === ORDER_STATUS.FILLED).length;
//   const pendingOrders = orders.filter(order => order.status === ORDER_STATUS.PENDING).length;

//   res.json({
//     success: true,
//     stats: {
//       totalOrders,
//       filledOrders,
//       pendingOrders,
//       portfolioValue: wallet.usd + (wallet.eth * currentPrice)
//     }
//   });
// });

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