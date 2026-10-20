import React, { useState, useEffect, useCallback } from 'react';
import api from '../utils/api';

const DeliveryApp = ({ user }) => {
  const [availableOrders, setAvailableOrders] = useState([]);
  const [myOrders, setMyOrders] = useState([]);
  const [city, setCity] = useState('طرابلس');
  const [active, setActive] = useState(true);
  const [actionError, setActionError] = useState('');
  const [listError, setListError] = useState('');
  const [busyOrderId, setBusyOrderId] = useState(null);

  const fetchAvailableOrders = useCallback(async () => {
    try {
      const res = await api.get(`/delivery/available-orders/${encodeURIComponent(city)}`);
      setAvailableOrders(Array.isArray(res.data) ? res.data : []);
      setListError('');
      return true;
    } catch (error) {
      setListError(error.response?.data?.error || 'تعذر تحديث الطلبات المتاحة. تحقق من الاتصال وحاول التحديث.');
      return false;
    }
  }, [city]);

  const fetchMyOrders = useCallback(async () => {
    try {
      const res = await api.get(`/delivery/driver/${encodeURIComponent(user.id)}`);
      setMyOrders(Array.isArray(res.data) ? res.data : []);
      setListError('');
      return true;
    } catch (error) {
      setListError(error.response?.data?.error || 'تعذر تحميل طلباتك الجارية. تحقق من الاتصال وحاول التحديث.');
      return false;
    }
  }, [user.id]);

  useEffect(() => {
    if (!active) return undefined;
    void fetchAvailableOrders();
    const interval = setInterval(() => {
      void fetchAvailableOrders();
    }, 10000);
    return () => clearInterval(interval);
  }, [active, fetchAvailableOrders]);

  useEffect(() => {
    void fetchMyOrders();
  }, [fetchMyOrders]);

  const acceptOrder = async (orderId) => {
    setActionError('');
    setListError('');
    setBusyOrderId(orderId);
    try {
      // The backend verifies the selected city against the order's product city.
      // Never send driverId: the authenticated session determines the driver.
      await api.post('/delivery/accept-order', { orderId, city });
      const refreshed = await Promise.all([fetchAvailableOrders(), fetchMyOrders()]);
      if (refreshed.some((ok) => !ok)) {
        setActionError('تم قبول الطلب، لكن تعذر تحديث إحدى القوائم. اسحب للتحديث أو أعد فتح الصفحة.');
      }
    } catch (error) {
      setActionError(error.response?.data?.error || 'تعذر قبول الطلب. حدّث القائمة وحاول مرة أخرى.');
    } finally {
      setBusyOrderId(null);
    }
  };

  const markDelivered = async (orderId) => {
    setActionError('');
    setListError('');
    setBusyOrderId(orderId);
    try {
      await api.put(`/orders/${orderId}/status`, { status: 'delivered' });
      const refreshed = await fetchMyOrders();
      if (!refreshed) {
        setActionError('تم تسجيل إتمام الطلب، لكن تعذر تحديث القائمة. أعد تحميل الصفحة للتحقق.');
      }
    } catch (error) {
      setActionError(error.response?.data?.error || 'تعذر إتمام الطلب. تحقق من الاتصال وحاول مرة أخرى.');
    } finally {
      setBusyOrderId(null);
    }
  };

  return (
    <div className="delivery-app">
      {actionError && <p role="alert" className="error-message">{actionError}</p>}
      {listError && (
        <p role="alert" className="error-message">
          {listError}{' '}
          <button type="button" onClick={() => { void fetchAvailableOrders(); void fetchMyOrders(); }}>
            إعادة المحاولة
          </button>
        </p>
      )}
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
          {availableOrders.length === 0 && !listError && <p>لا توجد طلبات متاحة حالياً.</p>}
          {availableOrders.map(order => (
            <div key={order.id} className="order-card">
              <p>طلب #{order.id} - {order.product_name}</p>
              <p>استلام من: {order.seller_name}</p>
              <p>توصيل إلى: {order.customer_name}</p>
              <p>أجرة التوصيل: {order.delivery_fee} د.ل</p>
              <button type="button" disabled={busyOrderId === order.id} onClick={() => acceptOrder(order.id)}>
                {busyOrderId === order.id ? 'جارٍ المعالجة...' : 'قبول الطلب'}
              </button>
            </div>
          ))}
        </section>
      )}

      <section>
        <h3>طلباتي الجارية</h3>
        {myOrders.filter(o => o.status !== 'delivered').length === 0 && !listError && <p>لا توجد طلبات جارية.</p>}
        {myOrders.filter(o => o.status !== 'delivered').map(order => (
          <div key={order.id} className="order-card">
            <p>طلب #{order.id} - {order.product_name}</p>
            <p>الزبون: {order.customer_name}</p>
            <p>العنوان: {order.customer_address}</p>
            <p>المبلغ المطلوب تحصيله: {order.total_amount} د.ل</p>
            <button type="button" disabled={busyOrderId === order.id} onClick={() => markDelivered(order.id)}>
              {busyOrderId === order.id ? 'جارٍ المعالجة...' : 'تم التوصيل والتحصيل'}
            </button>
          </div>
        ))}
      </section>
    </div>
  );
};

export default DeliveryApp;
