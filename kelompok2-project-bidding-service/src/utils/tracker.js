const { publishMessage } = require('./rabbitmq');

const sendDealToTracker = async (dealData) => {
  try {
    // Tentukan nama antrean untuk Kelompok 4
    const queueName = 'tracker_deals_queue';
    
    // Titipkan data deal ke antrean RabbitMQ
    const success = await publishMessage(queueName, dealData);
    
    if (success) {
      console.log('[TRACKER INTEGRATION] Deal queued in RabbitMQ successfully');
      return { success: true, message: 'Deal queued successfully' };
    } else {
      throw new Error('Failed to publish message to queue');
    }
  } catch (error) {
    console.warn('[TRACKER INTEGRATION] Warning - Failed to queue deal:', error.message);
    return { success: false, error: error.message };
  }
};

module.exports = { sendDealToTracker };