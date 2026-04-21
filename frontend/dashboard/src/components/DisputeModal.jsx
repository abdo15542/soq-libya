import React, { useState } from 'react';
import api from '../utils/api';

const DisputeModal = ({ order, userId, onClose }) => {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!reason.trim()) return alert('الرجاء كتابة سبب النزاع');
    setLoading(true);
    try {
      await api.post('/disputes', { orderId: order.id, customerId: userId, reason });
      alert('تم فتح النزاع بنجاح، سنقوم بمراجعته');
      onClose();
    } catch (err) {
      alert('فشل فتح النزاع');
    }
    setLoading(false);
  };

  return (
    <div className="modal-overlay">
      <div className="modal dispute-modal">
        <h3>فتح نزاع على الطلب #{order.id}</h3>
        <form onSubmit={handleSubmit}>
          <textarea placeholder="اشرح سبب النزاع بالتفصيل..." value={reason} onChange={e => setReason(e.target.value)} required />
          <div className="buttons">
            <button type="button" onClick={onClose}>إلغاء</button>
            <button type="submit" disabled={loading}>{loading ? 'جاري...' : 'فتح نزاع'}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default DisputeModal;