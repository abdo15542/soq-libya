import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import ProductForm from './ProductForm';

const SellerDashboard = ({ user }) => {
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [stats, setStats] = useState({ totalSales: 0, pendingOrders: 0, totalProducts: 0 });
  const [editingProduct, setEditingProduct] = useState(null);
  const [view, setView] = useState('products');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const [productsRes, ordersRes] = await Promise.all([
      api.get(`/products/seller/${user.id}`),
      api.get(`/orders/seller/${user.id}`)
    ]);
    setProducts(productsRes.data);
    setOrders(ordersRes.data);
    const totalSales = ordersRes.data.filter(o => o.status === 'delivered').reduce((acc, o) => acc + parseFloat(o.total_amount), 0);
    const pending = ordersRes.data.filter(o => o.status === 'pending' || o.status === 'ready_for_pickup').length;
    setStats({ totalSales, pendingOrders: pending, totalProducts: productsRes.data.length });
  };

  const handleAddProduct = async (productData) => {
    await api.post('/products', { ...productData, sellerId: user.id });
    fetchData();
    setEditingProduct(null);
  };

  const handleUpdateProduct = async (productId, updates) => {
    await api.put(`/products/${productId}`, updates);
    fetchData();
    setEditingProduct(null);
  };

  const handleDeleteProduct = async (productId) => {
    if (confirm('هل أنت متأكد من حذف هذا المنتج؟')) {
      await api.delete(`/products/${productId}`);
      fetchData();
    }
  };

  const updateOrderStatus = async (orderId, status) => {
    await api.put(`/orders/${orderId}/status`, { status });
    fetchData();
  };

  return (
    <div className="seller-dashboard">
      <nav className="seller-nav">
        <button onClick={() => setView('products')}>منتجاتي</button>
        <button onClick={() => setView('orders')}>الطلبات</button>
        <button onClick={() => setView('stats')}>التقارير</button>
      </nav>

      {view === 'stats' && (
        <div className="stats-cards">
          <div className="stat-card">إجمالي المبيعات: {stats.totalSales.toFixed(2)} د.ل</div>
          <div className="stat-card">طلبات معلقة: {stats.pendingOrders}</div>
          <div className="stat-card">عدد المنتجات: {stats.totalProducts}</div>
        </div>
      )}

      {view === 'products' && (
        <div>
          <h3>منتجاتي</h3>
          <button onClick={() => setEditingProduct({})}>إضافة منتج جديد</button>
          {editingProduct && (
            <ProductForm
              product={editingProduct}
              onSave={editingProduct.id ? handleUpdateProduct : handleAddProduct}
              onCancel={() => setEditingProduct(null)}
            />
          )}
          <div className="products-table">
            {products.map(p => (
              <div key={p.id} className="product-row">
                <img src={p.images?.[0]} width="50" alt={p.name} />
                <span>{p.name}</span>
                <span>{p.price} د.ل</span>
                <span>المخزون: {p.stock}</span>
                <button onClick={() => setEditingProduct(p)}>تعديل</button>
                <button onClick={() => handleDeleteProduct(p.id)}>حذف</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {view === 'orders' && (
        <div>
          <h3>الطلبات الواردة</h3>
          {orders.map(order => (
            <div key={order.id} className="order-item">
              <p>طلب #{order.id} - {order.product_name}</p>
              <p>الزبون: {order.customer_name}</p>
              <p>الحالة: {order.status}</p>
              {order.status === 'pending' && (
                <button onClick={() => updateOrderStatus(order.id, 'ready_for_pickup')}>تجهيز للشحن</button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SellerDashboard;