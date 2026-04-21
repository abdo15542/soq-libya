import React, { useState, useEffect } from 'react';
import { Routes, Route, Link, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import ProductCard from './ProductCard';
import OrderTracker from './OrderTracker';

const CustomerApp = ({ user }) => {
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [view, setView] = useState('products');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchProducts();
    fetchOrders();
  }, []);

  const fetchProducts = async () => {
    const res = await api.get('/products');
    setProducts(res.data);
  };

  const fetchOrders = async () => {
    const res = await api.get(`/orders/customer/${user.id}`);
    setOrders(res.data);
  };

  const handleBuy = async (product) => {
    const address = prompt('أدخل عنوان التوصيل التفصيلي:');
    if (!address) return;
    const deliveryFee = 5;
    try {
      await api.post('/orders', {
        customerId: user.id,
        sellerId: product.seller_id,
        productId: product.id,
        totalAmount: product.price,
        deliveryFee,
        customerAddress: address
      });
      alert('تم تقديم الطلب بنجاح!');
      fetchOrders();
    } catch (err) {
      alert('فشل الطلب');
    }
  };

  const handleViewProduct = (productId) => {
    navigate(`/product/${productId}`);
  };

  return (
    <div className="customer-app">
      <nav>
        <button onClick={() => setView('products')}>المنتجات</button>
        <button onClick={() => setView('orders')}>طلباتي</button>
      </nav>

      {view === 'products' && (
        <div className="products-grid">
          {products.map(p => (
            <ProductCard key={p.id} product={p} onBuy={handleBuy} onView={handleViewProduct} />
          ))}
        </div>
      )}

      {view === 'orders' && (
        <div className="orders-list">
          <h3>طلباتي</h3>
          {orders.map(order => (
            <div key={order.id} className="order-item" onClick={() => setSelectedOrder(order)}>
              <img src={order.product_images?.[0] || '/placeholder.png'} alt={order.product_name} />
              <div>
                <p>{order.product_name}</p>
                <p>البائع: {order.seller_name}</p>
                <p>الحالة: {order.status}</p>
                <p>المبلغ: {order.total_amount} د.ل</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedOrder && (
        <OrderTracker order={selectedOrder} userId={user.id} onClose={() => setSelectedOrder(null)} />
      )}
    </div>
  );
};

export default CustomerApp;