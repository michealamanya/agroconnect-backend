const { db, admin, storage } = require('../config/firebase');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const Image = require('../models/Image');
const { isMongoConnected } = require('../config/mongodb');

const produceCollection = db.collection('produce');
const usersCollection = db.collection('users');

// Create new produce
const createProduce = async (req, res) => {
  try {
    const {
      name,
      description,
      category,
      price,
      unit,
      quantity,
      status,
      location,
      expectedReadyDate,
      imageUrls,
    } = req.body;

    // Get farmer info
    const farmerDoc = await usersCollection.doc(req.user.uid).get();
    if (!farmerDoc.exists) {
      return res.status(404).json({ error: 'Farmer profile not found' });
    }
    const farmerData = farmerDoc.data();

    if (farmerData.role !== 'farmer') {
      return res.status(403).json({ error: 'Only farmers can add produce' });
    }

    const produceData = {
      farmerId: req.user.uid,
      farmerName: farmerData.name,
      name,
      description,
      category,
      price: parseFloat(price),
      unit,
      quantity: parseFloat(quantity),
      status: status || 'ready',
      imageUrls: imageUrls || [],
      location: location || farmerData.location || null,
      expectedReadyDate: expectedReadyDate
        ? admin.firestore.Timestamp.fromDate(new Date(expectedReadyDate))
        : null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    const docRef = await produceCollection.add(produceData);

    // Notify buyers subscribed to new produce
    await _notifyNewProduce(docRef.id, name, category, farmerData.name);

    res.status(201).json({
      id: docRef.id,
      ...produceData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Create produce error:', error);
    res.status(500).json({ error: 'Failed to create produce' });
  }
};

// Get all produce (with optional filters)
const getAllProduce = async (req, res) => {
  try {
    const { status, category, search, limit = 20, startAfter } = req.query;

    let query = produceCollection.orderBy('createdAt', 'desc');

    if (status) {
      query = produceCollection
        .where('status', '==', status)
        .orderBy('createdAt', 'desc');
    }

    if (category) {
      query = produceCollection
        .where('category', '==', category)
        .orderBy('createdAt', 'desc');
    }

    if (startAfter) {
      const startDoc = await produceCollection.doc(startAfter).get();
      if (startDoc.exists) {
        query = query.startAfter(startDoc);
      }
    }

    query = query.limit(parseInt(limit));
    const snapshot = await query.get();

    let produce = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.()?.toISOString(),
      updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString(),
      expectedReadyDate: doc.data().expectedReadyDate?.toDate?.()?.toISOString(),
    }));

    // Client-side search filter (for simple text matching)
    if (search) {
      const lowerSearch = search.toLowerCase();
      produce = produce.filter(
        (p) =>
          p.name.toLowerCase().includes(lowerSearch) ||
          p.description.toLowerCase().includes(lowerSearch) ||
          p.category.toLowerCase().includes(lowerSearch)
      );
    }

    res.json({ produce, count: produce.length });
  } catch (error) {
    console.error('Get produce error:', error);
    res.status(500).json({ error: 'Failed to fetch produce' });
  }
};

// Get single produce by ID
const getProduceById = async (req, res) => {
  try {
    const doc = await produceCollection.doc(req.params.id).get();
    if (!doc.exists) {
      return res.status(404).json({ error: 'Produce not found' });
    }

    const data = doc.data();
    res.json({
      produce: {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate?.()?.toISOString(),
        updatedAt: data.updatedAt?.toDate?.()?.toISOString(),
        expectedReadyDate: data.expectedReadyDate?.toDate?.()?.toISOString(),
      },
    });
  } catch (error) {
    console.error('Get produce error:', error);
    res.status(500).json({ error: 'Failed to fetch produce' });
  }
};

// Get farmer's produce
const getMyProduce = async (req, res) => {
  try {
    const snapshot = await produceCollection
      .where('farmerId', '==', req.user.uid)
      .orderBy('createdAt', 'desc')
      .get();

    const produce = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.()?.toISOString(),
      updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString(),
      expectedReadyDate: doc.data().expectedReadyDate?.toDate?.()?.toISOString(),
    }));

    res.json({ produce, count: produce.length });
  } catch (error) {
    console.error('Get my produce error:', error);
    res.status(500).json({ error: 'Failed to fetch your produce' });
  }
};

// Update produce
const updateProduce = async (req, res) => {
  try {
    const doc = await produceCollection.doc(req.params.id).get();
    if (!doc.exists) {
      return res.status(404).json({ error: 'Produce not found' });
    }

    if (doc.data().farmerId !== req.user.uid) {
      return res.status(403).json({ error: 'You can only edit your own produce' });
    }

    const allowedFields = [
      'name', 'description', 'category', 'price', 'unit',
      'quantity', 'status', 'location', 'expectedReadyDate', 'imageUrls',
    ];

    const updates = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        if (field === 'price' || field === 'quantity') {
          updates[field] = parseFloat(req.body[field]);
        } else if (field === 'expectedReadyDate') {
          updates[field] = req.body[field]
            ? admin.firestore.Timestamp.fromDate(new Date(req.body[field]))
            : null;
        } else {
          updates[field] = req.body[field];
        }
      }
    }

    updates.updatedAt = admin.firestore.FieldValue.serverTimestamp();
    await produceCollection.doc(req.params.id).update(updates);

    // If status changed to ready, notify interested buyers
    if (updates.status === 'ready' && doc.data().status === 'unready') {
      await _notifyProduceReady(req.params.id, doc.data().name, doc.data().farmerName);
    }

    const updated = await produceCollection.doc(req.params.id).get();
    res.json({
      produce: {
        id: updated.id,
        ...updated.data(),
        createdAt: updated.data().createdAt?.toDate?.()?.toISOString(),
        updatedAt: updated.data().updatedAt?.toDate?.()?.toISOString(),
      },
    });
  } catch (error) {
    console.error('Update produce error:', error);
    res.status(500).json({ error: 'Failed to update produce' });
  }
};

// Delete produce
const deleteProduce = async (req, res) => {
  try {
    const doc = await produceCollection.doc(req.params.id).get();
    if (!doc.exists) {
      return res.status(404).json({ error: 'Produce not found' });
    }

    if (doc.data().farmerId !== req.user.uid) {
      return res.status(403).json({ error: 'You can only delete your own produce' });
    }

    // Delete images from MongoDB
    await deleteProduceImages(req.params.id);

    await produceCollection.doc(req.params.id).delete();
    res.json({ message: 'Produce deleted successfully' });
  } catch (error) {
    console.error('Delete produce error:', error);
    res.status(500).json({ error: 'Failed to delete produce' });
  }
};

// Upload produce image (MongoDB primary, Firebase Storage fallback)
const uploadImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    const produceId = req.params.id || 'temp';
    const fileName = `${uuidv4()}${path.extname(req.file.originalname)}`;

    // Try MongoDB first
    if (isMongoConnected()) {
      const image = new Image({
        produceId,
        farmerId: req.user.uid,
        filename: fileName,
        originalName: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        data: req.file.buffer,
      });

      await image.save();
      const imageUrl = `/api/images/${image._id}`;
      return res.json({ imageUrl, imageId: image._id, storage: 'mongodb' });
    }

    // Fallback to Firebase Storage
    const filePath = `produce_images/${produceId}/${fileName}`;
    const bucket = storage.bucket();
    const file = bucket.file(filePath);

    await file.save(req.file.buffer, {
      metadata: { contentType: req.file.mimetype },
    });

    await file.makePublic();
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${filePath}`;

    res.json({ imageUrl: publicUrl, storage: 'firebase' });
  } catch (error) {
    console.error('Upload image error:', error);
    res.status(500).json({ error: 'Failed to upload image' });
  }
};

// Get image by ID (serves image binary from MongoDB)
const getImage = async (req, res) => {
  try {
    const image = await Image.findById(req.params.imageId);
    if (!image) {
      return res.status(404).json({ error: 'Image not found' });
    }

    res.set('Content-Type', image.mimetype);
    res.set('Cache-Control', 'public, max-age=86400'); // Cache for 24h
    res.send(image.data);
  } catch (error) {
    console.error('Get image error:', error);
    res.status(500).json({ error: 'Failed to retrieve image' });
  }
};

// Delete all images for a produce item (used when deleting produce)
const deleteProduceImages = async (produceId) => {
  try {
    await Image.deleteMany({ produceId });
  } catch (error) {
    console.warn('Image cleanup error (non-fatal):', error.message);
  }
};

// Helper: Notify buyers about new produce
const _notifyNewProduce = async (produceId, produceName, category, farmerName) => {
  try {
    // Get all buyers
    const buyersSnapshot = await usersCollection
      .where('role', '==', 'buyer')
      .get();

    const batch = db.batch();
    buyersSnapshot.docs.forEach((doc) => {
      const notifRef = db.collection('notifications').doc();
      batch.set(notifRef, {
        userId: doc.id,
        title: 'New Produce Available!',
        body: `${farmerName} just listed ${produceName} (${category})`,
        produceId,
        isRead: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });

    await batch.commit();
  } catch (error) {
    console.error('Notification error (non-fatal):', error.message);
  }
};

// Helper: Notify when produce becomes ready
const _notifyProduceReady = async (produceId, produceName, farmerName) => {
  try {
    // Check who has chatted about this produce
    const chatRooms = await db
      .collection('chatRooms')
      .where('produceId', '==', produceId)
      .get();

    const notifiedUsers = new Set();
    const batch = db.batch();

    chatRooms.docs.forEach((doc) => {
      const participants = doc.data().participantIds || [];
      participants.forEach((uid) => {
        if (!notifiedUsers.has(uid)) {
          notifiedUsers.add(uid);
          const notifRef = db.collection('notifications').doc();
          batch.set(notifRef, {
            userId: uid,
            title: 'Produce Now Ready!',
            body: `${produceName} by ${farmerName} is now ready for sale`,
            produceId,
            isRead: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        }
      });
    });

    if (notifiedUsers.size > 0) {
      await batch.commit();
    }
  } catch (error) {
    console.error('Ready notification error (non-fatal):', error.message);
  }
};

module.exports = {
  createProduce,
  getAllProduce,
  getProduceById,
  getMyProduce,
  updateProduce,
  deleteProduce,
  uploadImage,
  getImage,
};
