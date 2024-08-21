const express = require('express');
const router = express.Router();
const Appeal = require('../models/Appeal'); // 假設模型已正確定義
const authMiddleware = require('../middleware/auth');

// 提交申訴
router.post('/', async (req, res) => {
    const { appealType, report, content } = req.body;
    const userId = req.user.userId;
  
    if (!appealType || !report || !content) {
      return res.status(400).send('所有字段均為必填');
    }
  
    try {
      const newAppeal = await Appeal.create({ appealType, report, content, userId });
      res.status(201).send(newAppeal);
    } catch (error) {
      console.error('提交申訴失败:', error);
      res.status(500).send('提交申訴失败');
    }
  });

// 獲取所有申訴（僅管理员）
router.get('/appeals', authMiddleware, async (req, res) => {
    try {
      const appeals = await Appeal.find();
      res.json(appeals);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  

// 獲取特定用戶的申訴
router.get('/user/:userId', authMiddleware, async (req, res) => {
  try {
    const userId = req.params.userId;

    if (req.user.userId !== userId && req.user.role !== 'admin') {
      return res.status(403).send('無權查看該用戶的申訴');
    }

    const appeals = await Appeal.find({ userId }).populate('userId', 'username avatar gender');
    res.status(200).send(appeals);
  } catch (error) {
    console.error('獲取用戶申訴失敗:', error);
    res.status(500).send('獲取用戶申訴失敗');
  }
});

module.exports = router;