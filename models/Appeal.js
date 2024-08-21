const mongoose = require('mongoose');

const appealSchema = new mongoose.Schema({
  reporterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  appealType: { type: String, required: true },
  report: { type: String, required: true },
  content: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const Appeal = mongoose.model('Appeal', appealSchema);

module.exports = Appeal;

