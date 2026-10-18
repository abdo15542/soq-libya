import React, { useState } from 'react';
import api from '../utils/api';
import { compressImage } from '../utils/imageCompression';

const Auth = ({ setUser }) => {
  const [step, setStep] = useState('phone');
  const [phone, setPhone] = useState('');
  const [fullName, setFullName] = useState('');
  const [roleSelect, setRoleSelect] = useState('customer');
  const [idImage, setIdImage] = useState(null);
  const [selfieImage, setSelfieImage] = useState(null);
  const [userId, setUserId] = useState(null);
  const [loading, setLoading] = useState(false);

  const handlePhoneSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.post('/auth/phone', { phone });
      if (res.data.success) {
        setUserId(res.data.user.id);
        if (res.data.user.verified) {
          const userRes = await api.get(`/auth/me/${res.data.user.id}`);
          setUser(userRes.data);
          localStorage.setItem('soq_user', JSON.stringify(userRes.data));
        } else {
          setStep('verify');
        }
      }
    } catch (err) {
      const status = err.response?.status;
      const serverMessage = err.response?.data?.error || err.response?.data?.message;
      const message = !err.response
        ? 'تعذر الوصول إلى الخادم. تحقق من الإنترنت وأن عنوان API صحيح.'
        : serverMessage || (status === 404
          ? 'مسار تسجيل الدخول غير موجود على الخادم.'
          : status >= 500
            ? 'حدث خطأ في الخادم. حاول لاحقًا.'
            : 'تعذر تسجيل الدخول. تحقق من رقم الهاتف.');
      alert(message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerification = async (e) => {
    e.preventDefault();
    if (!idImage || !selfieImage) {
      alert('الرجاء رفع صورة البطاقة والسيلفي');
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/verify', {
        userId, idImage, selfieImage, fullName, role: roleSelect
      });
      const userRes = await api.get(`/auth/me/${userId}`);
      setUser(userRes.data);
      localStorage.setItem('soq_user', JSON.stringify(userRes.data));
    } catch (err) {
      alert(err.response?.data?.error || 'تعذر توثيق الحساب. تحقق من الاتصال ثم أعد المحاولة.');
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = async (e, setter) => {
    const file = e.target.files[0];
    if (file) {
      const compressed = await compressImage(file, 800);
      setter(compressed);
    }
  };

  if (step === 'phone') {
    return (
      <div className="auth-container">
        <h2>مرحباً بك في السوق الليبي</h2>
        <form onSubmit={handlePhoneSubmit}>
          <input
            type="tel"
            placeholder="رقم الهاتف (مثال: 0912345678)"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
          />
          <button type="submit" disabled={loading}>
            {loading ? 'جاري...' : 'تسجيل الدخول'}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="auth-container">
      <h2>توثيق الحساب</h2>
      <form onSubmit={handleVerification}>
        <input
          type="text"
          placeholder="الاسم الكامل"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          required
        />
        <select value={roleSelect} onChange={(e) => setRoleSelect(e.target.value)}>
          <option value="customer">زبون</option>
          <option value="seller">بائع</option>
          <option value="driver">مندوب توصيل</option>
        </select>
        <label>صورة جواز السفر / البطاقة</label>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => handleFileChange(e, setIdImage)}
          required
        />
        <label>صورة سيلفي مع الوثيقة</label>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => handleFileChange(e, setSelfieImage)}
          required
        />
        <button type="submit" disabled={loading}>
          {loading ? 'جاري التوثيق...' : 'تأكيد التوثيق'}
        </button>
      </form>
    </div>
  );
};

export default Auth;