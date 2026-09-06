const express = require('express');
const session = require('express-session');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = process.env.PORT || 3000;

// إعداد التخزين لرفع الملفات
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, 'public/uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage: storage });

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
    secret: 'xkk_super_secret_key_9988',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 24 * 60 * 60 * 1000 } // يوم كامل
}));

// قاعدة بيانات وهمية (ملف JSON لحفظ البيانات والاعتمادية)
const DB_FILE = path.join(__dirname, 'database.json');

function getDB() {
    if (!fs.existsSync(DB_FILE)) {
        const initialData = {
            users: [
                { id: 1, name: 'AdminXKK', email: 'admin@xkk.store', passwordHash: bcrypt.hashSync('xkkstorea3tzlklayz', 10), role: 'admin' },
                { id: 2, name: 'GamerPro', email: 'gamer@example.com', passwordHash: bcrypt.hashSync('123456', 10), role: 'user' }
            ],
            tools: []
        };
        fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2));
    }
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}

function saveDB(data) {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// تهيئة قاعدة البيانات عند البدء
getDB();

// Endpoints (APIs)
// جلب الأدوات والمستخدم الحالي
app.get('/api/init', (req, res) => {
    const db = getDB();
    res.json({
        tools: db.tools,
        user: req.session.user || null
    });
});

// تسجيل الدخول
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    const db = getDB();
    const user = db.users.find(u => u.email === email);

    if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
        return res.status(400).json({ success: false, message: 'البريد أو كلمة المرور غير صحيحة!' });
    }

    req.session.user = { id: user.id, name: user.name, email: user.email, role: user.role };
    res.json({ success: true, user: req.session.user });
});

// إنشاء حساب جديد
app.post('/api/register', (req, res) => {
    const { name, email, password } = req.body;
    const db = getDB();

    if (db.users.find(u => u.email === email)) {
        return res.status(400).json({ success: false, message: 'البريد الإلكتروني مستخدم مسبقاً!' });
    }

    const newUser = {
        id: db.users.length + 1,
        name,
        email,
        passwordHash: bcrypt.hashSync(password, 10),
        role: 'user'
    };

    db.users.push(newUser);
    saveDB(db);

    req.session.user = { id: newUser.id, name: newUser.name, email: newUser.email, role: newUser.role };
    res.json({ success: true, user: req.session.user });
});

// تسجيل الخروج
app.post('/api/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

// إضافة أداة (للمشرف فقط)
app.post('/api/tools', upload.single('toolFile'), (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'غير مصرح لك بذلك!' });
    }

    const { name, category, desc } = req.body;
    const fileName = req.file ? req.file.originalname : 'no-file.zip';
    const filePath = req.file ? `/uploads/${req.file.filename}` : '#';

    const db = getDB();
    const newTool = {
        id: Date.now(),
        name,
        category,
        desc,
        fileName,
        filePath
    };

    db.tools.push(newTool);
    saveDB(db);

    res.json({ success: true, tool: newTool });
});

// حذف أداة (للمشرف فقط)
app.delete('/api/tools/:id', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'غير مصرح لك بذلك!' });
    }

    const db = getDB();
    const toolId = parseInt(req.params.id);
    db.tools = db.tools.filter(t => t.id !== toolId);
    saveDB(db);

    res.json({ success: true });
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});