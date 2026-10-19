import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Auth from './components/Auth';
import CustomerApp from './components/CustomerApp';
import SellerDashboard from './components/SellerDashboard';
import DeliveryApp from './components/DeliveryApp';
import AdminDashboard from './components/AdminDashboard';
import ProductDetail from './components/ProductDetail';
import { Terms, Privacy } from './components/StaticPages';
import api from './utils/api';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const restoreSession = async () => {
      try {
        const session = JSON.parse(localStorage.getItem('soq_session') || 'null');
        if (!session?.token) throw new Error('NO_SESSION');
        const response = await api.get('/auth/me');
        if (!active) return;
        setUser(response.data);
        localStorage.setItem('soq_user', JSON.stringify(response.data));
        localStorage.setItem('soq_session', JSON.stringify({ ...session, user: response.data }));
      } catch {
        localStorage.removeItem('soq_user');
        localStorage.removeItem('soq_session');
        if (active) setUser(null);
      } finally { if (active) setLoading(false); }
    };
    restoreSession();
    return () => { active = false; };
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('soq_user');
    localStorage.removeItem('soq_session');
    setUser(null);
    window.location.href = '/';
  };

  const handleBuy = (product) => {
    // سيتم استدعاؤها من مكونات المنتج
    console.log('شراء المنتج:', product);
  };

  if (loading) return <div className="loading-screen">جاري التحميل...</div>;

  if (!user) {
    return (
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Auth setUser={setUser} />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </BrowserRouter>
    );
  }

  return (
    <BrowserRouter>
      <div className="app-container">
        <header className="app-header">
          <h1>السوق الليبي</h1>
          <div className="user-info">
            <span>{user.full_name || user.phone}</span>
            <button onClick={handleLogout}>خروج</button>
          </div>
        </header>
        <Routes>
          <Route path="/" element={
            user.role === 'customer' ? <CustomerApp user={user} /> :
            user.role === 'seller' ? <SellerDashboard user={user} /> :
            user.role === 'driver' ? <DeliveryApp user={user} /> :
            user.role === 'admin' ? <AdminDashboard /> :
            <Navigate to="/" />
          } />
          <Route path="/product/:id" element={<ProductDetail user={user} onBuy={handleBuy} />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/privacy" element={<Privacy />} />
        </Routes>
        <footer className="app-footer">
          <a href="/terms">شروط الاستخدام</a> | <a href="/privacy">سياسة الخصوصية</a>
          <p>© 2024 السوق الليبي - جميع الحقوق محفوظة</p>
        </footer>
      </div>
    </BrowserRouter>
  );
}

export default App;