const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const { checkAuth, checkRole } = require('../middleware/auth');
const { decryptIdentity } = require('../utils/identity-crypto');
const { isAllowedImageDataUrl } = require('../utils/identity-validation');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false });

// استخدام صلاحية admin فقط
router.use(checkAuth);
router.use(checkRole(['admin']));

// إحصائيات
router.get('/stats', async (req, res) => {
  try {
    // Count every order for operational reporting, but only count delivered
    // orders as completed sales. Pending/cancelled/disputed orders are not revenue.
    const orders = await pool.query(`
      SELECT COUNT(*) AS total,
             COALESCE(SUM(CASE WHEN status = 'delivered' THEN total_amount ELSE 0 END), 0) AS revenue
      FROM orders
    `);
    const profit = await pool.query(`
      SELECT COALESCE(SUM(o.total_amount * 0.10), 0) AS profit
      FROM orders o
      WHERE o.status = 'delivered'
    `);
    const pending = await pool.query(`
      SELECT COALESCE(SUM(total_amount * 0.90), 0) AS pending
      FROM orders
      WHERE status = 'delivered' AND paid_to_seller = FALSE
    `);
    const activeUsers = await pool.query('SELECT COUNT(*) as count FROM users WHERE verified = TRUE');
    
    res.json({
      totalOrders: parseInt(orders.rows[0].total) || 0,
      totalRevenue: parseFloat(orders.rows[0].revenue) || 0,
      platformProfit: parseFloat(profit.rows[0].profit) || 0,
      pendingPayouts: parseFloat(pending.rows[0].pending) || 0,
      activeUsers: parseInt(activeUsers.rows[0].count) || 0
    });
  } catch (error) {
    console.error('Admin stats query failed:', error);
    res.status(500).json({ error: 'تعذر جلب الإحصائيات' });
  }
});

// قائمة البائعين
router.get('/sellers', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT u.id, u.full_name, u.role, u.verified, u.rating, u.created_at, COALESCE(SUM(o.total_amount), 0) as total_sales
      FROM users u
      LEFT JOIN orders o ON u.id = o.seller_id AND o.status = 'delivered'
      WHERE u.role = 'seller'
      GROUP BY u.id
      ORDER BY u.created_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Admin seller listing failed:', error);
    res.status(500).json({ error: 'تعذر جلب قائمة البائعين' });
  }
});

// قائمة المندوبين
router.get('/drivers', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT u.id, u.full_name, u.role, u.verified, u.rating, u.created_at, COUNT(o.id) as total_deliveries
      FROM users u
      LEFT JOIN orders o ON u.id = o.driver_id AND o.status = 'delivered'
      WHERE u.role = 'driver'
      GROUP BY u.id
      ORDER BY u.created_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Admin driver listing failed:', error);
    res.status(500).json({ error: 'تعذر جلب قائمة المندوبين' });
  }
});

// طلبات توثيق الحسابات وصلاحيات البائع/المندوب
router.get('/verification-requests', async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, email, full_name, requested_role, verified, id_image, selfie_image, created_at FROM users WHERE requested_role IN ('seller', 'driver') AND id_image IS NOT NULL AND selfie_image IS NOT NULL ORDER BY created_at ASC"
    );
    const requests = result.rows.map(row => {
      try {
        return { ...row, id_image: decryptIdentity(row.id_image), selfie_image: decryptIdentity(row.selfie_image) };
      } catch (error) {
        console.error('Identity document decryption failed for user:', row.id, error);
        return { ...row, id_image: null, selfie_image: null, document_error: true };
      }
    });
    res.set('Cache-Control', 'no-store, private');
    res.json(requests);
  } catch (error) { console.error('Verification request listing failed:', error); res.status(500).json({ error: 'تعذر جلب طلبات التوثيق' }); }
});

router.put('/users/:userId/approve-role', async (req, res) => {
  const userId = Number(req.params.userId);
  if (!Number.isSafeInteger(userId) || userId < 1) return res.status(400).json({ error: 'معرّف الحساب غير صحيح' });

  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    // Lock the request so concurrent admin actions cannot approve a stale or changed record.
    const pending = await client.query(
      "SELECT id, requested_role, id_image, selfie_image FROM users WHERE id = $1 AND requested_role IN ('seller', 'driver') FOR UPDATE",
      [userId]
    );
    if (!pending.rowCount) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'طلب التوثيق غير موجود أو غير مكتمل' });
    }

    const record = pending.rows[0];
    if (!record.id_image || !record.selfie_image) {
      await client.query('ROLLBACK');
      return res.status(422).json({ error: 'مستندات التوثيق ناقصة، لا يمكن اعتماد الحساب' });
    }

    // Presence alone is insufficient: corrupted ciphertext must never be accepted as verified identity.
    try {
      const idImage = decryptIdentity(record.id_image);
      const selfieImage = decryptIdentity(record.selfie_image);
      if (!isAllowedImageDataUrl(idImage) || !isAllowedImageDataUrl(selfieImage)) {
        throw new Error('Identity image payload is not a valid data URL');
      }
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Identity validation failed during approval for user:', userId, error);
      return res.status(422).json({ error: 'تعذر التحقق من سلامة مستندات الهوية؛ لم يتم اعتماد الحساب' });
    }

    const result = await client.query(
      "UPDATE users SET role = requested_role, verified = TRUE, requested_role = NULL WHERE id = $1 AND requested_role IN ('seller', 'driver') RETURNING id, role, verified",
      [userId]
    );
    if (!result.rowCount) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'تغير طلب التوثيق أثناء المعالجة؛ أعد المحاولة' });
    }
    await client.query('COMMIT');
    return res.json({ success: true, user: result.rows[0] });
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    console.error('Role approval failed:', error);
    return res.status(500).json({ error: 'تعذر اعتماد طلب الحساب' });
  } finally {
    if (client) client.release();
  }
});

// النزاعات المفتوحة
router.get('/disputes', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT d.*, o.total_amount as order_total, u1.full_name as customer_name, u2.full_name as seller_name
      FROM disputes d
      JOIN orders o ON d.order_id = o.id
      JOIN users u1 ON d.customer_id = u1.id
      JOIN users u2 ON o.seller_id = u2.id
      WHERE d.status = 'open'
      ORDER BY d.created_at
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Admin dispute listing failed:', error);
    res.status(500).json({ error: 'تعذر جلب النزاعات' });
  }
});

// توثيق/إلغاء توثيق مستخدم
router.put('/users/:userId/verify', async (req, res) => {
  const userId = Number(req.params.userId);
  const { verified } = req.body || {};
  if (!Number.isSafeInteger(userId) || userId < 1) return res.status(400).json({ error: 'معرّف الحساب غير صحيح' });
  if (typeof verified !== 'boolean') return res.status(400).json({ error: 'قيمة التوثيق غير صحيحة' });

  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    const selected = await client.query(
      "SELECT id, role, id_image, selfie_image FROM users WHERE id = $1 AND role IN ('seller', 'driver') FOR UPDATE",
      [userId]
    );
    if (!selected.rowCount) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'حساب البائع أو المندوب غير موجود' });
    }

    if (verified) {
      const user = selected.rows[0];
      let documentsValid = false;
      try {
        documentsValid = Boolean(user.id_image && user.selfie_image
          && isAllowedImageDataUrl(decryptIdentity(user.id_image))
          && isAllowedImageDataUrl(decryptIdentity(user.selfie_image)));
      } catch (error) {
        console.error('Identity validation failed during manual verification for user:', userId, error);
      }
      if (!documentsValid) {
        await client.query('ROLLBACK');
        return res.status(422).json({ error: 'لا يمكن توثيق الحساب دون مستندات هوية سليمة' });
      }
    }

    const result = await client.query(
      "UPDATE users SET verified = $1 WHERE id = $2 AND role IN ('seller', 'driver') RETURNING id, role, verified",
      [verified, userId]
    );
    await client.query('COMMIT');
    return res.json({ success: true, user: result.rows[0] });
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    console.error('User verification update failed:', error);
    return res.status(500).json({ error: 'تعذر تحديث حالة التوثيق' });
  } finally {
    if (client) client.release();
  }
});

// حل نزاع
router.put('/disputes/:disputeId/resolve', async (req, res) => {
  const disputeId = Number(req.params.disputeId);
  const { resolution } = req.body || {};
  if (!Number.isSafeInteger(disputeId) || disputeId < 1) return res.status(400).json({ error: 'معرّف النزاع غير صحيح' });
  if (!['refund', 'dismiss'].includes(resolution)) return res.status(400).json({ error: 'قرار النزاع غير صحيح' });

  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    const dispute = await client.query(
      "SELECT id, order_id, order_status_before_dispute FROM disputes WHERE id = $1 AND status = 'open' FOR UPDATE",
      [disputeId]
    );
    if (!dispute.rowCount) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'النزاع غير موجود أو تمت معالجته مسبقًا' });
    }

    const orderId = Number(dispute.rows[0].order_id);
    // Lock and verify the associated order too, so dispute resolution cannot
    // overwrite an order that has changed outside the dispute workflow.
    const order = await client.query('SELECT id, status FROM orders WHERE id = $1 FOR UPDATE', [orderId]);
    if (!order.rowCount || order.rows[0].status !== 'disputed') {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'حالة الطلب تغيرت؛ راجع الطلب قبل حل النزاع' });
    }

    if (resolution === 'refund') {
      // Do not label an order refunded until a real payment provider/wallet
      // integration can execute and verify the money movement.
      await client.query('ROLLBACK');
      return res.status(501).json({
        error: 'الاسترداد المالي غير مفعّل بعد؛ لم يتم تغيير حالة الطلب أو تحويل أي أموال'
      });
    } else {
      const previousStatus = dispute.rows[0].order_status_before_dispute;
      if (!['pending', 'ready_for_pickup', 'in_delivery', 'delivered'].includes(previousStatus)) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'حالة الطلب السابقة غير صالحة للاستعادة' });
      }
      const restored = await client.query(
        'UPDATE orders SET status = $1 WHERE id = $2 AND status = $3 RETURNING id',
        [previousStatus, orderId, 'disputed']
      );
      if (restored.rowCount !== 1) throw new Error('Order state changed while dismissing dispute');
    }

    const resolved = await client.query(
      "UPDATE disputes SET status = 'resolved', resolution = $1 WHERE id = $2 AND status = 'open' RETURNING id",
      [resolution, disputeId]
    );
    if (resolved.rowCount !== 1) throw new Error('Dispute state changed while resolving');
    await client.query('COMMIT');
    return res.json({ success: true });
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    console.error('Dispute resolution failed:', error);
    return res.status(500).json({ error: 'تعذر معالجة النزاع' });
  } finally {
    if (client) client.release();
  }
});

module.exports = router;