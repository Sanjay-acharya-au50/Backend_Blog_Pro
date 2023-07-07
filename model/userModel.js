const mongoose = require("mongoose");
const { Schema, model } = mongoose;
const {isEmail} = require('validator')

const UserSchema = new Schema({
  userName: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    unique: true,
    required: true,
    lowercase: true,
    validate: isEmail,
  },
  password: {
    type: String,
    required: true,
  },
  avatar: {
    type: String,
    required: true
  }
}, { timestamps: true });

const User = model("User", UserSchema)

module.exports = User;
