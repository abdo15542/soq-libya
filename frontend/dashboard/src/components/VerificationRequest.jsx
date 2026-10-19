import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { compressImage } from '../utils/imageCompression';

const VerificationRequest = () => {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState('');
  const [requestedRole, setRequestedRole] = useState('seller');
  const [idImage, setIdImage] = useState(null);
  const [selfieImage, setSelfieImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleFile = async (event, setter) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { setMessage('يرجى اختيار ملف صورة صالح.'); return; }
    try { setter(await compressImage(file, 800)); setMessage(''); }
    catch { setMessage('تعذر تجهيز الصورة؛ جرّب صورة أخرى.'); }
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!idImage || !selfieImage) { setMessage('يلزم رفع صورة الوثيقة وصورة السيلفي.'); return; }
    setLoading(true); setMessage('');
    try {
      await api.post('/auth/verify', { fullName, requestedRole, idImage, selfieImage });
      setMessage('تم إرسال الطلب للمراجعة الإدارية. لن تُمنح صلاحيات البائع أو المندوب قبل اعتماد الوثائق.');
    } catch (error) { setMessage(error.response?.data?.error || 'تعذر إرسال الطلب. تأكد من تسجيل الدخول وحاول مجددًا.'); }
    finally { setLoading(false); }
  };

  return <main className="auth-container">
    <h2>طلب توثيق الحساب</h2>
    <p>اختر نوع الحساب وارفع وثائق واضحة. سيظل حسابك بحساب زبون حتى يراجع المدير الطلب ويعتمده.</p>
    <form onSubmit={submit}>
      <label>الاسم الكامل</label>
      <input value={fullName} onChange={e => setFullName(e.target.value)} required minLength={2} maxLength={100} />
      <label>نوع الحساب المطلوب</label>
      <select value={requestedRole} onChange={e => setRequestedRole(e.target.value)}><option value="seller">بائع</option><option value="driver">مندوب توصيل</option></select>
      <label>صورة جواز السفر أو البطاقة</label>
      <input type="file" accept="image/*" onChange={e => handleFile(e, setIdImage)} required />
      <label>صورة سيلفي مع الوثيقة</label>
      <input type="file" accept="image/*" onChange={e => handleFile(e, setSelfieImage)} required />
      <button type="submit" disabled={loading}>{loading ? 'جارٍ إرسال الطلب...' : 'إرسال للمراجعة'}</button>
    </form>
    {message && <p role="status">{message}</p>}
    <button type="button" onClick={() => navigate('/')}>العودة إلى السوق</button>
  </main>;
};
export default VerificationRequest;
