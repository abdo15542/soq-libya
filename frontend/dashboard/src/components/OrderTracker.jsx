import React, { useState } from 'react';
import ChatBox from './ChatBox';
import RatingModal from './RatingModal';
import DisputeModal from './DisputeModal';
import DriverTracker from './DriverTracker';

const OrderTracker = ({ order, userId, onClose }) => {
  const [showRating, setShowRating] = useState(false);
  const [showDispute, setShowDispute] = useState(false);

  const statusMap = {
    pending: 'قيد الانتظار',
    ready_for_pickup: 'جاهز للاستلام',
    in_delivery: 'قيد التوصيل',
    delivered: 'تم التوصيل',
    disputed: 'متنازع عليه'
  };

  return (
    <div className="modal-overlay">
      <div className="modal order-tracker-modal" style={{ maxWidth: '700px' }}>
        <button className="close-btn" onClick={onClose}>×</button>
        <h3>تفاصيل الطلب #{order.id}</h3>
        <p>المنتج: {order.product_name}</p>
        <p>البائع: {order.seller_name}</p>
        <p>المندوب: {order.driver_name || 'لم يعين بعد'}</p>
        <p>الحالة: <span className={`order-status-badge status-${order.status}`}>{statusMap[order.status] || order.status}</span></p>
        <p>المبلغ الإجمالي: {order.total_amount} د.ل</p>
        
        {order.status === 'in_delivery' && order.driver_id && (
          <DriverTracker driverId={order.driver_id} />
        )}

        <ChatBox orderId={order.id} userId={userId} />

        {order.status === 'delivered' && (
          <div className="actions">
            <button onClick={() => setShowRating(true)}>تقييم الطلب</button>
          </div>
        )}
        {order.status !== 'disputed' && order.status !== 'delivered' && (
          <div className="actions">
            <button className="danger" onClick={() => setShowDispute(true)}>فتح نزاع</button>
          </div>
        )}

        {showRating && <RatingModal order={order} userId={userId} onClose={() => setShowRating(false)} onRated={onClose} />}
        {showDispute && <DisputeModal order={order} userId={userId} onClose={() => setShowDispute(false)} />}
      </div>
    </div>
  );
};

export default OrderTracker;