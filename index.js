import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import session from 'express-session';
import { createPool } from 'mysql2';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const port = 3000;

const pool = createPool({
    host: 'localhost',
    user: 'root',
    password: 'Panchakarla@28',
    database: 'mydb',
    connectionLimit: 10,
    port: 3306,
});
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(session({
  secret: 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60 * 6,
    sameSite: 'lax'
  }
}));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});
app.get('/register', (req, res) => {
    res.sendFile(path.join(__dirname, 'register.html'));
});
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html'));
});
app.get('/donate', (req, res) => {
    res.render('donate');
});
app.get('/leader', (req, res) => {
    if(!req.session){
        res.redirect('/login');
    }
    pool.query(
        'select u.name, sum(amount) from users u join donations d on u.referal_code = d.referal_code desc',
        [amount],
        (err, results) => {
            if (err) {
                console.error(err);
                res.status(500).send('Error fetching data');
                } else {
                    res.render('leader', { results });
                    }
                    }
    )
    res.render('leader');
    });

// Register user
app.post('/register', (req, res) => {
    const { name, Phone, email, password, confirm_password } = req.body;
    if (!email.includes('@') || !email.includes('.')) {
        return res.send('Invalid email');
    }
    if (password !== confirm_password) {
        return res.send('Passwords do not match');
    }
    const referal_code = `${name}2025`;
    pool.query(
        'INSERT INTO users (name, phone, email, password, referral_code) VALUES (?, ?, ?, ?, ?)', 
        [name, Phone, email, password, referral_code], 
        (err, results) => {
            if (err) {
                if (err.code === 'ER_DUP_ENTRY') {
                    return res.send('Email or referral code already registered');
                }
                return res.send('Database error: ' + err.message);
            }
            res.redirect('/login');
        }
    );
});

// Login user
app.post('/login', (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.send('Please enter both email and password.');
    }
    pool.query(
        'SELECT * FROM users WHERE email = ? AND password = ?',
        [email, password],
        (err, results) => {
            if (err) return res.send('Database error: ' + err.message);
            if (results.length > 0) {
                req.session.user = results[0];
                res.redirect('/profile');
            } else {
                res.send('Invalid email or password.');
            }
        }
    );
});

// Profile page
app.get('/profile', (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }
    const referal_code = req.session.user.referal_code;
    pool.query(
        'SELECT SUM(amount) AS total FROM donations WHERE referal_code = ?',
        [referal_code],
        (err, results) => {
            if (err) return res.send('Database error: ' + err.message);
            const total_donations = results[0].total || 0;
            res.render('profile', { user: req.session.user, total_donations });
        }
    )
});

// Save donation
app.post('/donate', (req, res) => {
    const { name, email, amount, referal_code } = req.body;
    const date = new Date().toISOString().slice(0, 19).replace('T', ' ');
    pool.query(
        'INSERT INTO donations (name, email, amount, referal_code, date) VALUES (?, ?, ?, ?, ?)',
        [name, email, amount, referal_code, date],
        (err, results) => {
            if (err) {
                console.log(err); // <-- Add this for debugging
                if (err.code === 'ER_NO_REFERENCED_ROW_2') {
                    return res.send('Referral code does not exist.');
                }
                return res.send('Database error: ' + err.message);
            }
            res.redirect('/donate');
        }
    );
});

app.get('/leaderboard', (req, res) => {
    pool.query(
        `SELECT u.name, u.referal_code, COALESCE(SUM(d.amount), 0) as total_raised
         FROM users u
         LEFT JOIN donations d ON u.referal_code = d.referal_code
         GROUP BY u.name, u.referal_code
         ORDER BY total_raised DESC`,
        (err, results) => {
            if (err) {
                console.error(err);
                return res.status(500).send('Database error: ' + err.message);
            }
            res.render('leader', {
                leaderboard: results,
                user: req.session.user || { name: 'Guest' }
            });
        }
    );
});


app.get('/logout', (req, res) => req.session.destroy(() => res.redirect('/login')));

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
