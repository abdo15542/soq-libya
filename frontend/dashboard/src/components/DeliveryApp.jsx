import React, { useState, useEffect } from 'react';
import api from '../utils/api';

const DeliveryApp = ({ user }) => {
  const [availableOrders, setAvailableOrders] = useState([]);
  const [myOrders, setMyOrders] = useState([]);
  const [city, setCity] = useState('طرابلس');
  const [active, setActive] = useState(true);

  useEffect(() => {
    if (active) {
      fetchAvailableOrders();
      const interval = setInterval(fetchAvailableOrders, 10000);
      return () => clearInterval(interval);
    }
  }, [city, active]);

  useEffect(() => {
    fetchMyOrders();
  }, []);

  const fetchAvailableOrders = async () => {
    const res = await api.get(`/delivery/available-orders/${city}`);
    setAvailableOrders(res.data);
  };

  const fetchMyOrders = async () => {
    const res = await api.get(`/delivery/driver/${user.id}`);
    setMyOrders(res.data);
  };

  const acceptOrder = async (orderId) => {
    await api.post('/delivery/accept-order', { orderId, driverId: user.id });
    fetchAvailableOrders();
    fetchMyOrders();
  };

  const markDelivered = async (orderId) => {
    await api.put(`/orders/${orderId}/status`, { status: 'delivered' });
    fetchMyOrders();
  };

  return (
    <div className="delivery-app">
      <div className="status-toggle">
        <label>
          <input type="checkbox" checked={active} onChange={() => setActive(!active)} />
          {active ? 'نشط (تستقبل طلبات)' : 'غير نشط'}
        </label>
        <select value={city} onChange={e => setCity(e.target.value)}>
          <option>طرابلس</option>
          <option>بنغازي</option>
          <option>مصراتة</option>
          <option>الزاوية</option>
        </select>
      </div>

      {active && (
        <section>
          <h3>الطلبات المتاحة في {city}</h3>
          {availableOrders.map(order => (
            <div key={order.id} className="order-card">
              <p>طلب #{order.id} - {order.product_name}</p>
              <p>استلام من: {order.seller_name}</p>
              <p>توصيل إلى: {order.customer_name}</p>
              <p>أجرة التوصيل: {order.delivery_fee} د.ل</p>
              <button onClick={() => acceptOrder(order.id)}>قبول الطلب</button>
            </div>
          ))}
        </section>
      )}

      <section>
        <h3>طلباتي الجارية</h3>
        {myOrders.filter(o => o.status !== 'delivered').map(order => (
          <div key={order.id} className="order-card">
            <p>طلب #{order.id} - {order.product_name}</p>
            <p>الزبون: {order.customer_name}</p>
            <p>العنوان: {order.customer_address}</p>
            <p>المبلغ المطلوب تحصيله: {order.total_amount} د.ل</p>
            <button onClick={() => markDelivered(order.id)}>تم التوصيل والتحصيل</button>
          </div>
        ))}
      </section>
    </div>
  );
};

export default DeliveryApp;