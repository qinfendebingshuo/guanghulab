// src/routes/hli/auth/index.js
// AUTH 域路由

const express = require('express');
const router = express.Router();

const login = require('./login');
const register = require('./register');
const verify = require('./verify');

router.use('/login', login);
router.use('/register', register);
router.use('/verify', verify);

module.exports = router;
