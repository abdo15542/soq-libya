const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false });

router.get('/', async (req, res) => {
  const { q, minPrice, maxPrice, city, category, sort } = req.query;
  
  let query = `
    SELECT p.*, u.full_name as seller_name, u.rating as seller_rating
    FROM products p
    JOIN users u ON p.seller_id = u.id
    WHERE p.stock > 0
  `;
  const params = [];
  let paramIndex = 1;

  if (q) {
    query += ` AND (p.name ILIKE $${paramIndex} OR p.description ILIKE $${paramIndex})`;
    params.push(`%${q}%`);
    paramIndex++;
  }
  if (minPrice) {
    query += ` AND p.price >= $${paramIndex}`;
    params.push(minPrice);
    paramIndex++;
  }
  if (maxPrice) {
    query += ` AND p.price <= $${paramIndex}`;
    params.push(maxPrice);
    paramIndex++;
  }
  if (city) {
    query += ` AND p.city = $${paramIndex}`;
    params.push(city);
    paramIndex++;
  }
  if (category) {
    query += ` AND p.category = $${paramIndex}`;
    params.push(category);
    paramIndex++;
  }

  if (sort === 'price_asc') query += ' ORDER BY p.price ASC';
  else if (sort === 'price_desc') query += ' ORDER BY p.price DESC';
  else if (sort === 'newest') query += ' ORDER BY p.created_at DESC';
  else query += ' ORDER BY p.created_at DESC';

  try {
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;