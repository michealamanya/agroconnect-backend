const express = require('express');
const router = express.Router();
const multer = require('multer');
const { authenticate } = require('../middleware/auth');
const {
  createProduce,
  getAllProduce,
  getProduceById,
  getMyProduce,
  updateProduce,
  deleteProduce,
  uploadImage,
  getImage,
} = require('../controllers/produceController');

const path = require('path');

// Multer config for image uploads (memory storage)
const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (file.mimetype.startsWith('image/') || allowedExtensions.includes(ext)) {
      // Force mimetype based on extension if not detected
      if (!file.mimetype.startsWith('image/')) {
        file.mimetype = 'image/jpeg';
      }
      cb(null, true);
    } else {
      cb(new Error(`Only image files are allowed. Got: ${file.mimetype} (${file.originalname})`), false);
    }
  },
});

// All produce routes require authentication
router.use(authenticate);

// GET /api/produce - Get all produce (with filters)
router.get('/', getAllProduce);

// GET /api/produce/mine - Get current farmer's produce
router.get('/mine', getMyProduce);

// GET /api/produce/:id - Get single produce
router.get('/:id', getProduceById);

// POST /api/produce - Create new produce
router.post('/', createProduce);

// PUT /api/produce/:id - Update produce
router.put('/:id', updateProduce);

// DELETE /api/produce/:id - Delete produce
router.delete('/:id', deleteProduce);

// POST /api/produce/:id/upload - Upload produce image
router.post('/:id/upload', (req, res, next) => {
  upload.single('image')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ error: `Upload error: ${err.message}` });
    } else if (err) {
      return res.status(400).json({ error: err.message });
    }
    next();
  });
}, uploadImage);

module.exports = router;
