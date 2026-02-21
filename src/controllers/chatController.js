const { db, admin } = require('../config/firebase');

const chatRoomsCollection = db.collection('chatRooms');
const usersCollection = db.collection('users');

// Get or create a chat room between two users
const getOrCreateChatRoom = async (req, res) => {
  try {
    const { otherUserId, produceId, produceName } = req.body;
    const currentUserId = req.user.uid;

    if (!otherUserId) {
      return res.status(400).json({ error: 'otherUserId is required' });
    }

    if (currentUserId === otherUserId) {
      return res.status(400).json({ error: 'Cannot create chat with yourself' });
    }

    // Check if chat room already exists
    const existingRooms = await chatRoomsCollection
      .where('participantIds', 'array-contains', currentUserId)
      .get();

    for (const doc of existingRooms.docs) {
      const participants = doc.data().participantIds || [];
      if (participants.includes(otherUserId)) {
        return res.json({ chatRoomId: doc.id, ...doc.data() });
      }
    }

    // Get both user names
    const [currentUserDoc, otherUserDoc] = await Promise.all([
      usersCollection.doc(currentUserId).get(),
      usersCollection.doc(otherUserId).get(),
    ]);

    if (!otherUserDoc.exists) {
      return res.status(404).json({ error: 'Other user not found' });
    }

    const currentUserName = currentUserDoc.data()?.name || 'Unknown';
    const otherUserName = otherUserDoc.data()?.name || 'Unknown';

    // Create new chat room
    const chatRoomData = {
      participantIds: [currentUserId, otherUserId],
      participantNames: {
        [currentUserId]: currentUserName,
        [otherUserId]: otherUserName,
      },
      lastMessage: null,
      lastMessageTime: null,
      produceId: produceId || null,
      produceName: produceName || null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    const docRef = await chatRoomsCollection.add(chatRoomData);
    res.status(201).json({ chatRoomId: docRef.id, ...chatRoomData });
  } catch (error) {
    console.error('Get/create chat room error:', error);
    res.status(500).json({ error: 'Failed to get or create chat room' });
  }
};

// Get user's chat rooms
const getMyChatRooms = async (req, res) => {
  try {
    const snapshot = await chatRoomsCollection
      .where('participantIds', 'array-contains', req.user.uid)
      .orderBy('lastMessageTime', 'desc')
      .get();

    const chatRooms = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      lastMessageTime: doc.data().lastMessageTime?.toDate?.()?.toISOString(),
      createdAt: doc.data().createdAt?.toDate?.()?.toISOString(),
    }));

    res.json({ chatRooms });
  } catch (error) {
    console.error('Get chat rooms error:', error);
    res.status(500).json({ error: 'Failed to fetch chat rooms' });
  }
};

// Send a message
const sendMessage = async (req, res) => {
  try {
    const { chatRoomId, text } = req.body;

    if (!chatRoomId || !text) {
      return res.status(400).json({ error: 'chatRoomId and text are required' });
    }

    // Verify user is participant
    const chatRoom = await chatRoomsCollection.doc(chatRoomId).get();
    if (!chatRoom.exists) {
      return res.status(404).json({ error: 'Chat room not found' });
    }

    const participants = chatRoom.data().participantIds || [];
    if (!participants.includes(req.user.uid)) {
      return res.status(403).json({ error: 'You are not a participant in this chat' });
    }

    // Add the message
    const messageData = {
      senderId: req.user.uid,
      text,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      isRead: false,
    };

    const msgRef = await chatRoomsCollection
      .doc(chatRoomId)
      .collection('messages')
      .add(messageData);

    // Update chat room last message
    await chatRoomsCollection.doc(chatRoomId).update({
      lastMessage: text,
      lastMessageTime: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Create notification for the other participant
    const otherUserId = participants.find((id) => id !== req.user.uid);
    if (otherUserId) {
      const senderDoc = await usersCollection.doc(req.user.uid).get();
      const senderName = senderDoc.data()?.name || 'Someone';

      await db.collection('notifications').add({
        userId: otherUserId,
        title: `New message from ${senderName}`,
        body: text.length > 100 ? text.substring(0, 100) + '...' : text,
        isRead: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    res.status(201).json({ messageId: msgRef.id, ...messageData });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
};

// Get messages for a chat room
const getMessages = async (req, res) => {
  try {
    const { chatRoomId } = req.params;
    const { limit = 50, before } = req.query;

    // Verify user is participant
    const chatRoom = await chatRoomsCollection.doc(chatRoomId).get();
    if (!chatRoom.exists) {
      return res.status(404).json({ error: 'Chat room not found' });
    }

    const participants = chatRoom.data().participantIds || [];
    if (!participants.includes(req.user.uid)) {
      return res.status(403).json({ error: 'You are not a participant in this chat' });
    }

    let query = chatRoomsCollection
      .doc(chatRoomId)
      .collection('messages')
      .orderBy('timestamp', 'desc')
      .limit(parseInt(limit));

    if (before) {
      const beforeDoc = await chatRoomsCollection
        .doc(chatRoomId)
        .collection('messages')
        .doc(before)
        .get();
      if (beforeDoc.exists) {
        query = query.startAfter(beforeDoc);
      }
    }

    const snapshot = await query.get();

    const messages = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      timestamp: doc.data().timestamp?.toDate?.()?.toISOString(),
    })).reverse(); // Reverse to get chronological order

    res.json({ messages });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
};

// Mark messages as read
const markAsRead = async (req, res) => {
  try {
    const { chatRoomId } = req.params;

    const unreadSnapshot = await chatRoomsCollection
      .doc(chatRoomId)
      .collection('messages')
      .where('isRead', '==', false)
      .where('senderId', '!=', req.user.uid)
      .get();

    const batch = db.batch();
    unreadSnapshot.docs.forEach((doc) => {
      batch.update(doc.ref, { isRead: true });
    });

    await batch.commit();
    res.json({ message: `Marked ${unreadSnapshot.size} messages as read` });
  } catch (error) {
    console.error('Mark as read error:', error);
    res.status(500).json({ error: 'Failed to mark messages as read' });
  }
};

module.exports = {
  getOrCreateChatRoom,
  getMyChatRooms,
  sendMessage,
  getMessages,
  markAsRead,
};
