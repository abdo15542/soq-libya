const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const { checkAuth } = require('../middleware/auth');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

router.use(checkAuth);

const validId = (value) => Number.isSafeInteger(Number(value)) && Number(value) > 0;
const validCoordinate = (value, min, max) =>
  value !== undefined && value !== null && value !== '' &&
  Number.isFinite(Number(value)) && Number(value) >= min && Number(value) <= max;

// Update a driver's own location only. Client-supplied driver IDs are never trusted.
router.post('/driver', async (req, res) => {
  const latitude = Number(req.body.latitude);
  const longitude = Number(req.body.longitude);

  if (req.userRole !== 'driver' && req.userRole !== 'admin') {
    return res.status(403).json({ error: 'تحديث الموقع متاح للمندوبين فقط' });
  }
  if (!validCoordinate(req.body.latitude, -90, 90) ||
      !validCoordinate(req.body.longitude, -180, 180)) {
    return res.status(400).json({ error: 'إحداثيات الموقع غير صحيحة' });
  }

  try {
    await pool.query(
      `INSERT INTO driver_locations (driver_id, latitude, longitude, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (driver_id) DO UPDATE SET
         latitude = EXCLUDED.latitude,
         longitude = EXCLUDED.longitude,
         updated_at = NOW()`,
      [req.userId, latitude, longitude]
    );
    return res.json({ success: true });
  } catch (error) {
    console.error('Driver location update failed:', error);
    return res.status(500).json({ error: 'تعذر تحديث الموقع حاليًا' });
  }
});

// A driver location is visible only to participants of an order assigned to that driver.
router.get('/driver/:driverId', async (req, res) => {
  if (!validId(req.params.driverId)) {
    return res.status(400).json({ error: 'رقم المندوب غير صحيح' });
  }
  const driverId = Number(req.params.driverId);

  try {
    const access = await pool.query(
      `SELECT id FROM orders
       WHERE driver_id = $1
         AND status NOT IN ('cancelled', 'refunded')
         AND ($2 = customer_id OR $2 = seller_id OR $2 = driver_id)
       LIMIT 1`,
      [driverId, req.userId]
    );
    if (req.userRole !== 'admin' && !access.rowCount) {
      return res.status(403).json({ error: 'موقع المندوب متاح لأطراف الطلب المخصص فقط' });
    }

    const result = await pool.query(
      'SELECT latitude, longitude, updated_at FROM driver_locations WHERE driver_id = $1',
      [driverId]
    );
    return res.json(result.rows[0] || null);
  } catch (error) {
    console.error('Driver location lookup failed:', error);
    return res.status(500).json({ error: 'تعذر جلب الموقع حاليًا' });
  }
});

module.exports = router;
