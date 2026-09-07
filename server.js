const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const session = require('express-session');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// إعداد قاعدة البيانات
const db = new sqlite3.Database('./database.db', (err) => {
    if (err) console.error('Database opening error: ', err);
});

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        password TEXT,
        is_admin INTEGER DEFAULT 0
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS downloads (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tool_name TEXT,
        count INTEGER DEFAULT 0
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT,
        ip TEXT,
        country TEXT,
        action TEXT,
        time DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // إنشاء حساب الأدمن الثابت تلقائياً إذا لم يكن موجوداً
    db.get(`SELECT * FROM users WHERE username = ?`, ['admin@xkk.store'], (err, row) => {
        if (!row) {
            db.run(`INSERT INTO users (username, password, is_admin) VALUES (?, ?, 1)`, 
                ['admin@xkk.store', 'xkkstorea3tzlklayz']);
        }
    });
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
    secret: 'xkk_super_secret_key',
    resave: false,
    saveUninitialized: true
}));

async function getCountryFromIP(ip) {
    try {
        if (ip === '127.0.0.1' || ip === '::1') return 'Localhost';
        const response = await axios.get(`http://ip-api.com/json/${ip}`);
        return response.data.country || 'Unknown';
    } catch (e) {
        return 'Unknown';
    }
}

// تسجيل حساب جديد (دائماً كمستخدم عادي غير أدمن)
app.post('/api/register', async (req, res) => {
    const { username, password } = req.body;
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const country = await getCountryFromIP(ip);

    if (username === 'admin@xkk.store') {
        return res.json({ success: false, message: 'هذا الاسم محجوز للمشرف الرئيسي!' });
    }

    db.run(`INSERT INTO users (username, password, is_admin) VALUES (?, ?, 0)`, [username, password], function(err) {
        if (err) {
            return res.json({ success: false, message: 'اسم المستخدم مستخدم مسبقاً!' });
        }
        db.run(`INSERT INTO logs (username, ip, country, action) VALUES (?, ?, ?, ?)`, [username, ip, country, 'Register']);
        res.json({ success: true });
    });
});

// تسجيل الدخول
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const country = await getCountryFromIP(ip);

    db.get(`SELECT * FROM users WHERE username = ? AND password = ?`, [username, password], (err, user) => {
        if (user) {
            req.session.user = user;
            db.run(`INSERT INTO logs (username, ip, country, action) VALUES (?, ?, ?, ?)`, [username, ip, country, 'Login']);
            res.json({ success: true, isAdmin: user.is_admin === 1 });
        } else {
            res.json({ success: false, message: 'خطأ في اسم المستخدم أو كلمة المرور' });
        }
    });
});

app.get('/api/check-session', (req, res) => {
    if (req.session.user) {
        res.json({ loggedIn: true, username: req.session.user.username, isAdmin: req.session.user.is_admin === 1 });
    } else {
        res.json({ loggedIn: false });
    }
});

app.get('/api/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

app.post('/api/download', (req, res) => {
    const { tool_name } = req.body;
    db.get(`SELECT * FROM downloads WHERE tool_name = ?`, [tool_name], (err, row) => {
        if (row) {
            db.run(`UPDATE downloads SET count = count + 1 WHERE tool_name = ?`, [tool_name], () => {
                res.json({ success: true });
            });
        } else {
            db.run(`INSERT INTO downloads (tool_name, count) VALUES (?, 1)`, [tool_name], () => {
                res.json({ success: true });
            });
        }
    });
});

app.get('/api/admin-data', (req, res) => {
    if (!req.session.user || req.session.user.is_admin !== 1) {
        return res.status(403).json({ error: 'غير مسموح لك بالوصول' });
    }

    db.all(`SELECT username FROM users`, (err, users) => {
        db.all(`SELECT * FROM downloads`, (err, downloads) => {
            db.all(`SELECT * FROM logs ORDER BY id DESC`, (err, logs) => {
                res.json({ users, downloads, logs });
            });
        });
    });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
