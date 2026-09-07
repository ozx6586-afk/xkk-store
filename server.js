const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const session = require('express-session');
const path = require('path');
const multer = require('multer');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

const db = new sqlite3.Database('./database.db');

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        email TEXT UNIQUE,
        password TEXT,
        role TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS tools (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        category TEXT,
        desc TEXT,
        fileName TEXT,
        filePath TEXT
    )`);
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use(session({
    secret: 'xkk_super_secret_key',
    resave: false,
    saveUninitialized: true
}));

// إعداد رفع الملفات للأدوات
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = './uploads';
        if (!fs.existsSync(dir)) fs.mkdirSync(dir);
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage: storage });

app.get('/api/init', (req, res) => {
    db.all(`SELECT * FROM tools`, (err, tools) => {
        res.json({
            tools: tools || [],
            user: req.session.user || null
        });
    });
});

// تسجيل الدخول (مع الاستثناء المباشر للأدمن لضمان دخوله دائماً)
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;

    if (email === 'admin@xkk.store' && password === 'xkkstorea3tzlklayz') {
        req.session.user = { id: 0, name: 'Admin', email: 'admin@xkk.store', role: 'admin' };
        return res.json({ success: true });
    }

    db.get(`SELECT * FROM users WHERE email = ? AND password = ?`, [email, password], (err, user) => {
        if (user) {
            req.session.user = { id: user.id, name: user.name, email: user.email, role: user.role };
            res.json({ success: true });
        } else {
            res.json({ success: false, message: 'خطأ في البريد الإلكتروني أو كلمة المرور' });
        }
    });
});

app.post('/api/register', (req, res) => {
    const { name, email, password } = req.body;
    if (email === 'admin@xkk.store') {
        return res.json({ success: false, message: 'هذا البريد محجوز للمشرف!' });
    }

    db.run(`INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, 'user')`, [name, email, password], function(err) {
        if (err) {
            return res.json({ success: false, message: 'البريد الإلكتروني مستخدم مسبقاً!' });
        }
        res.json({ success: true });
    });
});

app.post('/api/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

app.post('/api/tools', upload.single('toolFile'), (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') {
        return res.status(403).json({ success: false });
    }
    const { name, category, desc } = req.body;
    const file = req.file;
    if (!file) return res.json({ success: false, message: 'الرجاء رفع الملف' });

    db.run(`INSERT INTO tools (name, category, desc, fileName, filePath) VALUES (?, ?, ?, ?, ?)`,
        [name, category, desc, file.originalname, `/uploads/${file.filename}`],
        function(err) {
            res.json({ success: true });
        }
    );
});

app.delete('/api/tools/:id', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') {
        return res.status(403).json({ success: false });
    }
    db.run(`DELETE FROM tools WHERE id = ?`, [req.params.id], () => {
        res.json({ success: true });
    });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
