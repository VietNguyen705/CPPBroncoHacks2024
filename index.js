require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const User = require('./models/User');
const jwt = require('jsonwebtoken');

const app = express();
const port = process.env.PORT || 3001;

// MongoDB Connection
const uri = process.env.MONGODB_URI;
mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB Connected'))
  .catch(err => console.log(err));

app.use(bodyParser.json()); // for parsing application/json

// Signin Route
app.post('/signin', async (req, res) => {
    const { email, password } = req.body;
  
    try {
      // Check if user exists
      const user = await User.findOne({ email });
      if (!user) {
        return res.status(400).send('User not found.');
      }
  
      // Compare password
      const validPassword = await bcrypt.compare(password, user.passwordHash);
      if (!validPassword) {
        return res.status(400).send('Invalid password.');
      }
  
      // Respond success (Consider using JWT or sessions for managing authentication in real apps)
      const token = jwt.sign({ _id: user._id }, process.env.TOKEN_SECRET, { expiresIn: '1h' });
      res.header('auth-token', token).send(token);
        } catch (err) {
      console.log(err);
      res.status(500).send('An error occurred.');
    }
  });

// Signup Route
app.post('/signup', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Check if the user already exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).send('User already exists with that email.');
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
    });
  } catch (err) {
    res.status(500).send('Error signing up user.');
  }
});
// Create items  ** Only Users in the database can create items **
app.post('/item/create', async (req, res) => {
  try{  
    // Access data from the request body
    const {title, description, price, category, sellerId, 
        images, createdAt, updatedAt} = req.body;
    
    // Check for required fields
    if (!title || !description || !price || !category || !sellerId || !images) {
        return res.status(400).json({ error: 'Please fill out all required fields.' });
    }    

    // Process the data (e.g., save to a database)
    const newItem = new Item({
        title,
        description,
        price,
        category,
        images,
        createdAt: new Date(),
        updatedAt: new Date(),
    });

    const savedItem = await newItem.save();

    }  catch {
        res.status(500).send('Error creating item.');
    }
    // Send a response back to the client
    res.json({ message: 'Item created!' });
  });

// Retrieve items 
app.get('/items/:itemId', async (req, res) => {
    try {
      const itemId = req.params.itemId;
  
      // Fetch the item from the database based on the itemId
      const foundItem = await Item.findById(itemId);
  
      // Check if the item was found
      if (!foundItem) {
        return res.status(404).json({ error: 'Item not found.' });
      }
  
      // Send the found item as the response
      res.json(foundItem);
    } catch (error) {
      console.error('Error retrieving item:', error);
      // Handle other errors and send an appropriate response
      res.status(500).json({ error: 'Internal server error.' });
    }
  });
/*
// Partial update with PATCH
app.patch('/items/:itemId', async (req, res) => {
    // Apply partial modifications to the item in the database using the provided data
    
    

    res.json({ message: 'Item updated successfully!' });
  });
*/
// Start the server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
