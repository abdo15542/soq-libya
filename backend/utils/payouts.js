const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false });

async function processWeeklyPayouts() {
  try {
    const orders = await pool.query(`
      SELECT o.id, o.seller_id, o.total_amount, u.full_name 
      FROM orders o
      JOIN users u ON o.seller_id = u.id
      WHERE o.status = 'delivered' AND o.paid_to_seller = FALSE
    `);

    const sellerBalances = {};
    orders.rows.forEach(order => {
      const sellerId = order.seller_id;
      const amount = order.total_amount * 0.90; // عمولة 10%
      if (!sellerBalances[sellerId]) sellerBalances[sellerId] = 0;
      sellerBalances[sellerId] += parseFloat(amount);
    });

    for (const [sellerId, amount] of Object.entries(sellerBalances)) {
      await pool.query(
        'INSERT INTO payouts (seller_id, amount, status) VALUES ($1, $2, $3)',
        [sellerId, amount, 'pending']
      );
    }

    await pool.query(
      'UPDATE orders SET paid_to_seller = TRUE WHERE status = $1 AND paid_to_seller = FALSE',
      ['delivered']
    );

    console.log(`✅ تم إنشاء دفعات لـ ${Object.keys(sellerBalances).length} بائع`);
  } catch (error) {
    console.error('❌ خطأ في معالجة الدفعات:', error);
  }
}

module.exports = { processWeeklyPayouts };