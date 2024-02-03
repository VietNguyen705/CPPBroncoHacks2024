require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const User = require('./models/User');
const jwt = require('jsonwebtoken');

const app = express();
const port = process.env.PORT || 3000;

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

// Start the server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
