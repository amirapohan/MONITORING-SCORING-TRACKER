const { publishEvent } = require('./rabbitmq');

const sendDealToTracker = async (dealData) => {
  try {
    const success = await publishEvent('bid_deal_confirmed', dealData);
    
    if (success) {
      console.log('[TRACKER INTEGRATION] Deal event published successfully');
      return { success: true, message: 'Deal event published successfully' };
    } else {
      throw new Error('Failed to publish deal event');
    }
  } catch (error) {
    console.warn('[TRACKER INTEGRATION] Warning - Failed to publish deal:', error.message);
    return { success: false, error: error.message };
  }
};

module.exports = { sendDealToTracker };
