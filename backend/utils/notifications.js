const webpush = require('web-push');

webpush.setVapidDetails(
  'mailto:support@soq-libya.com',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

const sendNotification = async (subscription, payload) => {
  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload));
  } catch (error) {
    console.error('فشل إرسال الإشعار:', error);
  }
};

module.exports = { sendNotification };