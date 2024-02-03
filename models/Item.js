const mongoose = require('mongoose');
const { Schema } = mongoose;

const itemSchema = new Schema({
  title: { type: String, required: true },
  description: String,
  price: Number,
  category: String,
  sellerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  images: [String],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const Item = mongoose.model('Item', itemSchema);
module.exports = Item;
