const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const { checkAuth } = require('../middleware/auth');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false });

router.use(checkAuth);

// إنشاء طلب: الهوية من المستخدم المحمّل من قاعدة البيانات والسعر من المنتج.
router.post('/', async (req, res) => {
  const customerId = req.userId;
  const productId = Number(req.body.productId);
  const customerAddress = String(req.body.customerAddress || '').trim();
  // رسوم التوصيل لا تُقبل من العميل؛ تُحدد من إعداد الخادم حتى لا يستطيع التلاعب بالإجمالي.
  const configuredDeliveryFee = process.env.DELIVERY_FEE_LYD;
  const deliveryFee = configuredDeliveryFee === undefined ? NaN : Number(configuredDeliveryFee);

  if (!Number.isSafeInteger(productId) || productId < 1 ||
      !customerAddress || customerAddress.length > 1000) {
    return res.status(400).json({ error: 'بيانات الطلب غير صحيحة' });
  }
  if (!Number.isFinite(deliveryFee) || deliveryFee < 0 || deliveryFee > 1000) {
    console.error('DELIVERY_FEE_LYD must be configured to a number between 0 and 1000');
    return res.status(503).json({ error: 'خدمة إنشاء الطلبات غير مهيأة للتوصيل حاليًا' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const productResult = await client.query(
      'SELECT id, seller_id, price, stock FROM products WHERE id = $1 FOR UPDATE',
      [productId]
    );
    if (!productResult.rowCount) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'المنتج غير موجود' });
    }
    const product = productResult.rows[0];
    const price = Number(product.price);
    if (Number(product.seller_id) === Number(customerId)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'لا يمكنك شراء منتجك الخاص' });
    }
    if (!Number.isFinite(price) || price <= 0 || Number(product.stock) < 1) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'المنتج غير متوفر حاليًا' });
    }

    const totalAmount = Number((price + deliveryFee).toFixed(2));
    const inserted = await client.query(
      `INSERT INTO orders
        (customer_id, seller_id, product_id, total_amount, delivery_fee, customer_address, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending') RETURNING *`,
      [customerId, product.seller_id, productId, totalAmount, deliveryFee, customerAddress]
    );
    const stockUpdate = await client.query(
      'UPDATE products SET stock = stock - 1 WHERE id = $1 AND stock > 0',
      [productId]
    );
    if (stockUpdate.rowCount !== 1) throw new Error('Stock reservation failed');
    await client.query('COMMIT');
    return res.status(201).json({ success: true, order: inserted.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Create order failed:', error);
    return res.status(500).json({ error: 'تعذر إنشاء الطلب حاليًا' });
  } finally {
    client.release();
  }
});

// طلبات الزبون: لا يمكن قراءة طلبات مستخدم آخر عبر تغيير المسار.
router.get('/customer/:customerId', async (req, res) => {
  if (req.userRole !== 'admin' && Number(req.params.customerId) !== Number(req.userId)) {
    return res.status(403).json({ error: 'غير مصرح بعرض طلبات هذا الحساب' });
  }
  try {
    const result = await pool.query(`
      SELECT o.*, p.name as product_name, p.images as product_images,
             u.full_name as seller_name, d.full_name as driver_name
      FROM orders o
      JOIN products p ON o.product_id = p.id
      JOIN users u ON o.seller_id = u.id
      LEFT JOIN users d ON o.driver_id = d.id
      WHERE o.customer_id = $1
      ORDER BY o.created_at DESC
    `, [req.params.customerId]);
    return res.json(result.rows);
  } catch (error) {
    console.error('Customer orders lookup failed:', error);
    return res.status(500).json({ error: 'تعذر جلب الطلبات' });
  }
});

// طلبات البائع
router.get('/seller/:sellerId', async (req, res) => {
  if (req.userRole !== 'admin' &&
      (Number(req.params.sellerId) !== Number(req.userId) || req.userRole !== 'seller')) {
    return res.status(403).json({ error: 'غير مصرح بعرض طلبات هذا البائع' });
  }
  try {
    const result = await pool.query(`
      SELECT o.*, p.name as product_name, p.images as product_images,
             u.full_name as customer_name
      FROM orders o
      JOIN products p ON o.product_id = p.id
      JOIN users u ON o.customer_id = u.id
      WHERE o.seller_id = $1
      ORDER BY o.created_at DESC
    `, [req.params.sellerId]);
    return res.json(result.rows);
  } catch (error) {
    console.error('Seller orders lookup failed:', error);
    return res.status(500).json({ error: 'تعذر جلب الطلبات' });
  }
});

// حالات الطلب مسموحة حسب الدور وملكية الطلب.
router.put('/:orderId/status', async (req, res) => {
  const orderId = Number(req.params.orderId);
  const { status } = req.body;
  if (!Number.isSafeInteger(orderId) || orderId < 1) {
    return res.status(400).json({ error: 'رقم الطلب غير صحيح' });
  }
  const allowedStatuses = ['ready_for_pickup', 'in_delivery', 'delivered', 'cancelled'];
  if (!allowedStatuses.includes(status)) {
    return res.status(400).json({ error: 'حالة الطلب غير مسموحة' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query('SELECT * FROM orders WHERE id = $1 FOR UPDATE', [orderId]);
    if (!result.rowCount) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'الطلب غير موجود' });
    }
    const order = result.rows[0];
    const isAdmin = req.userRole === 'admin';
    const isSeller = req.userRole === 'seller' && Number(order.seller_id) === Number(req.userId);
    const isCustomer = req.userRole === 'customer' && Number(order.customer_id) === Number(req.userId);
    const isDriver = req.userRole === 'driver' && Number(order.driver_id) === Number(req.userId);

    let permitted = false;
    let nextDriverId = order.driver_id;
    if (status === 'ready_for_pickup' && (isSeller || isAdmin) && order.status === 'pending') permitted = true;
    if (status === 'in_delivery' && isAdmin && order.status === 'ready_for_pickup') permitted = true;
    if (status === 'delivered' && (isDriver || isAdmin) && order.status === 'in_delivery') permitted = true;
    if (status === 'cancelled' && (isCustomer || isAdmin) && ['pending', 'ready_for_pickup'].includes(order.status)) permitted = true;
    if (!permitted) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'لا تملك صلاحية تغيير حالة الطلب بهذه الطريقة' });
    }

    const updated = await client.query(
      `UPDATE orders SET status = $1,
       delivered_at = CASE WHEN $1 = 'delivered' THEN NOW() ELSE delivered_at END
       WHERE id = $2 RETURNING *`,
      [status, orderId]
    );

    // The product stock was reserved when the order was created; release it
    // exactly once when a permitted cancellation succeeds.
    if (status === 'cancelled') {
      const restored = await client.query(
        'UPDATE products SET stock = stock + 1 WHERE id = $1 RETURNING id',
        [order.product_id]
      );
      if (restored.rowCount !== 1) throw new Error('Could not restore product stock after cancellation');
    }
    await client.query('COMMIT');
    return res.json({ success: true, order: updated.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Order status update failed:', error);
    return res.status(500).json({ error: 'تعذر تحديث حالة الطلب' });
  } finally {
    client.release();
  }
});

module.exports = router;
