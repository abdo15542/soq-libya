import React, { useState } from 'react';
import api from '../utils/api';

const RatingModal = ({ order, userId, onClose, onRated }) => {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      // تقييم البائع
      await api.post('/ratings', { orderId: order.id, raterId: userId, ratedUserId: order.seller_id, rating, comment });
      // تقييم المندوب إذا وجد
      if (order.driver_id) {
        await api.post('/ratings', { orderId: order.id, raterId: userId, ratedUserId: order.driver_id, rating, comment: `تقييم للمندوب: ${comment}` });
      }
      onRated();
      onClose();
    } catch (err) {
      alert('فشل إرسال التقييم');
    }
    setLoading(false);
  };

  return (
    <div className="modal-overlay">
      <div className="modal rating-modal">
        <h3>تقييم الطلب #{order.id}</h3>
        <form onSubmit={handleSubmit}>
          <div className="stars">
            {[1,2,3,4,5].map(star => (
              <span key={star} className={star <= rating ? 'star selected' : 'star'} onClick={() => setRating(star)}>★</span>
            ))}
          </div>
          <textarea placeholder="تعليقك (اختياري)" value={comment} onChange={e => setComment(e.target.value)} />
          <div className="buttons">
            <button type="button" onClick={onClose}>إلغاء</button>
            <button type="submit" disabled={loading}>{loading ? 'جاري...' : 'إرسال التقييم'}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RatingModal;