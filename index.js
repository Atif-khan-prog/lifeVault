const express = require('express');
const path = require('path');
const session = require('express-session');
const methodOverride = require('method-override');
const database = require('./database/lifeVault_db');
require('dotenv').config();

const app = express();

// Middleware setup
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(methodOverride('_method'));

// Session config
app.use(session({
  secret: 'atif-khan',
  resave: false,
  saveUninitialized: false,
}));

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Auth middleware
function isAuthenticated(req, res, next) {
  if (req.session.username) return next();
  res.redirect('/login');
}

// Helper to get user id by username
function getUserId(username, callback) {
  database.query('SELECT id FROM signup WHERE username = ?', [username], (err, results) => {
    if (err) return callback(err);
    if (!results.length) return callback(new Error('User not found'));
    callback(null, results[0].id);
  });
}

// Health check endpoint
app.get('/healthcheck', (req, res) => {
  database.query('SELECT 1', (err) => {
    if (err) return res.status(500).send('❌ DB Connection Error: ' + err.message);
    res.send('✅ Server and DB OK');
  });
});

// Static pages
app.get('/', (req, res) => res.render('Home'));
app.get('/about', (req, res) => res.render('about'));
app.get('/contact', (req, res) => res.render('contact'));
app.post('/contact/feedback', (req, res) => res.send('Thank you for the feedback'));

// Login routes
app.get('/login', (req, res) => res.render('Login'));

app.post('/login', (req, res) => {
  const { email, password } = req.body;
  database.query('SELECT * FROM signup WHERE email = ? AND password = ?', [email, password], (err, results) => {
    if (err) return res.send('Server error');
    if (results.length) {
      req.session.username = results[0].username;
      res.redirect('/mainPage');
    } else {
      res.send('Invalid credentials');
    }
  });
});

// Logout route
app.get('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) console.error('Logout error:', err);
    res.redirect('/');
  });
});

// Signup routes
app.get('/signup', (req, res) => res.render('signup'));

app.post('/signup', (req, res) => {
  const { username, email, password } = req.body;
  database.query('SELECT * FROM signup WHERE username = ? OR email = ?', [username, email], (err, results) => {
    if (err) return res.send('Server error');
    if (results.length) return res.send('Username or email already taken');

    database.query('INSERT INTO signup (username, email, password) VALUES (?, ?, ?)', [username, email, password], (err) => {
      if (err) return res.send('Database error');
      req.session.username = username;
      res.redirect('/mainPage');
    });
  });
});

// Main Page
app.get('/mainPage', isAuthenticated, (req, res) => {
  res.render('mainPage', { username: req.session.username });
});

// Diary Routes
app.get(['/mainPage/diary/:username', '/mainPage/diary_main/:username'], isAuthenticated, (req, res) => {
  const username = req.params.username || req.session.username;
  const query = `
    SELECT d.id, d.title, d.content, d.created_at
    FROM diary d
    JOIN signup s ON d.user_id = s.id
    WHERE s.username = ?
    ORDER BY d.created_at DESC
  `;
  database.query(query, [username], (err, results) => {
    if (err) return res.send('Error fetching diary entries');
    res.render('diary', { username, records: results });
  });
});

app.post('/mainPage/diary/:username', isAuthenticated, (req, res) => {
  const { username } = req.params;
  const { title, content } = req.body;

  getUserId(username, (err, user_id) => {
    if (err) return res.status(404).send('User not found');
    const query = 'INSERT INTO diary (user_id, title, content, created_at) VALUES (?, ?, ?, NOW())';
    database.query(query, [user_id, title, content], (err) => {
      if (err) return res.status(500).send('Failed to add diary entry');
      res.redirect(`/mainPage/diary/${username}`);
    });
  });
});

app.put('/mainPage/diary/:username/edit/:id', isAuthenticated, (req, res) => {
  const { id, username } = req.params;
  const { title, content } = req.body;
  const query = 'UPDATE diary SET title = ?, content = ? WHERE id = ?';

  database.query(query, [title, content, id], (err) => {
    if (err) return res.send('Failed to update entry');
    res.redirect(`/mainPage/diary/${username}`);
  });
});

app.delete('/mainPage/diary/:username/delete/:id', isAuthenticated, (req, res) => {
  const { id, username } = req.params;
  database.query('DELETE FROM diary WHERE id = ?', [id], (err) => {
    if (err) return res.send('Failed to delete entry');
    res.redirect(`/mainPage/diary/${username}`);
  });
});

// Memory Routes
app.get(['/mainPage/memory/:username', '/mainPage/memory-entry/:username'], isAuthenticated, (req, res) => {
  const username = req.params.username || req.session.username;
  const query = `
    SELECT d.id, d.title, d.content, d.created_at
    FROM memory d
    JOIN signup s ON d.user_id = s.id
    WHERE s.username = ?
    ORDER BY d.created_at DESC
  `;
  database.query(query, [username], (err, results) => {
    if (err) return res.send('Error fetching memory entries');
    res.render('memory', { username, records: results });
  });
});

app.post('/mainPage/memory/:username', isAuthenticated, (req, res) => {
  const { username } = req.params;
  const { title, content } = req.body;

  getUserId(username, (err, user_id) => {
    if (err) return res.status(404).send('User not found');
    const query = 'INSERT INTO memory (user_id, title, content, created_at) VALUES (?, ?, ?, NOW())';
    database.query(query, [user_id, title, content], (err) => {
      if (err) return res.status(500).send('Failed to add memory entry');
      res.redirect(`/mainPage/memory/${username}`);
    });
  });
});

app.put('/mainPage/memory/:username/edit/:id', isAuthenticated, (req, res) => {
  const { id, username } = req.params;
  const { title, content } = req.body;
  const query = 'UPDATE memory SET title = ?, content = ? WHERE id = ?';

  database.query(query, [title, content, id], (err) => {
    if (err) return res.send('Failed to update entry');
    res.redirect(`/mainPage/memory/${username}`);
  });
});

app.delete('/mainPage/memory/:username/delete/:id', isAuthenticated, (req, res) => {
  const { id, username } = req.params;
  const query = 'DELETE FROM memory WHERE id = ?';
  database.query(query, [id], (err) => {
    if (err) return res.send('Failed to delete entry');
    res.redirect(`/mainPage/memory/${username}`);
  });
});

// Finance Routes
app.get('/mainPage/finance/:username', isAuthenticated, (req, res) => {
  const username = req.params.username || req.session.username;
  const query = `
    SELECT f.id, f.description, f.amount, f.category, f.date, f.created_at
    FROM finance f
    JOIN signup s ON s.id = f.user_id
    WHERE s.username = ?
    ORDER BY f.created_at DESC
  `;
  database.query(query, [username], (err, results) => {
    if (err) return res.send('Error fetching finance records: ' + err.message);
    res.render('finance', { username, records: results });
  });
});

app.post('/mainPage/finance/:username', isAuthenticated, (req, res) => {
  const { username } = req.params;
  const { description, amount, category, date } = req.body;

  getUserId(username, (err, user_id) => {
    if (err) return res.status(404).send('User not found');
    const query = 'INSERT INTO finance(user_id, description, amount, category, date, created_at) VALUES (?, ?, ?, ?, ?, NOW())';
    database.query(query, [user_id, description, amount, category, date], (err) => {
      if (err) return res.send('Error while inserting: ' + err.message);
      res.redirect(`/mainPage/finance/${username}`);
    });
  });
});

app.put('/mainPage/finance/:username/edit/:id', isAuthenticated, (req, res) => {
  const { username, id } = req.params;
  const { description, amount, category, date } = req.body;
  const query = 'UPDATE finance SET description = ?, amount = ?, category = ?, date = ? WHERE id = ?';

  database.query(query, [description, amount, category, date, id], (err) => {
    if (err) return res.send('Failed to update finance record');
    res.redirect(`/mainPage/finance/${username}`);
  });
});

app.delete('/mainPage/finance/:username/delete/:id', isAuthenticated, (req, res) => {
  const { id, username } = req.params;
  database.query('DELETE FROM finance WHERE id = ?', [id], (err) => {
    if (err) return res.send('Failed to delete finance record');
    res.redirect(`/mainPage/finance/${username}`);
  });
});

// 404 Not Found handler (optional)
app.use((req, res) => {
  res.status(404).send('Page not found');
});

// Start server
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Server started on port ${PORT}`));
