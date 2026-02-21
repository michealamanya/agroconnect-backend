const { db, admin } = require('../config/firebase');

const notificationsCollection = db.collection('notifications');

// Get user's notifications
const getNotifications = async (req, res) => {
  try {
    const { limit = 30, unreadOnly } = req.query;

    let query = notificationsCollection
      .where('userId', '==', req.user.uid)
      .orderBy('createdAt', 'desc')
      .limit(parseInt(limit));

    if (unreadOnly === 'true') {
      query = notificationsCollection
        .where('userId', '==', req.user.uid)
        .where('isRead', '==', false)
        .orderBy('createdAt', 'desc')
        .limit(parseInt(limit));
    }

    const snapshot = await query.get();

    const notifications = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.()?.toISOString(),
    }));

    res.json({ notifications, count: notifications.length });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
};

// Get unread count
const getUnreadCount = async (req, res) => {
  try {
    const snapshot = await notificationsCollection
      .where('userId', '==', req.user.uid)
      .where('isRead', '==', false)
      .count()
      .get();

    res.json({ unreadCount: snapshot.data().count });
  } catch (error) {
    console.error('Unread count error:', error);
    res.status(500).json({ error: 'Failed to get unread count' });
  }
};

// Mark notification as read
const markAsRead = async (req, res) => {
  try {
    const doc = await notificationsCollection.doc(req.params.id).get();
    if (!doc.exists) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    if (doc.data().userId !== req.user.uid) {
      return res.status(403).json({ error: 'Not your notification' });
    }

    await notificationsCollection.doc(req.params.id).update({ isRead: true });
    res.json({ message: 'Notification marked as read' });
  } catch (error) {
    console.error('Mark as read error:', error);
    res.status(500).json({ error: 'Failed to mark as read' });
  }
};

// Mark all notifications as read
const markAllAsRead = async (req, res) => {
  try {
    const snapshot = await notificationsCollection
      .where('userId', '==', req.user.uid)
      .where('isRead', '==', false)
      .get();

    const batch = db.batch();
    snapshot.docs.forEach((doc) => {
      batch.update(doc.ref, { isRead: true });
    });

    await batch.commit();
    res.json({ message: `Marked ${snapshot.size} notifications as read` });
  } catch (error) {
    console.error('Mark all as read error:', error);
    res.status(500).json({ error: 'Failed to mark all as read' });
  }
};

// Delete a notification
const deleteNotification = async (req, res) => {
  try {
    const doc = await notificationsCollection.doc(req.params.id).get();
    if (!doc.exists) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    if (doc.data().userId !== req.user.uid) {
      return res.status(403).json({ error: 'Not your notification' });
    }

    await notificationsCollection.doc(req.params.id).delete();
    res.json({ message: 'Notification deleted' });
  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({ error: 'Failed to delete notification' });
  }
};

module.exports = {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
};
