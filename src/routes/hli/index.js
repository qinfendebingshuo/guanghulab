// src/routes/hli/index.js
// HLI 路由注册中心

const express = require('express');
const router = express.Router();

// AUTH 域（不需要鉴权）
const authRouter = require('./auth');
router.use('/auth', authRouter);

// BRAIN 域（不需要鉴权 — 前端壳层需调用脑接口组装 AI 请求）
const brainRouter = require('./brain');
router.use('/brain', brainRouter);

// 以下域需要 HLI 鉴权中间件
const hliAuth = require('../../middleware/hli-auth.middleware');

router.use(hliAuth);

// REGISTRY 域 — 开发者编号查询
const registryRouter = require('./registry');
router.use('/registry', registryRouter);

// PERSONA 域
// const personaRouter = require('./persona');
// router.use('/persona', personaRouter);

// USER 域
// const userRouter = require('./user');
// router.use('/user', userRouter);

// TICKET 域
// const ticketRouter = require('./ticket');
// router.use('/ticket', ticketRouter);

// DIALOGUE 域
// const dialogueRouter = require('./dialogue');
// router.use('/dialogue', dialogueRouter);

// STORAGE 域
// const storageRouter = require('./storage');
// router.use('/storage', storageRouter);

// DASHBOARD 域
// const dashboardRouter = require('./dashboard');
// router.use('/dashboard', dashboardRouter);

module.exports = router;
