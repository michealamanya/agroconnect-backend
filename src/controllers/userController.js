const { db } = require('../config/firebase');

const usersCollection = db.collection('users');

// Get user profile
const getProfile = async (req, res) => {
  try {
    const doc = await usersCollection.doc(req.user.uid).get();
    if (!doc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ user: { id: doc.id, ...doc.data() } });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
};

// Update user profile
const updateProfile = async (req, res) => {
  try {
    const { name, phone, location, profileImageUrl } = req.body;
    const updates = {};

    if (name) updates.name = name;
    if (phone) updates.phone = phone;
    if (location !== undefined) updates.location = location;
    if (profileImageUrl !== undefined) updates.profileImageUrl = profileImageUrl;

    await usersCollection.doc(req.user.uid).update(updates);
    
    const updated = await usersCollection.doc(req.user.uid).get();
    res.json({ user: { id: updated.id, ...updated.data() } });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
};

// Get a user by ID (public profile)
const getUserById = async (req, res) => {
  try {
    const doc = await usersCollection.doc(req.params.id).get();
    if (!doc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }
    const data = doc.data();
    // Return limited public info
    res.json({
      user: {
        id: doc.id,
        name: data.name,
        role: data.role,
        location: data.location,
        profileImageUrl: data.profileImageUrl,
      },
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
};

module.exports = { getProfile, updateProfile, getUserById };
