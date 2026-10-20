import React, { useEffect, useRef, useState } from 'react';
import api from '../utils/api';
import { compressImage } from '../utils/imageCompression';

const Auth = ({ setUser }) => {
  const googleButton = useRef(null);
  const [step, setStep] = useState('google');
  const [fullName, setFullName] = useState('');
  const [roleSelect, setRoleSelect] = useState('customer');
  const [idImage, setIdImage] = useState(null);
  const [selfieImage, setSelfieImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const render = () => {
      if (cancelled || !googleButton.current || !window.google?.accounts?.id) return false;
      const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
      if (!clientId) { setAuthError('تسجيل Google غير مهيأ بعد. يلزم ضبط VITE_GOOGLE_CLIENT_ID و GOOGLE_CLIENT_ID.'); return true; }
      window.google.accounts.id.initialize({ client_id: clientId, callback: async ({ credential }) => {
        if (!credential || cancelled) return;
        setLoading(true); setAuthError('');
        try {
          const response = await api.post('/auth/google', { credential });
          const session = { token: response.data.token, user: response.data.user };
          localStorage.setItem('soq_session', JSON.stringify(session));
          localStorage.setItem('soq_user', JSON.stringify(response.data.user));
          setUser(response.data.user);
        } catch (err) { setAuthError(err.response?.data?.error || 'تعذر تسجيل الدخول باستخدام Google. حاول مجددًا.'); }
        finally { setLoading(false); }
      }, auto_select: false, cancel_on_tap_outside: true });
      window.google.accounts.id.renderButton(googleButton.current, { type: 'standard', theme: 'outline', size: 'large', text: 'continue_with', shape: 'rectangular', width: 280, locale: 'ar' });
      return true;
    };
    if (render()) return () => { cancelled = true; };
    const timer = window.setInterval(() => { if (render()) window.clearInterval(timer); }, 250);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [setUser]);

  const handleVerification = async (e) => {
    e.preventDefault();
    if (!idImage || !selfieImage) { setAuthError('الرجاء رفع صورة البطاقة أو جواز السفر وصورة السيلفي'); return; }
    setLoading(true); setAuthError('');
    try {
      await api.post('/auth/verify', { idImage, selfieImage, fullName, requestedRole: roleSelect });
      const session = JSON.parse(localStorage.getItem('soq_session') || 'null');
      const userRes = await api.get('/auth/me');
      localStorage.setItem('soq_user', JSON.stringify(userRes.data));
      if (session) localStorage.setItem('soq_session', JSON.stringify({ ...session, user: userRes.data }));
      setUser(userRes.data); setStep('google');
      setAuthError('تم إرسال طلب التوثيق للإدارة. ستبقى صلاحيات البيع أو التوصيل معلقة حتى المراجعة.');
    } catch (err) { setAuthError(err.response?.data?.error || 'تعذر إرسال طلب التوثيق. تحقق من الاتصال ثم أعد المحاولة.'); }
    finally { setLoading(false); }
  };
  const handleFileChange = async (e, setter) => { const file = e.target.files?.[0]; if (!file) return; try { setter(await compressImage(file, 800)); } catch { setAuthError('تعذر تجهيز الصورة. جرّب صورة أخرى.'); } };

  if (step === 'verify') return <div className="auth-container"><h2>توثيق الحساب</h2><p>تسجيل الدخول بالبريد لا يمنح تلقائيًا صلاحيات البائع أو مندوب التوصيل.</p><form onSubmit={handleVerification}><input type="text" placeholder="الاسم الكامل" value={fullName} onChange={e => setFullName(e.target.value)} required maxLength={100} /><select value={roleSelect} onChange={e => setRoleSelect(e.target.value)}><option value="seller">طلب صلاحية بائع</option><option value="driver">طلب صلاحية مندوب توصيل</option></select><label>صورة جواز السفر / البطاقة</label><input type="file" accept="image/*" onChange={e => handleFileChange(e, setIdImage)} required /><label>صورة سيلفي مع الوثيقة</label><input type="file" accept="image/*" onChange={e => handleFileChange(e, setSelfieImage)} required /><button type="submit" disabled={loading}>{loading ? 'جارٍ الإرسال...' : 'إرسال للمراجعة'}</button></form>{authError && <p role="status">{authError}</p>}</div>;
  return <div className="auth-container"><h2>مرحباً بك في السوق الليبي</h2><p>سجّل الدخول بحساب Google موثّق. لا نطلب كلمة مرور Google ولا نخزن بصمة إصبعك.</p><div ref={googleButton} aria-label="تسجيل الدخول باستخدام Google" />{loading && <p>جارٍ التحقق من الحساب...</p>}{authError && <p role="alert">{authError}</p>}</div>;
};
export default Auth;
