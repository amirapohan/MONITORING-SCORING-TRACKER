const { publishMessage } = require('./rabbitmq');

const notificationService = {
  async sendBidStatusUpdate(userId, status, projectTitle) {
    try {
      const queueName = 'notification_queue';
      const payload = {
        notification_type: 'BID_STATUS_UPDATE',
        recipient_id: userId,
        status: status,
        project_title: projectTitle,
        timestamp: new Date().toISOString()
      };

      const success = await publishMessage(queueName, payload);
      if (success) return { success: true };
      throw new Error('Failed to publish message');
    } catch (error) {
      console.warn('Notification service unavailable:', error.message);
      return { success: false, error: error.message };
    }
  },

  async sendDealConfirmed(userId, projectTitle) {
    try {
      const queueName = 'notification_queue';
      const payload = {
        notification_type: 'DEAL_CONFIRMED',
        recipient_id: userId,
        project_title: projectTitle,
        timestamp: new Date().toISOString()
      };

      const success = await publishMessage(queueName, payload);
      if (success) return { success: true };
      throw new Error('Failed to publish message');
    } catch (error) {
      console.warn('Notification service unavailable:', error.message);
      return { success: false, error: error.message };
    }
  },

  async sendCounterOfferNotification(userId, projectTitle, counterOffer) {
    try {
      const queueName = 'notification_queue';
      const payload = {
        notification_type: 'COUNTER_OFFER',
        recipient_id: userId,
        project_title: projectTitle,
        counter_offer_details: counterOffer,
        timestamp: new Date().toISOString()
      };

      const success = await publishMessage(queueName, payload);
      if (success) return { success: true };
      throw new Error('Failed to publish message');
    } catch (error) {
      console.warn('Notification service unavailable:', error.message);
      return { success: false, error: error.message };
    }
  }
};

module.exports = notificationService;