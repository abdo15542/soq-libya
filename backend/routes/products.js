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
    console.error('Product query failed:', error);
    res.status(500).json({ error: 'تعذر إكمال طلب المنتجات حاليًا' });
  }
});

// الحصول على منتج واحد
router.get('/:productId', async (req, res) => {
  const productId = Number(req.params.productId);
  if (!Number.isSafeInteger(productId) || productId < 1) return res.status(400).json({ error: 'رقم المنتج غير صحيح' });
  try {
    const result = await pool.query(`
      SELECT p.*, u.full_name as seller_name, u.rating as seller_rating, u.id as seller_id
      FROM products p 
      JOIN users u ON p.seller_id = u.id 
      WHERE p.id = $1
    `, [productId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'المنتج غير موجود' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Product operation failed:', error);
    res.status(500).json({ error: 'تعذر إكمال طلب المنتج حاليًا' });
  }
});

// إضافة منتج جديد
router.post('/', checkAuth, async (req, res) => {
  const { name, description, price, images, stock, category, city } = req.body;
  if (req.userRole !== 'seller' && req.userRole !== 'admin') return res.status(403).json({ error: 'حساب البائع مطلوب لإضافة المنتجات' });
  const cleanName = typeof name === 'string' ? name.trim() : '';
  const numericPrice = Number(price);
  const numericStock = Number(stock ?? 1);
  if (!cleanName || cleanName.length > 255 || !Number.isFinite(numericPrice) || numericPrice <= 0 || numericPrice > 100000000 || !Number.isInteger(numericStock) || numericStock < 0 || numericStock > 1000000 || (images != null && (!Array.isArray(images) || images.length > 10))) return res.status(400).json({ error: 'بيانات المنتج غير صحيحة' });
  try {
    const result = await pool.query(
      `INSERT INTO products (seller_id, name, description, price, images, stock, category, city) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [req.userId, cleanName, typeof description === 'string' ? description.slice(0, 5000) : '', numericPrice, Array.isArray(images) ? images : [], numericStock, typeof category === 'string' ? category.slice(0, 50) : null, typeof city === 'string' ? city.slice(0, 50) : null]
    );
    res.json({ success: true, product: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// تحديث منتج
router.put('/:productId', checkAuth, async (req, res) => {
  const { name, description, price, images, stock, category, city } = req.body;
  const productId = Number(req.params.productId);
  const userId = req.userId;
  if (!Number.isSafeInteger(productId) || productId < 1) return res.status(400).json({ error: 'رقم المنتج غير صحيح' });
  if (req.userRole !== 'seller' && req.userRole !== 'admin') return res.status(403).json({ error: 'صلاحية البائع مطلوبة' });

  try {
    const productCheck = await pool.query('SELECT seller_id FROM products WHERE id = $1', [productId]);
    if (productCheck.rows.length === 0) return res.status(404).json({ error: 'المنتج غير موجود' });
    if (req.userRole !== 'admin' && Number(productCheck.rows[0].seller_id) !== Number(userId)) return res.status(403).json({ error: 'غير مصرح' });

    const cleanName = name === undefined ? null : (typeof name === 'string' ? name.trim() : '');
    const cleanDescription = description === undefined ? null : (typeof description === 'string' ? description.slice(0, 5000) : '');
    const numericPrice = price === undefined ? null : Number(price);
    const numericStock = stock === undefined ? null : Number(stock);
    const cleanImages = images === undefined ? null : images;
    const cleanCategory = category === undefined ? null : (typeof category === 'string' ? category.slice(0, 50) : null);
    const cleanCity = city === undefined ? null : (typeof city === 'string' ? city.slice(0, 50) : null);
    if ((cleanName !== null && (!cleanName || cleanName.length > 255)) ||
        (numericPrice !== null && (!Number.isFinite(numericPrice) || numericPrice <= 0 || numericPrice > 100000000)) ||
        (numericStock !== null && (!Number.isInteger(numericStock) || numericStock < 0 || numericStock > 1000000)) ||
        (cleanImages !== null && (!Array.isArray(cleanImages) || cleanImages.length > 10 || cleanImages.some((image) => typeof image !== 'string' || image.length > 2000)))) {
      return res.status(400).json({ error: 'بيانات المنتج غير صحيحة' });
    }
    const updated = await pool.query(
      `UPDATE products SET
        name = COALESCE($1, name),
        description = COALESCE($2, description),
        price = COALESCE($3, price),
        images = COALESCE($4, images),
        stock = COALESCE($5, stock),
        category = COALESCE($6, category),
        city = COALESCE($7, city)
       WHERE id = $8 RETURNING *`,
      [cleanName, cleanDescription, numericPrice, cleanImages, numericStock, cleanCategory, cleanCity, productId]
    );
    return res.json({ success: true, product: updated.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// حذف منتج (إخفاء)
router.delete('/:productId', checkAuth, async (req, res) => {
  const productId = Number(req.params.productId);
  const userId = req.userId;
  if (!Number.isSafeInteger(productId) || productId < 1) return res.status(400).json({ error: 'رقم المنتج غير صحيح' });

  try {
    const productCheck = await pool.query('SELECT seller_id FROM products WHERE id = $1', [productId]);
    if (productCheck.rows.length === 0) return res.status(404).json({ error: 'المنتج غير موجود' });
    if (req.userRole !== 'admin' && Number(productCheck.rows[0].seller_id) !== Number(userId)) return res.status(403).json({ error: 'غير مصرح' });

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