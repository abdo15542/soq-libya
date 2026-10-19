const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const { Pool } = require('pg');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cron = require('node-cron');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5173').split(',').map(value => value.trim()).filter(Boolean);
const io = new Server(server, { cors: { origin: allowedOrigins, methods: ['GET', 'POST'] } });

// Middleware
app.use(helmet({
  contentSecurityPolicy: false, // لتجنب مشاكل CSP مع Leaflet
  crossOriginEmbedderPolicy: false
}));
app.use(cors({ origin(origin, callback) { if (!origin || allowedOrigins.includes(origin)) return callback(null, true); return callback(new Error('Origin not allowed by CORS')); } }));
app.use(express.json({ limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  message: 'طلبات كثيرة جداً، حاول مرة أخرى لاحقاً.'
});
app.use('/api/auth/google', rateLimit({ windowMs: 15 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false, message: { error: 'محاولات تسجيل كثيرة. انتظر قليلًا ثم حاول مجددًا.' } }));
app.use('/api/auth/verify', rateLimit({ windowMs: 60 * 60 * 1000, max: 5, standardHeaders: true, legacyHeaders: false, message: { error: 'تجاوزت عدد طلبات التوثيق المسموح. حاول بعد ساعة.' } }));
app.use('/api/', limiter);

// قاعدة البيانات
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// إنشاء الجداول
const createTables = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        phone VARCHAR(255) UNIQUE,
        google_sub VARCHAR(255) UNIQUE,
        email VARCHAR(320),
        full_name VARCHAR(100),
        id_image TEXT,
        selfie_image TEXT,
        role VARCHAR(20) CHECK (role IN ('customer', 'seller', 'driver', 'admin')),
        verified BOOLEAN DEFAULT FALSE,
        rating DECIMAL(3,2) DEFAULT 5.00,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        seller_id INTEGER REFERENCES users(id),
        name VARCHAR(255) NOT NULL,
        description TEXT,
        price DECIMAL(10,2) NOT NULL,
        images TEXT[],
        stock INTEGER DEFAULT 1,
        category VARCHAR(50),
        city VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        customer_id INTEGER REFERENCES users(id),
        seller_id INTEGER REFERENCES users(id),
        driver_id INTEGER REFERENCES users(id),
        product_id INTEGER REFERENCES products(id),
        status VARCHAR(30) DEFAULT 'pending',
        total_amount DECIMAL(10,2),
        delivery_fee DECIMAL(10,2),
        customer_address TEXT,
        paid_to_seller BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        delivered_at TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS chats (
        id SERIAL PRIMARY KEY,
        order_id INTEGER REFERENCES orders(id),
        sender_id INTEGER REFERENCES users(id),
        message TEXT,
        sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS ratings (
        id SERIAL PRIMARY KEY,
        order_id INTEGER REFERENCES orders(id),
        rater_id INTEGER REFERENCES users(id),
        rated_user_id INTEGER REFERENCES users(id),
        rating INTEGER CHECK (rating BETWEEN 1 AND 5),
        comment TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS disputes (
        id SERIAL PRIMARY KEY,
        order_id INTEGER REFERENCES orders(id),
        customer_id INTEGER REFERENCES users(id),
        reason TEXT,
        status VARCHAR(20) DEFAULT 'open',
        resolution TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        endpoint TEXT NOT NULL UNIQUE,
        p256dh TEXT NOT NULL,
        auth TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS driver_locations (
        driver_id INTEGER REFERENCES users(id) PRIMARY KEY,
        latitude DECIMAL(10,8),
        longitude DECIMAL(11,8),
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS payouts (
        id SERIAL PRIMARY KEY,
        seller_id INTEGER REFERENCES users(id),
        amount DECIMAL(10,2),
        status VARCHAR(20) DEFAULT 'pending',
        paid_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await pool.query('ALTER TABLE disputes ADD COLUMN IF NOT EXISTS order_status_before_dispute VARCHAR(30)');
    await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS id_image TEXT');
    await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS selfie_image TEXT');
    await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name VARCHAR(100)');
    await pool.query('ALTER TABLE users ALTER COLUMN phone TYPE VARCHAR(255)');
    await pool.query('ALTER TABLE users ALTER COLUMN phone DROP NOT NULL');
    await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS requested_role VARCHAR(20) CHECK (requested_role IN ('customer', 'seller', 'driver'))");
    await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS google_sub VARCHAR(255)');
    await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(320)');
    await pool.query('CREATE UNIQUE INDEX IF NOT EXISTS users_google_sub_unique ON users (google_sub) WHERE google_sub IS NOT NULL');
    await pool.query('CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique ON users (LOWER(email)) WHERE email IS NOT NULL');
    console.log('✅ تم إنشاء الجداول وتهيئة حقول الهوية');
  } catch (err) {
    console.error('❌ خطأ في إنشاء الجداول:', err);
    throw err;
  }
};

// Socket.IO authenticates with the same signed session as REST APIs.
io.use(async (socket, next) => {
  const token = socket.handshake.auth && socket.handshake.auth.token;
  if (typeof token !== 'string' || !token || !process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) return next(new Error('UNAUTHORIZED'));
  let claims;
  try { claims = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'], issuer: 'soq-libya-api', audience: 'soq-libya-client' }); } catch { return next(new Error('UNAUTHORIZED')); }
  const userId = Number(claims.sub);
  if (claims.typ !== 'access' || !Number.isSafeInteger(userId) || userId < 1) return next(new Error('UNAUTHORIZED'));
  try {
    const user = await pool.query('SELECT id, role FROM users WHERE id = $1', [userId]);
    if (!user.rowCount) return next(new Error('UNAUTHORIZED'));
    socket.data.userId = Number(user.rows[0].id);
    socket.data.userRole = user.rows[0].role || 'customer';
    return next();
  } catch (error) { console.error('Socket authentication failed:', error); return next(new Error('AUTH_UNAVAILABLE')); }
});

const canAccessOrder = async (userId, userRole, orderId) => {
  if (userRole === 'admin') return true;
  const result = await pool.query(
    'SELECT id FROM orders WHERE id = $1 AND (customer_id = $2 OR seller_id = $2 OR driver_id = $2)',
    [orderId, userId]
  );
  return result.rowCount > 0;
};

io.on('connection', (socket) => {
  socket.on('join-order-room', async (rawOrderId, acknowledge) => {
    const orderId = Number(rawOrderId);
    if (!Number.isSafeInteger(orderId) || orderId < 1) {
      if (typeof acknowledge === 'function') acknowledge({ success: false, error: 'INVALID_ORDER' });
      return;
    }
    try {
      if (!(await canAccessOrder(socket.data.userId, socket.data.userRole, orderId))) {
        if (typeof acknowledge === 'function') acknowledge({ success: false, error: 'FORBIDDEN' });
        return;
      }
      socket.join(`order-${orderId}`);
      if (typeof acknowledge === 'function') acknowledge({ success: true });
    } catch (error) {
      console.error('Socket room authorization failed:', error);
      if (typeof acknowledge === 'function') acknowledge({ success: false, error: 'SERVER_ERROR' });
    }
  });

  socket.on('send-message', async (data, acknowledge) => {
    const orderId = Number(data && data.orderId);
    const message = typeof (data && data.message) === 'string' ? data.message.trim() : '';
    if (!Number.isSafeInteger(orderId) || orderId < 1 || !message || message.length > 2000) {
      if (typeof acknowledge === 'function') acknowledge({ success: false, error: 'INVALID_MESSAGE' });
      return;
    }
    try {
      if (!(await canAccessOrder(socket.data.userId, socket.data.userRole, orderId))) {
        if (typeof acknowledge === 'function') acknowledge({ success: false, error: 'FORBIDDEN' });
        return;
      }
      const inserted = await pool.query(
        'INSERT INTO chats (order_id, sender_id, message) VALUES ($1, $2, $3) RETURNING id, sent_at',
        [orderId, socket.data.userId, message]
      );
      io.to(`order-${orderId}`).emit('new-message', {
        id: inserted.rows[0].id,
        order_id: orderId,
        sender_id: socket.data.userId,
        senderId: socket.data.userId,
        message,
        sent_at: inserted.rows[0].sent_at,
        sentAt: inserted.rows[0].sent_at
      });
      if (typeof acknowledge === 'function') acknowledge({ success: true });
    } catch (error) {
      console.error('Socket message send failed:', error);
      if (typeof acknowledge === 'function') acknowledge({ success: false, error: 'SERVER_ERROR' });
    }
  });
});

// استيراد المسارات
app.use('/api/auth', require('./routes/auth'));
app.use('/api/products', require('./routes/products'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/delivery', require('./routes/delivery'));
app.use('/api/chat', require('./routes/chat'));
app.use('/api/ratings', require('./routes/ratings'));
app.use('/api/disputes', require('./routes/disputes'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/location', require('./routes/location'));
app.use('/api/search', require('./routes/search'));

// معالجة الدفعات الأسبوعية (كل يوم أحد الساعة 12 صباحاً)
const { processWeeklyPayouts } = require('./utils/payouts');
cron.schedule('0 0 * * 0', () => {
  console.log('⏰ جاري معالجة الدفعات الأسبوعية...');
  processWeeklyPayouts();
});

const PORT = process.env.PORT || 5000;

// Do not accept traffic until the database schema is initialized successfully.
const startServer = async () => {
  try {
    await createTables();
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 السوق الليبي يعمل على المنفذ ${PORT}`);
    });
  } catch (error) {
    console.error('تعذر تشغيل الخادم لأن قاعدة البيانات غير جاهزة.');
    process.exitCode = 1;
    server.close(() => process.exit(1));
  }
};

startServer();
