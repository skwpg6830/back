const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const authMiddleware = require('./middleware/auth');
const multer = require('multer')

dotenv.config();

const app = express();
const port = 4000;
const dbUrl = process.env.DB_URL;

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());

const corsOptions = {
 origin: [process.env.CORS_ORIGIN, 'http://localhost:5173'],
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE'], // 允許的HTTP方法
    allowedHeaders: ['Content-Type', 'Authorization'], // 允許請求
}

app.use(cors(corsOptions));
app.use('/path/to/default-avatar.png', express.static(path.join(__dirname, 'public/images')));

const SECRET_KEY = process.env.SECRET_KEY; // 確保 SECRET_KEY 已定義

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'public/uploads/'); // 設置上傳路徑
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`); // 設置文件名
  }
});

// 配置 multer，指定文件保存路徑、大小限制和文件類型過濾
const upload = multer({
  storage: storage, // 正确配置 storage
  limits: { fileSize: 2 * 1024 * 1024 }, // 限制文件大小為 2MB
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('僅支持 JPEG 和 PNG 圖片格式'));
  }
});

app.use('/uploads', express.static('public/uploads'));

// 配置靜態資源目錄
app.use('/public', express.static(path.join(__dirname, 'public')));

// 連接到 MongoDB
mongoose.connect(dbUrl)
  .then(() => {
    console.log('成功連接到 MongoDB');
  })
  .catch((error) => {
    console.error('無法連接到 MongoDB', error);
  });

// 定義用戶模式和模型
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, default: 'user' },
  gender: { type: String, required: true },
  age: { type: String, required: true },
});

const User = mongoose.model('User', userSchema);

// 定義留言模式和模型
const messageSchema = new mongoose.Schema({
  name: { type: String, required: true },
  message: { type: String, required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' },
  textColor: { type: String, default: '#000' },
  images: { type: [String] }, // 定义 images 为字符串数组
  likes: { type: Number, default: 0 },
  replies: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Reply' }]
});

const Message = mongoose.model('Message', messageSchema);

// 定義申訴模式和模型
const appealSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' },
  appealType: { type: String, required: true },
  report: { type: String, required: true },
  content: { type: String, required: true }
});

const Appeal = mongoose.model('Appeal', appealSchema);

// 定義回覆模式和模型
const replySchema = new mongoose.Schema({
  messageId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Message' },
  userId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' },
  reply: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const Reply = mongoose.model('Reply', replySchema);

// 用戶註冊
app.post('/api/register', async (req, res, next) => {
  try {
    const { username, password, gender, age } = req.body;
    if (!username || !password || !gender || !age) {
      return res.status(400).send('所有字段都是必填的');
    }

    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).send('用戶名已存在');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const avatar = gender === 'male' ? 'path/to/male-avatar.jpg' : 'path/to/female-avatar.jpg';
    const newUser = await User.create({ username, password: hashedPassword, gender, age, avatar });

    res.status(201).send(newUser);
  } catch (error) {
    next(error);
    console.error('註冊失敗:', error);
    res.status(500).send('註冊失敗');
  }
});

// 登陸
app.post('/api/login', async (req, res, next) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).send('用戶名和密碼是必填的');
    }

    const user = await User.findOne({ username });
    if (!user) {
      return res.status(400).send('用戶不存在');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(400).send('密碼錯誤');
    }

    const token = jwt.sign({ userId: user._id, role: user.role, avatar: user.avatar, gender: user.gender }, SECRET_KEY, { expiresIn: '1h' });
    res.status(200).send({ token, userId: user._id, avatar: user.avatar, gender: user.gender });
  } catch (error) {
    next(error);
    console.error('登錄錯誤:', error);
    res.status(500).send('登陸失敗');
  }
});

// 創建留言並上傳圖片
app.post('/api/messages', authMiddleware, upload.array('images', 10), async (req, res, next) => {
  const { name, message, textColor, images } = req.body;
  try {
    if (!req.user) {
      return res.status(401).send({ error: '未授權' });
    }
    const newMessage = await Message.create({ name, message, textColor, userId: req.user.userId, images });
    res.status(201).send(newMessage);
  } catch (error) {
    next(error);
    console.error('創建留言失敗:', error);
    res.status(500).send('創建留言失敗');
  }
});


// 删除留言
app.delete('/api/messages/:id', authMiddleware, async (req, res) => {
  try {
    const message = await Message.findById(req.params.id);
    if (!message) {
      return res.status(404).json({ message: '沒有找到留言' });
    }

    // 確認用戶是否有權刪除該留言
    if (message.userId.toString() !== req.user.userId && req.user.role !== 'admin') {
      return res.status(403).json({ message: '沒有權限刪除留言' });
    }
    

    await Message.findByIdAndDelete(req.params.id);
    res.json({ message: 'Message deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: '伺服器錯誤' });
  }
});



// 編輯留言
app.put('/api/messages/:id', authMiddleware, async (req, res) => {
  try {
    const { name, message, textColor } = req.body;
    const messageToUpdate = await Message.findById(req.params.id);

    if (!messageToUpdate) {
      return res.status(404).send('留言不存在');
    }

    if (messageToUpdate.userId.toString() !== req.user.userId) {
      return res.status(403).send('無權編輯此留言');
    }

    if (name !== undefined) {
      messageToUpdate.name = name;
    }
    if (message !== undefined) {
      messageToUpdate.message = message;
    }
    if (textColor !== undefined) {
      messageToUpdate.textColor = textColor;
    }

    await messageToUpdate.save();
    res.status(200).send(messageToUpdate);
  } catch (error) {
    console.error('編輯留言失敗:', error);
    res.status(500).send('編輯留言失敗');
  }
});


// 獲取所有留言
app.get('/api/messages', async (req, res) => {
  try {
    const messages = await Message.find().populate('userId', 'username avatar gender').populate({
      path: 'replies',
      populate: {
        path: 'userId',
        select: 'username avatar gender'
      }
    });
    res.status(200).send(messages);
  } catch (error) {
    console.error('獲取留言失敗:', error);
    res.status(500).send('獲取留言失敗');
  }
});

// 點讚留言
app.post('/api/messages/:id/like', authMiddleware, async (req, res) => {
  try {
    const message = await Message.findById(req.params.id);
    if (!message) {
      return res.status(404).send('留言不存在');
    }

    message.likes += 1;
    await message.save();

    res.status(200).send(message);
  } catch (error) {
    console.error('點讚失败:', error);
    res.status(500).send('點讚失败');
  }
});

// 取消點讚留言
app.post('/api/messages/:id/unlike', authMiddleware, async (req, res) => {
  try {
    const message = await Message.findById(req.params.id);
    if (!message) {
      return res.status(404).send('留言不存在');
    }

    if (message.likes > 0) {
      message.likes -= 1;
    }

    await message.save();
    res.status(200).send(message);
  } catch (error) {
    console.error('取消點讚失敗:', error);
    res.status(500).send('取消點讚失敗');
  }
});

// 獲取用戶
app.get('/api/user', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: '用戶未找到' });
    }

    res.json({ userId: user._id, role: user.role });
  } catch (error) {
    res.status(500).json({ message: '獲取用戶失敗' });
  }
});



// 創建回覆
app.post('/api/messages/:id/replies', authMiddleware, async (req, res, next) => {
  try {
    const { reply } = req.body; // 檢查接收的字段

    if (!reply) {
      return res.status(400).send('回覆内容是必须的');
    }

    const messageId = req.params.id;
    const newReply = await Reply.create({ messageId, userId: req.user.userId, reply });
    await Message.findByIdAndUpdate(messageId, { $push: { replies: newReply._id } });

    res.status(201).send(newReply);
  } catch (error) {
    next(error);
    console.error('創建回覆失敗:', error);
    res.status(500).send('創建回覆失敗');
  }
});

// 獲取特定留言的所有回覆
app.get('/api/messages/:id/replies', async (req, res) => {
  try {
    const messageId = req.params.id;
    const replies = await Reply.find({ messageId }).populate('userId', 'username avatar gender');
    res.status(200).send(replies);
  } catch (error) {
    console.error('獲取回覆失敗:', error);
    res.status(500).send('獲取回覆失敗');
  }
});

// 刪除回覆
app.delete('/api/messages/:messageId/replies/:replyId', authMiddleware, async (req, res) => {
  try {
    const { messageId, replyId } = req.params;

    const message = await Message.findById(messageId);
    if (!message) {
      console.log(`Message with id ${messageId} not found`);
      return res.status(404).send('留言未找到');
    }

    const reply = await Reply.findById(replyId);
    if (!reply) {
      console.log(`Reply with id ${replyId} not found`);
      return res.status(404).send('回覆未找到');
    }

    if (reply.userId.toString() !== req.user.userId && req.user.role !== 'admin') {
      return res.status(403).send('無權限刪除該回覆');
    }

    await Reply.deleteOne({ _id: replyId });
    message.replies = message.replies.filter((r) => r.toString() !== replyId);
    await message.save();

    res.status(200).send('回覆已刪除');
  } catch (error) {
    console.error('刪除回覆失敗:', error);
    res.status(500).send('刪除回覆失敗');
  }
});


// 定義提交申訴的路由
app.post('/api/appeals', authMiddleware, async (req, res) => {
  try {
    const { appealType, report, content } = req.body;
    if (!appealType || !report || !content) {
      return res.status(400).send('所有字段都是必填的');
    }

    const newAppeal = await Appeal.create({
      userId: req.user.userId,
      appealType,
      report,
      content
    });
    res.status(201).send(newAppeal);
  } catch (error) {
    console.error('創建申訴失敗:', error);
    res.status(500).send('創建申訴失敗');
  }
});

// 獲取所有申訴
app.get('/api/appeals', authMiddleware, async (req, res) => {
  try {
    const appeals = await Appeal.find().populate('userId', 'username').exec();
    res.status(200).send(appeals);
  } catch (error) {
    console.error('獲取申訴失敗:', error);
    res.status(500).send('獲取申訴失敗');
  }
});

// 刪除申訴
app.delete('/api/appeals/:id', authMiddleware, async (req, res) => {
  try {
    const id = req.params.id;
    await Appeal.findByIdAndDelete(id);
    res.status(200).send({ message: '申訴已刪除' });
  } catch (error) {
    res.status(500).send({ message: '無法刪除申訴', error });
  }
});

// 文件上傳路由，使用 array 方法確保所有上傳都以數組形式進行
app.post('/api/public/upload', upload.array('images', 10), (req, res) => {
  try {
    const files = req.files; // req.files 將是一個包含所有上傳文件的數組
    console.log('文件已接收:', files);
    res.status(200).send({ message: '文件上傳成功', files });
  } catch (error) {
    console.error('文件上傳失敗:', error);
    res.status(500).send({ message: '文件上傳失敗' });
  }
});

// 處理錯誤的中間件
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('伺服器錯誤');
});

// 啟動服務器
app.listen(port|| process.env.PORT, () => {
  console.log(`伺服器成功啟動 ${port}`);
});
