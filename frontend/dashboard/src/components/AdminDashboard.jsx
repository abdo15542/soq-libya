import React, { useState, useEffect } from 'react';
import api from '../utils/api';

const AdminDashboard = () => {
  const [stats, setStats] = useState({ totalOrders: 0, totalRevenue: 0, platformProfit: 0, pendingPayouts: 0, activeUsers: 0 });
  const [sellers, setSellers] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [disputes, setDisputes] = useState([]);
  const [verificationRequests, setVerificationRequests] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');
  const [disputeActionError, setDisputeActionError] = useState('');
  const [busyDisputeId, setBusyDisputeId] = useState(null);
  const [userActionError, setUserActionError] = useState('');
  const [busyUserId, setBusyUserId] = useState(null);

  useEffect(() => {
    fetchStats();
    fetchSellers();
    fetchDrivers();
    fetchDisputes();
    fetchVerificationRequests();
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
  const fetchVerificationRequests = async () => {
    try { const res = await api.get('/admin/verification-requests'); setVerificationRequests(res.data); }
    catch (error) { console.error('تعذر تحميل طلبات التوثيق', error); }
  };
  const handleApproveRole = async (userId) => {
    if (!window.confirm('هل راجعت الوثائق وتريد اعتماد صلاحية الحساب؟')) return;
    try {
      await api.put('/admin/users/' + userId + '/approve-role');
      await fetchVerificationRequests();
      await fetchSellers();
      await fetchDrivers();
      alert('تم اعتماد الطلب بنجاح.');
    } catch (error) { alert(error.response?.data?.error || 'تعذر اعتماد الطلب.'); }
  };

  const handleVerifyUser = async (userId, verified) => {
    setUserActionError('');
    setBusyUserId(userId);
    try {
      await api.put(`/admin/users/${userId}/verify`, { verified });
      await Promise.all([fetchSellers(), fetchDrivers()]);
    } catch (error) {
      setUserActionError(error.response?.data?.error || 'تعذر تحديث توثيق الحساب. لم يتم تأكيد التغيير.');
    } finally {
      setBusyUserId(null);
    }
  };

  const handleResolveDispute = async (disputeId, resolution) => {
    setDisputeActionError('');
    setBusyDisputeId(disputeId);
    try {
      await api.put(`/admin/disputes/${disputeId}/resolve`, { resolution });
      await Promise.all([fetchDisputes(), fetchStats()]);
    } catch (error) {
      setDisputeActionError(error.response?.data?.error || 'تعذرت معالجة النزاع. لم يتم تأكيد أي تغيير.');
    } finally {
      setBusyDisputeId(null);
    }
  };

  return (
    <div className="admin-dashboard">
      <h2>لوحة تحكم المدير</h2>
      <div className="admin-tabs">
        <button onClick={() => setActiveTab('overview')} className={activeTab === 'overview' ? 'active' : ''}>نظرة عامة</button>
        <button onClick={() => setActiveTab('sellers')} className={activeTab === 'sellers' ? 'active' : ''}>البائعين</button>
        <button onClick={() => setActiveTab('drivers')} className={activeTab === 'drivers' ? 'active' : ''}>المندوبين</button>
        <button onClick={() => setActiveTab('verification')} className={activeTab === 'verification' ? 'active' : ''}>طلبات التوثيق ({verificationRequests.length})</button>
        <button onClick={() => setActiveTab('disputes')} className={activeTab === 'disputes' ? 'active' : ''}>النزاعات</button>
      </div>

      {activeTab === 'overview' && (
        <div className="stats-grid">
          <div className="stat-card"><h3>إجمالي الطلبات</h3><p>{stats.totalOrders}</p></div>
          <div className="stat-card"><h3>مبيعات الطلبات المسلّمة</h3><p>{stats.totalRevenue} د.ل</p></div>
          <div className="stat-card"><h3>عمولة المنصة التقديرية (10%)</h3><p>{stats.platformProfit} د.ل</p></div>
          <div className="stat-card"><h3>مستحقات البائعين التقديرية غير المحوّلة</h3><p>{stats.pendingPayouts} د.ل</p></div>
          <p role="note">الأرقام تقديرية ومحسوبة من الطلبات المسلّمة فقط؛ ولا تعني أن الدفع أو تحويل المستحقات قد تم فعليًا.</p>
          <div className="stat-card"><h3>مستخدمين نشطين</h3><p>{stats.activeUsers}</p></div>
        </div>
      )}

      {activeTab === 'sellers' && userActionError && <p role="alert" className="error-message">{userActionError}</p>}
      {activeTab === 'drivers' && userActionError && <p role="alert" className="error-message">{userActionError}</p>}
      {activeTab === 'sellers' && (
        <table><thead><tr><th>الاسم</th><th>الهاتف</th><th>موثق</th><th>التقييم</th><th>المبيعات</th><th>إجراء</th></tr></thead>
          <tbody>{sellers.map(s => (
            <tr key={s.id}><td>{s.full_name}</td><td>{s.phone}</td><td>{s.verified ? '✅' : '❌'}</td><td>{s.rating}</td><td>{s.total_sales} د.ل</td>
              <td><button type="button" disabled={busyUserId !== null} onClick={() => handleVerifyUser(s.id, !s.verified)}>{busyUserId === s.id ? 'جارٍ التحديث...' : s.verified ? 'إلغاء' : 'توثيق'}</button></td></tr>
          ))}</tbody>
        </table>
      )}

      {activeTab === 'verification' && (
        <section>
          <h3>طلبات اعتماد البائعين والمندوبين</h3>
          {verificationRequests.length === 0 ? <p>لا توجد طلبات معلقة حاليًا.</p> : (
            <table><thead><tr><th>الاسم</th><th>البريد</th><th>نوع الطلب</th><th>الوثائق</th><th>الإجراء</th></tr></thead><tbody>
              {verificationRequests.map(request => <tr key={request.id}><td>{request.full_name || 'بدون اسم'}</td><td>{request.email || '—'}</td><td>{request.requested_role === 'seller' ? 'بائع' : 'مندوب توصيل'}</td><td><div style={{display:'flex',gap:8,flexWrap:'wrap'}}><a href={request.id_image} target='_blank' rel='noreferrer'>عرض الوثيقة</a><a href={request.selfie_image} target='_blank' rel='noreferrer'>عرض السيلفي</a></div></td><td><button onClick={() => handleApproveRole(request.id)}>اعتماد بعد مراجعة الوثائق</button></td></tr>)}
            </tbody></table>
          )}
        </section>
      )}

      {activeTab === 'disputes' && disputeActionError && <p role="alert" className="error-message">{disputeActionError}</p>}
      {activeTab === 'disputes' && disputes.map(d => (
        <div key={d.id} className="dispute-card"><p>طلب #{d.order_id} - {d.customer_name} ضد {d.seller_name}</p><p>{d.reason}</p>
          <button type="button" disabled>الاسترداد المالي غير مفعّل</button>
          <button type="button" disabled={busyDisputeId !== null} onClick={() => handleResolveDispute(d.id, 'dismiss')}>{busyDisputeId === d.id ? 'جارٍ المعالجة...' : 'رفض النزاع'}</button>
        </div>
      ))}
    </div>
  );
};

export default AdminDashboard;