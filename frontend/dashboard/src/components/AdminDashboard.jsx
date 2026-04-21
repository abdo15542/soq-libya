import React, { useState, useEffect } from 'react';
import api from '../utils/api';

const AdminDashboard = () => {
  const [stats, setStats] = useState({ totalOrders: 0, totalRevenue: 0, platformProfit: 0, pendingPayouts: 0, activeUsers: 0 });
  const [sellers, setSellers] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [disputes, setDisputes] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    fetchStats();
    fetchSellers();
    fetchDrivers();
    fetchDisputes();
  }, []);

  const fetchStats = async () => {
    const res = await api.get('/admin/stats');
    setStats(res.data);
  };
  const fetchSellers = async () => {
    const res = await api.get('/admin/sellers');
    setSellers(res.data);
  };
  const fetchDrivers = async () => {
    const res = await api.get('/admin/drivers');
    setDrivers(res.data);
  };
  const fetchDisputes = async () => {
    const res = await api.get('/admin/disputes');
    setDisputes(res.data);
  };

  const handleVerifyUser = async (userId, verified) => {
    await api.put(`/admin/users/${userId}/verify`, { verified });
    fetchSellers();
    fetchDrivers();
  };

  const handleResolveDispute = async (disputeId, resolution) => {
    await api.put(`/admin/disputes/${disputeId}/resolve`, { resolution });
    fetchDisputes();
    fetchStats();
  };

  return (
    <div className="admin-dashboard">
      <h2>لوحة تحكم المدير</h2>
      <div className="admin-tabs">
        <button onClick={() => setActiveTab('overview')} className={activeTab === 'overview' ? 'active' : ''}>نظرة عامة</button>
        <button onClick={() => setActiveTab('sellers')} className={activeTab === 'sellers' ? 'active' : ''}>البائعين</button>
        <button onClick={() => setActiveTab('drivers')} className={activeTab === 'drivers' ? 'active' : ''}>المندوبين</button>
        <button onClick={() => setActiveTab('disputes')} className={activeTab === 'disputes' ? 'active' : ''}>النزاعات</button>
      </div>

      {activeTab === 'overview' && (
        <div className="stats-grid">
          <div className="stat-card"><h3>إجمالي الطلبات</h3><p>{stats.totalOrders}</p></div>
          <div className="stat-card"><h3>إجمالي المبيعات</h3><p>{stats.totalRevenue} د.ل</p></div>
          <div className="stat-card"><h3>صافي أرباح المنصة</h3><p>{stats.platformProfit} د.ل</p></div>
          <div className="stat-card"><h3>مستحقات معلقة</h3><p>{stats.pendingPayouts} د.ل</p></div>
          <div className="stat-card"><h3>مستخدمين نشطين</h3><p>{stats.activeUsers}</p></div>
        </div>
      )}

      {activeTab === 'sellers' && (
        <table><thead><tr><th>الاسم</th><th>الهاتف</th><th>موثق</th><th>التقييم</th><th>المبيعات</th><th>إجراء</th></tr></thead>
          <tbody>{sellers.map(s => (
            <tr key={s.id}><td>{s.full_name}</td><td>{s.phone}</td><td>{s.verified ? '✅' : '❌'}</td><td>{s.rating}</td><td>{s.total_sales} د.ل</td>
              <td><button onClick={() => handleVerifyUser(s.id, !s.verified)}>{s.verified ? 'إلغاء' : 'توثيق'}</button></td></tr>
          ))}</tbody>
        </table>
      )}

      {activeTab === 'disputes' && disputes.map(d => (
        <div key={d.id} className="dispute-card"><p>طلب #{d.order_id} - {d.customer_name} ضد {d.seller_name}</p><p>{d.reason}</p>
          <button onClick={() => handleResolveDispute(d.id, 'refund')}>إعادة المبلغ</button>
          <button onClick={() => handleResolveDispute(d.id, 'dismiss')}>رفض النزاع</button>
        </div>
      ))}
    </div>
  );
};

export default AdminDashboard;