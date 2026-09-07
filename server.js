const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const session = require('express-session');
const bcrypt = require('bcrypt'); // أو بدون تشفير حسب نظامك القديم
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

    // إنشاء حساب الأدمن الثابت تلقائياً إذا لم يكن موجوداً
    db.get(`SELECT * FROM users WHERE email = ?`, ['admin@xkk.store'], (err, row) => {
        if (!row) {
            db.run(`INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)`, 
                ['Admin', 'admin@xkk.store', 'xkkstorea3tzlklayz', 'admin']);
        }
    });
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

// API تهيئة التطبيق
app.get('/api/init', (req, res) => {
    db.all(`SELECT * FROM tools`, (err, tools) => {
        res.json({
            tools: tools || [],
            user: req.session.user || null
        });
    });
});

// API تسجيل الدخول (يتعرف على الأدمن الثابت فوراً)
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;

    db.get(`SELECT * FROM users WHERE email = ? AND password = ?`, [email, password], (err, user) => {
        if (user) {
            req.session.user = { id: user.id, name: user.name, email: user.email, role: user.role };
            res.json({ success: true });
        } else {
            res.json({ success: false, message: 'خطأ في البريد الإلكتروني أو كلمة المرور' });
        }
    });
});

// API تسجيل المستخدمين الجدد (يمنع أي شخص من أخذ إيميل الأدمن)
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

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
