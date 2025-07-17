import { useEffect, useState } from 'react';
import axios from 'axios';

function App() {
  const [wallet, setWallet] = useState({ usd: 0, eth: 0 });
  const [price, setPrice] = useState(null);
  const [buyPrice, setBuyPrice] = useState('');
  const [buyAmount, setBuyAmount] = useState('');
  const [sellPrice, setSellPrice] = useState('');
  const [sellAmount, setSellAmount] = useState('');
  const [orders, setOrders] = useState([]);
  const [loadingOrder, setLoadingOrder] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');


  const fetchData = async () => {
    try {
      setError('');
      const [walletRes, priceRes, ordersRes] = await Promise.all([
        axios.get('http://localhost:3001/api/wallet'),
        axios.get('http://localhost:3001/api/price'),
        axios.get('http://localhost:3001/api/orders')
      ]);
      setWallet(walletRes.data.wallet);
      setPrice(priceRes.data.price);
      setOrders(ordersRes.data.orders);
    } catch (err) {
      setError('Failed to fetch data from server.');
      setPrice(null);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleBuy = async () => {
    setError('');
    setSuccessMsg('');
    if (!buyPrice || !buyAmount || buyPrice <= 0 || buyAmount <= 0) {
      setError('Please enter valid buy price and amount.');
      return;
    }
    setLoadingOrder(true);
    try {
      const res = await axios.post('http://localhost:3001/api/orders/buy', {
        price: parseFloat(buyPrice),
        amount: parseFloat(buyAmount)
      });
      setSuccessMsg(res.data.message);
      setBuyPrice('');
      setBuyAmount('');
      fetchData();
    } catch (err) {
      setError(err.response?.data?.error || 'Buy order failed');
    }
    setLoadingOrder(false);
  };

  const handleSell = async () => {
    setError('');
    setSuccessMsg('');
    if (!sellPrice || !sellAmount || sellPrice <= 0 || sellAmount <= 0) {
      setError('Please enter valid sell price and amount.');
      return;
    }
    setLoadingOrder(true);
    try {
      const res = await axios.post('http://localhost:3001/api/orders/sell', {
        price: parseFloat(sellPrice),
        amount: parseFloat(sellAmount)
      });
      setSuccessMsg(res.data.message);
      setSellPrice('');
      setSellAmount('');
      fetchData();
    } catch (err) {
      setError(err.response?.data?.error || 'Sell order failed');
    }
    setLoadingOrder(false);
  };

  const handleCancelOrder = async (id) => {
    setError('');
    setSuccessMsg('');
    setLoadingOrder(true);
    try {
      const res = await axios.delete(`http://localhost:3001/api/orders/${id}`);
      setSuccessMsg(res.data.message);
      fetchData();
    } catch (err) {
      setError(err.response?.data?.error || 'Cancel failed');
    }
    setLoadingOrder(false);
  };

  const totalValue = (wallet.usd + (wallet.eth * (price || 0))).toFixed(2);

  return (
    <div className="min-h-screen bg-[#0d1117] text-white font-sans p-10 space-y-10">
      <div>
        <h1 className="text-5xl font-bold text-green-400 mb-2">📈 Crypto Trading POC</h1>
        <p className="text-gray-400 text-xl">Real-time Ethereum trading with automatic order execution</p>
      </div>

      {/* Price & Wallet */}
      <div className="grid lg:grid-cols-5 gap-6 items-stretch">
        {/* ETH Price */}
        <div className="bg-[#161b22] p-6 rounded-xl">
          <h2 className="text-2xl font-semibold mb-1">Ethereum Price</h2>
          <span className="text-xs bg-[#30363d] text-gray-300 px-2 py-0.5 rounded">LIVE</span>
          {price ? (
            <p className="text-4xl font-bold my-4">${price.toFixed(2)}</p>
          ) : (
            <p className="text-red-500 text-lg font-semibold mt-4">Failed to fetch price</p>
          )}
        </div>

        {/* Wallet */}
        <div className="bg-[#161b22] p-6 rounded-xl">
          <h2 className="text-2xl font-semibold">💼 Wallet</h2>
          <p className="mt-4 text-lg">USDT Balance: <span className="font-bold">${wallet.usd.toFixed(2)}</span></p>
          <p className="text-lg">ETH Balance: <span className="font-bold">{wallet.eth.toFixed(2)} ETH</span></p>
          <hr className="my-4 border-gray-600" />
          <p className="text-xl">🔗 Total Value: <span className="text-green-400 font-bold">${totalValue}</span></p>
        </div>

        {/* Buy Order */}
        <div className="bg-[#161b22] p-6 rounded-xl">
          <h2 className="text-2xl font-semibold text-green-400">↗️ Buy Order</h2>
          <input
            type="number"
            className="w-full mt-4 p-3 rounded bg-[#0d1117] border border-gray-700 text-lg"
            placeholder={`Buy below $${price?.toFixed(2) || 'Price'}`}
            value={buyPrice}
            onChange={e => setBuyPrice(e.target.value)}
            min="0"
            step="any"
          />
          <input
            type="number"
            className="w-full mt-2 p-3 rounded bg-[#0d1117] border border-gray-700 text-lg"
            placeholder="Amount (ETH)"
            value={buyAmount}
            onChange={e => setBuyAmount(e.target.value)}
            min="0"
            step="any"
          />
          <button
            className="w-full mt-4 bg-green-400 hover:opacity-90 text-black font-bold py-3 px-4 rounded text-lg"
            onClick={handleBuy}
            disabled={loadingOrder}
          >
            {loadingOrder ? 'Processing...' : 'Place Buy Order'}
          </button>
        </div>

        {/* Sell Order */}
        <div className="bg-[#161b22] p-6 rounded-xl">
          <h2 className="text-2xl font-semibold text-red-400">↘️ Sell Order</h2>
          <input
            type="number"
            className="w-full mt-4 p-3 rounded bg-[#0d1117] border border-gray-700 text-lg"
            placeholder={`Sell above $${price?.toFixed(2) || 'Price'}`}
            value={sellPrice}
            onChange={e => setSellPrice(e.target.value)}
            min="0"
            step="any"
          />
          <input
            type="number"
            className="w-full mt-2 p-3 rounded bg-[#0d1117] border border-gray-700 text-lg"
            placeholder="Amount (ETH)"
            value={sellAmount}
            onChange={e => setSellAmount(e.target.value)}
            min="0"
            step="any"
          />
          <button
            className="w-full mt-4 bg-red-500 hover:opacity-90 text-white font-bold py-3 px-4 rounded text-lg"
            onClick={handleSell}
            disabled={loadingOrder}
          >
            {loadingOrder ? 'Processing...' : 'Place Sell Order'}
          </button>
        </div>

        {/* Order History */}
        <div className="bg-[#161b22] p-6 rounded-xl overflow-auto">
          <h2 className="text-2xl font-semibold">🕒 Order History</h2>
          {orders.length === 0 ? (
            <p className="text-gray-400 text-lg mt-4">No orders placed yet</p>
          ) : (
            <ul className="mt-4 space-y-2 text-sm">
              {orders.map(order => (
                <li key={order.id} className="border-b border-gray-700 pb-2 flex items-center justify-between">
                  <span>
                    <span className={`font-bold ${order.type === 'buy' ? 'text-green-400' : 'text-red-400'}`}>
                      {order.type.toUpperCase()}
                    </span>{' '}
                    {order.amount} ETH @ ${order.price}{' '}
                    <span className={`ml-2 ${order.status === 'filled'
                      ? 'text-green-400'
                      : order.status === 'cancelled'
                        ? 'text-yellow-400'
                        : 'text-gray-400'}`}>
                      {order.status.toUpperCase()}
                    </span>
                  </span>
                  {order.status === 'pending' && (
                    <button
                      className="ml-4 px-2 py-1 bg-yellow-400 text-black rounded hover:bg-yellow-500"
                      onClick={() => handleCancelOrder(order.id)}
                      disabled={loadingOrder}
                    >
                      Cancel
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Feedback messages */}
      <div>
        {error && <div className="text-red-400 font-bold mb-2">{error}</div>}
        {successMsg && <div className="text-green-400 font-bold mb-2">{successMsg}</div>}
      </div>
    </div>
  );
}

export default App;