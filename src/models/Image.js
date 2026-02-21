const mongoose = require('mongoose');

const imageSchema = new mongoose.Schema(
  {
    produceId: {
      type: String,
      required: true,
      index: true,
    },
    farmerId: {
      type: String,
      required: true,
      index: true,
    },
    filename: {
      type: String,
      required: true,
    },
    originalName: {
      type: String,
      required: true,
    },
    mimetype: {
      type: String,
      required: true,
    },
    size: {
      type: Number,
      required: true,
    },
    // Store image binary data directly in MongoDB
    data: {
      type: Buffer,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Virtual to get a serve URL via API
imageSchema.virtual('serveUrl').get(function () {
  return `/api/images/${this._id}`;
});

// Ensure virtuals are included in JSON
imageSchema.set('toJSON', { virtuals: true });
imageSchema.set('toObject', { virtuals: true });

const Image = mongoose.model('Image', imageSchema);

module.exports = Image;
