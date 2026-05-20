const { publishEvent } = require('./rabbitmq');

const notificationService = {
  async sendBidStatusUpdate(userId, status, projectTitle) {
    try {
      const payload = {
        user_id: userId,
        status: status,
        project_title: projectTitle,
        notification_type: 'BID_STATUS_UPDATE'
      };

      const success = await publishEvent('bid_status_updated', payload);
      if (success) return { success: true };
      throw new Error('Failed to publish message');
    } catch (error) {
      console.warn('Notification service unavailable:', error.message);
      return { success: false, error: error.message };
    }
  },

  async sendDealConfirmed(userId, projectTitle) {
    try {
      const payload = {
        user_id: userId,
        status: 'ACCEPTED',
        project_title: projectTitle,
        notification_type: 'DEAL_CONFIRMED'
      };

      const success = await publishEvent('bid_deal_confirmed', payload);
      if (success) return { success: true };
      throw new Error('Failed to publish message');
    } catch (error) {
      console.warn('Notification service unavailable:', error.message);
      return { success: false, error: error.message };
    }
  },

  async sendCounterOfferNotification(userId, projectTitle, counterOffer) {
    try {
      const payload = {
        user_id: userId,
        status: 'COUNTERED',
        project_title: projectTitle,
        counter_offer_details: counterOffer,
        notification_type: 'COUNTER_OFFER'
      };

      const success = await publishEvent('bid_counter_offered', payload);
      if (success) return { success: true };
      throw new Error('Failed to publish message');
    } catch (error) {
      console.warn('Notification service unavailable:', error.message);
      return { success: false, error: error.message };
    }
  }
};

module.exports = notificationService;
