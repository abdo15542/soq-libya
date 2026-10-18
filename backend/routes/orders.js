const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false });

// إنشاء طلب جديد: السعر والبائع يُؤخذان من قاعدة البيانات وليس من بيانات العميل
router.post('/', async (req, res) => {
  const customerId = Number(req.body.customerId);
  const productId = Number(req.body.productId);
  const customerAddress = String(req.body.customerAddress || '').trim();
  const deliveryFee = Number(req.body.deliveryFee ?? 0);

  if (!Number.isInteger(customerId) || customerId < 1 ||
      !Number.isInteger(productId) || productId < 1 ||
      !customerAddress || customerAddress.length > 1000 ||
      !Number.isFinite(deliveryFee) || deliveryFee < 0 || deliveryFee > 1000) {
    return res.status(400).json({ error: 'بيانات الطلب غير صحيحة' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const customer = await client.query(
      'SELECT id FROM users WHERE id = $1',
      [customerId]
    );
    if (!customer.rowCount) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'حساب الزبون غير موجود' });
    }

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
    if (!Number.isFinite(price) || price <= 0 || Number(product.stock) < 1) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'المنتج غير متوفر حاليًا' });
    }

    const totalAmount = Number((price + deliveryFee).toFixed(2));
    const result = await client.query(
      `INSERT INTO orders
        (customer_id, seller_id, product_id, total_amount, delivery_fee, customer_address, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending')
       RETURNING *`,
      [customerId, product.seller_id, productId, totalAmount, deliveryFee, customerAddress]
    );

    // حجز وحدة واحدة لمنع تجاوز المخزون في الطلبات المتزامنة
    await client.query(
      'UPDATE products SET stock = stock - 1 WHERE id = $1 AND stock > 0',
      [productId]
    );

    await client.query('COMMIT');
    return res.status(201).json({ success: true, order: result.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Create order failed:', error);
    return res.status(500).json({ error: 'تعذر إنشاء الطلب حاليًا' });
  } finally {
    client.release();
  }
});

// طلبات الزبون
router.get('/customer/:customerId', async (req, res) => {
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
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// طلبات البائع
router.get('/seller/:sellerId', async (req, res) => {
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
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// تحديث حالة الطلب
router.put('/:orderId/status', async (req, res) => {
  const { status, driverId } = req.body;
  try {
    if (status === 'ready_for_pickup') {
      await pool.query('UPDATE orders SET status = $1 WHERE id = $2', [status, req.params.orderId]);
    } else if (status === 'in_delivery') {
      await pool.query('UPDATE orders SET status = $1, driver_id = $2 WHERE id = $3', [status, driverId, req.params.orderId]);
    } else if (status === 'delivered') {
      await pool.query('UPDATE orders SET status = $1, delivered_at = NOW() WHERE id = $2', [status, req.params.orderId]);
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;