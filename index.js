require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const User = require('./models/User');
const jwt = require('jsonwebtoken');
const Transaction = require('./models/Transaction');
const Item = require('./models/Item'); 
const authenticate = require('./middleware/authenticate'); 
const cors = require('cors');
//cloudinary
const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const upload = multer({ dest: 'uploads/' }); 
cloudinary.config({ 
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
  api_key: process.env.CLOUDINARY_API_KEY, 
  api_secret: process.env.CLOUDINARY_API_SECRET 
});


const app = express();
const port = process.env.PORT || 3001;

// MongoDB Connection
const uri = process.env.MONGODB_URI;
mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB Connected'))
  .catch(err => console.log(err));

app.use(bodyParser.json()); // for parsing application/json
app.use(cors());

//====================USERS================================
// Signin Route V
app.post('/signin', async (req, res) => {
  const { email, password } = req.body;

  try {
    // Check if user exists
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'User not found.' });
    }

    // Compare password
    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if (!validPassword) {
      return res.status(400).json({ message: 'Invalid password.' });
    }

    // Generate JWT token
    const token = jwt.sign({ id: user._id }, process.env.TOKEN_SECRET, { expiresIn: '1h' });
    res.json({ message: 'Logged in successfully', token }); // Send the token in the response body
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'An error occurred.' });
  }
});

// Signup Route V
app.post('/signup', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Check if the user already exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: 'User already exists with that email.' });
    }

    // Hash the password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create a new user
    const newUser = new User({
      username,
      email,
      passwordHash: hashedPassword,
    });

    const savedUser = await newUser.save();

    // Respond with the created user (excluding the password hash)
    res.status(201).json({
      _id: savedUser._id,
      username: savedUser.username,
      email: savedUser.email,
      message: "User created successfully!"
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error signing up user.' });
  }
});
//retrieve user listings V
app.get('/my/listings', authenticate, async (req, res) => {
  try {
      const listings = await Item.find({ sellerId: req.user.id });
      if (!listings.length) {
          // This would not cause a 500 error but check how you handle no listings found
          return res.status(404).json({ message: 'No listings found.' });
      }
      res.json(listings);
  } catch (error) {
      console.error(error);
      res.status(500).send('Server error');
  }
});



//retrieve user profiles V
app.get('/user/profile', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('username email _id');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

//retrieve user profiles V
app.get('/user/profile/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('username email -_id');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

//update user profiles X
app.put('/user/:id', async (req, res) => {
  try {
    const { username, email, profileInfo } = req.body;
    const user = await User.findByIdAndUpdate(req.params.id, {
      $set: {
        username,
        email,
        profileInfo
      }
    }, { new: true }).select('-passwordHash');

    if (!user) {
      return res.status(404).send('User not found.');
    }
    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});
//====================ITEMS=============================
// Create items ** Only Users in the database can create items ** V
app.post('/items/create', authenticate, upload.single('images'), async (req, res) => {
  const { title, description, price, category } = req.body;
  const sellerId = req.user.id;

  try {
    // Upload the image to Cloudinary
    const result = await cloudinary.uploader.upload(req.file.path);

    // Create a new item with the image URL returned by Cloudinary
    const newItem = new Item({
      title,
      description,
      price,
      category,
      sellerId,
      images: [result.url], // Store the Cloudinary URL
    });

    await newItem.save();
    res.json({ message: 'Item created successfully!', item: newItem });
  } catch (error) {
    console.error('Error creating item:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

// Route to get a specific item by its ID X
app.get('/items/:id', async (req, res) => {
  try {
    const item = await Item.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }
    res.json(item);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Retrieve all items V
app.get('/items/', async (req, res) => {
  try {
    let query = Item.find({});

    // Filtering by category if provided
    if (req.query.category) {
      query.where('category', req.query.category);
    }

    // Filtering by price range
    if (req.query.minPrice || req.query.maxPrice) {
      let priceFilter = {};
      if (req.query.minPrice) {
        priceFilter.$gte = parseFloat(req.query.minPrice);
      }
      if (req.query.maxPrice) {
        priceFilter.$lte = parseFloat(req.query.maxPrice);
      }
      query.where('price', priceFilter);
    }

    // Filtering by author if provided
    if (req.query.author) {
      query.where('author', { $regex: req.query.author, $options: 'i' }); // Case-insensitive search
    }

    // Filtering by title if provided
    if (req.query.title) {
      query.where('title', { $regex: req.query.title, $options: 'i' }); // Case-insensitive search
    }

    const items = await query.exec();
    res.json(items);
  } catch (error) {
    console.error('Error fetching items:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Edit item X
app.put('/items/:itemId', async (req, res) => {
  const { itemId } = req.params;
  const { title, description, price, category, images } = req.body;

  try {
    // Attempt to update the item and return the updated document
    const updatedItem = await Item.findByIdAndUpdate(itemId, {
      $set: {
        title,
        description,
        price,
        category,
        images,
        updatedAt: new Date(),
      }
    }, { new: true, runValidators: true }); // Return the updated item and run validators

    // Check if the item was found and updated
    if (!updatedItem) {
      return res.status(404).json({ message: 'Item not found.' });
    }

    // Send the updated item as the response
    res.json({ message: 'Item updated successfully!', item: updatedItem });
  } catch (err) {
    console.error('Error updating item:', err);
    res.status(500).json({ message: 'Server error' });
  }
});
// Delete Item X
app.delete('/items/:id', authenticate, async (req, res) => {
  try {
    const itemId = req.params.id;
    const userId = req.user.id; // Assuming this is set by your authentication middleware

    // First, find the item to ensure it exists and to check the owner
    const item = await Item.findById(itemId);

    if (!item) {
      return res.status(404).json({ message: 'Item not found.' });
    }
    
    // Check if the current user is the owner of the item
    if (item.sellerId.toString() !== userId) {
      // sellerId might need to be converted from ObjectId to String
      return res.status(403).json({ message: 'User not authorized to delete this item.' });
    }

    // If checks pass, delete the item
    await Item.findByIdAndDelete(itemId);
    res.json({ message: 'Item deleted successfully.' });
  } catch (error) {
    console.error('Error deleting item:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

//==================Transactions===========================
//Create a new transaction when a buyer purchases an item or service X
app.post('/transactions', authenticate, async (req, res) => {
  const { itemId, quantity, totalPrice } = req.body;
  const buyerId = req.user.id; // Assuming this is set by your authentication middleware

  try {
    // Find the item to ensure it exists and retrieve the sellerId
    const item = await Item.findById(itemId);
    if (!item) {
      return res.status(404).json({ message: 'Item not found.' });
    }
    const sellerId = item.sellerId;

    // Prevent users from buying their own items
    if (sellerId.toString() === buyerId) {
      return res.status(400).json({ message: "Cannot buy your own item." });
    }

    // Create the transaction
    const newTransaction = new Transaction({
      itemId,
      buyerId,
      sellerId,
      quantity,
      totalPrice,
      status: 'pending', // Initial status
    });

    const savedTransaction = await newTransaction.save();
    res.status(201).json({ message: 'Transaction successfully created', transaction: savedTransaction });
  } catch (error) {
    console.error('Error creating transaction:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

//Retrieve a user's transaction history X
app.get('/transactions/:userId', authenticate, async (req, res) => {
  const { userId } = req.params;
  const { role } = req.query; // Optional query parameter to filter by role (buyer or seller)

  // Ensure the authenticated user is requesting their own transaction history
  if (req.user.id !== userId) {
    return res.status(403).json({ message: "Unauthorized to access this user's transactions." });
  }

  try {
    let query = {};

    // Filter transactions based on the role if specified
    if (role === 'buyer') {
      query.buyerId = userId;
    } else if (role === 'seller') {
      query.sellerId = userId;
    } else {
      // No role specified, fetch all transactions where the user is either buyer or seller
      query = { $or: [{ buyerId: userId }, { sellerId: userId }] };
    }

    const transactions = await Transaction.find(query).populate('itemId', 'title price').exec(); // Example of populating item details

    res.json(transactions);
  } catch (error) {
    console.error('Error retrieving transactions:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
});
//update transaction status X
app.put('/transactions/:transactionId/status', authenticate, async (req, res) => {
  const { transactionId } = req.params;
  const { status } = req.body; // New status to be updated to

  try {
    // Optional: Check if the user is authorized to update the transaction
    // This could involve checking if the user is the seller or buyer for the transaction
    const transaction = await Transaction.findById(transactionId);

    if (!transaction) {
      return res.status(404).json({ message: "Transaction not found." });
    }

    // Example authorization check: Allow only sellers to update status
    if (transaction.buyerId.toString() !== req.user.id) {
      return res.status(403).json({ message: "Unauthorized to update this transaction." });
    }

    // Update the transaction's status
    const updatedTransaction = await Transaction.findByIdAndUpdate(transactionId, { status }, { new: true });

    res.json({ message: "Transaction status updated successfully.", transaction: updatedTransaction });
  } catch (error) {
    console.error('Error updating transaction status:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
