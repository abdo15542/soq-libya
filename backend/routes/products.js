const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const { checkAuth } = require('../middleware/auth');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false });

// الحصول على جميع المنتجات
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT p.*, u.full_name as seller_name, u.rating as seller_rating 
      FROM products p 
      JOIN users u ON p.seller_id = u.id 
      WHERE p.stock > 0
      ORDER BY p.created_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// الحصول على منتج واحد
router.get('/:productId', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT p.*, u.full_name as seller_name, u.rating as seller_rating, u.id as seller_id
      FROM products p 
      JOIN users u ON p.seller_id = u.id 
      WHERE p.id = $1
    `, [req.params.productId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'المنتج غير موجود' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// إضافة منتج جديد
router.post('/', checkAuth, async (req, res) => {
  const { sellerId, name, description, price, images, stock, category, city } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO products (seller_id, name, description, price, images, stock, category, city) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [sellerId, name, description, price, images, stock, category, city]
    );
    res.json({ success: true, product: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// تحديث منتج
router.put('/:productId', checkAuth, async (req, res) => {
  const { name, description, price, images, stock, category, city } = req.body;
  const productId = req.params.productId;
  const userId = req.userId;

  try {
    const productCheck = await pool.query('SELECT seller_id FROM products WHERE id = $1', [productId]);
    if (productCheck.rows.length === 0) return res.status(404).json({ error: 'المنتج غير موجود' });
    if (productCheck.rows[0].seller_id != userId) return res.status(403).json({ error: 'غير مصرح' });

    await pool.query(
      `UPDATE products SET 
        name = COALESCE($1, name),
        description = COALESCE($2, description),
        price = COALESCE($3, price),
        images = COALESCE($4, images),
        stock = COALESCE($5, stock),
        category = COALESCE($6, category),
        city = COALESCE($7, city)
       WHERE id = $8`,
      [name, description, price, images, stock, category, city, productId]
    );
    res.json({ success: true, message: 'تم تحديث المنتج' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// حذف منتج (إخفاء)
router.delete('/:productId', checkAuth, async (req, res) => {
  const productId = req.params.productId;
  const userId = req.userId;

  try {
    const productCheck = await pool.query('SELECT seller_id FROM products WHERE id = $1', [productId]);
    if (productCheck.rows.length === 0) return res.status(404).json({ error: 'المنتج غير موجود' });
    if (productCheck.rows[0].seller_id != userId) return res.status(403).json({ error: 'غير مصرح' });

    await pool.query('UPDATE products SET stock = 0 WHERE id = $1', [productId]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// منتجات بائع معين
router.get('/seller/:sellerId', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM products WHERE seller_id = $1 ORDER BY created_at DESC',
      [req.params.sellerId]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;