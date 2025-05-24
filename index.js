const express = require('express');
const path = require('path');
const session = require('express-session');
const MySQLStore = require('connect-mysql')(session);
const methodOverride = require('method-override');
const bcrypt = require('bcrypt');
const database = require('./database/lifeVault_db');
require('dotenv').config();

const app = express();

// Middleware setup
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(methodOverride('_method'));

// Session config with MySQLStore
app.use(
  session({
    store: new MySQLStore({
      pool: database,
      table: 'sessions',
      clearExpired: true,
      checkExpirationInterval: 900000, // 15 minutes
    }),
    secret: process.env.SESSION_SECRET || 'atif-khan',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: process.env.NODE_ENV === 'production', maxAge: 24 * 60 * 60 * 1000 }, // 1 day
  })
);

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Auth middleware
function isAuthenticated(req, res, next) {
  if (req.session.username) return next();
  res.redirect('/login');
}

// Helper to get user id by username
async function getUserId(username) {
  try {
    const [results] = await database.query('SELECT id FROM signup WHERE username = ?', [username]);
    if (!results.length) throw new Error('User not found');
    return results[0].id;
  } catch (err) {
    console.error('getUserId error:', err);
    throw err;
  }
}

// Health check endpoint
app.get('/healthcheck', async (req, res) => {
  try {
    await database.query('SELECT 1');
    res.send('✅ Server and DB OK');
  } catch (err) {
    console.error('Healthcheck error:', err);
    res.status(500).send('❌ DB Connection Error: ' + err.message);
  }
});

// Static pages
app.get('/', (req, res) => res.render('Home'));
app.get('/about', (req, res) => res.render('about'));
app.get('/contact', (req, res) => res.render('contact'));
app.post('/contact/feedback', (req, res) => res.send('Thank you for the feedback'));

// Login routes
app.get('/login', (req, res) => res.render('Login'));

app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    console.log('Login attempt:', { email, password: '[hidden]' });
    const [results] = await database.query('SELECT * FROM signup WHERE email = ?', [email]);
    if (results.length && (await bcrypt.compare(password, results[0].password))) {
      req.session.username = results[0].username;
      res.redirect('/mainPage');
    } else {
      res.send('Invalid credentials');
    }
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).send('Server error');
  }
});

// Logout route
app.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) console.error('Logout error:', err);
    res.redirect('/');
  });
});

// Signup routes
app.get('/signup', (req, res) => res.render('signup'));

app.post('/signup', async (req, res) => {
  const { username, email, password } = req.body;
  try {
    console.log('Signup attempt:', { username, email, password: '[hidden]' });
    const [results] = await database.query('SELECT * FROM signup WHERE username = ? OR email = ?', [username, email]);
    if (results.length) return res.send('Username or email already taken');

    const hashedPassword = await bcrypt.hash(password, 10);
    await database.query('INSERT INTO signup (username, email, password) VALUES (?, ?, ?)', [
      username,
      email,
      hashedPassword,
    ]);
    req.session.username = username;
    res.redirect('/mainPage');
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).send('Server error');
  }
});

// Main Page
app.get('/mainPage', isAuthenticated, (req, res) => {
  res.render('mainPage', { username: req.session.username });
});

// Diary Routes
app.get(['/mainPage/diary/:username', '/mainPage/diary_main/:username'], isAuthenticated, async (req, res) => {
  const username = req.params.username || req.session.username;
  try {
    const [results] = await database.query(
      `
      SELECT d.id, d.title, d.content, d.created_at
      FROM diary d
      JOIN signup s ON d.user_id = s.id
      WHERE s.username = ?
      ORDER BY d.created_at DESC
    `,
      [username]
    );
    res.render('diary', { username, records: results });
  } catch (err) {
    console.error('Diary fetch error:', err);
    res.status(500).send('Error fetching diary entries');
  }
});

app.post('/mainPage/diary/:username', isAuthenticated, async (req, res) => {
  const { username } = req.params;
  const { title, content } = req.body;
  try {
    const user_id = await getUserId(username);
    await database.query('INSERT INTO diary (user_id, title, content, created_at) VALUES (?, ?, ?, NOW())', [
      user_id,
      title,
      content,
    ]);
    res.redirect(`/mainPage/diary/${username}`);
  } catch (err) {
    console.error('Diary insert error:', err);
    res.status(500).send(err.message === 'User not found' ? 'User not found' : 'Failed to add diary entry');
  }
});

app.put('/mainPage/diary/:username/edit/:id', isAuthenticated, async (req, res) => {
  const { id, username } = req.params;
  const { title, content } = req.body;
  try {
    await database.query('UPDATE diary SET title = ?, content = ? WHERE id = ?', [title, content, id]);
    res.redirect(`/mainPage/diary/${username}`);
  } catch (err) {
    console.error('Diary update error:', err);
    res.status(500).send('Failed to update entry');
  }
});

app.delete('/mainPage/diary/:username/delete/:id', isAuthenticated, async (req, res) => {
  const { id, username } = req.params;
  try {
    await database.query('DELETE FROM diary WHERE id = ?', [id]);
    res.redirect(`/mainPage/diary/${username}`);
  } catch (err) {
    console.error('Diary delete error:', err);
    res.status(500).send('Failed to delete entry');
  }
});

// Memory Routes
app.get(['/mainPage/memory/:username', '/mainPage/memory-entry/:username'], isAuthenticated, async (req, res) => {
  const username = req.params.username || req.session.username;
  try {
    const [results] = await database.query(
      `
      SELECT d.id, d.title, d.content, d.created_at
      FROM memory d
      JOIN signup s ON d.user_id = s.id
      WHERE s.username = ?
      ORDER BY d.created_at DESC
    `,
      [username]
    );
    res.render('memory', { username, records: results });
  } catch (err) {
    console.error('Memory fetch error:', err);
    res.status(500).send('Error fetching memory entries');
  }
});

app.post('/mainPage/memory/:username', isAuthenticated, async (req, res) => {
  const { username } = req.params;
  const { title, content } = req.body;
  try {
    const user_id = await getUserId(username);
    await database.query('INSERT INTO memory (user_id, title, content, created_at) VALUES (?, ?, ?, NOW())', [
      user_id,
      title,
      content,
    ]);
    res.redirect(`/mainPage/memory/${username}`);
  } catch (err) {
    console.error('Memory insert error:', err);
    res.status(500).send(err.message === 'User not found' ? 'User not found' : 'Failed to add memory entry');
  }
});

app.put('/mainPage/memory/:username/edit/:id', isAuthenticated, async (req, res) => {
  const { id, username } = req.params;
  const { title, content } = req.body;
  try {
    await database.query('UPDATE memory SET title = ?, content = ? WHERE id = ?', [title, content, id]);
    res.redirect(`/mainPage/memory/${username}`);
  } catch (err) {
    console.error('Memory update error:', err);
    res.status(500).send('Failed to update entry');
  }
});

app.delete('/mainPage/memory/:username/delete/:id', isAuthenticated, async (req, res) => {
  const { id, username } = req.params;
  try {
    await database.query('DELETE FROM memory WHERE id = ?', [id]);
    res.redirect(`/mainPage/memory/${username}`);
  } catch (err) {
    console.error('Memory delete error:', err);
    res.status(500).send('Failed to delete entry');
  }
});

// Finance Routes
app.get('/mainPage/finance/:username', isAuthenticated, async (req, res) => {
  const username = req.params.username || req.session.username;
  try {
    const [results] = await database.query(
      `
      SELECT f.id, f.description, f.amount, f.category, f.date, f.created_at
      FROM finance f
      JOIN signup s ON s.id = f.user_id
      WHERE s.username = ?
      ORDER BY f.created_at DESC
    `,
      [username]
    );
    res.render('finance', { username, records: results });
  } catch (err) {
    console.error('Finance fetch error:', err);
    res.status(500).send('Error fetching finance records: ' + err.message);
  }
});

app.post('/mainPage/finance/:username', isAuthenticated, async (req, res) => {
  const { username } = req.params;
  const { description, amount, category, date } = req.body;
  try {
    const user_id = await getUserId(username);
    await database.query(
      'INSERT INTO finance(user_id, description, amount, category, date, created_at) VALUES (?, ?, ?, ?, ?, NOW())',
      [user_id, description, amount, category, date]
    );
    res.redirect(`/mainPage/finance/${username}`);
  } catch (err) {
    console.error('Finance insert error:', err);
    res.status(500).send(err.message === 'User not found' ? 'User not found' : 'Error while inserting: ' + err.message);
  }
});

app.put('/mainPage/finance/:username/edit/:id', isAuthenticated, async (req, res) => {
  const { username, id } = req.params;
  const { description, amount, category, date } = req.body;
  try {
    await database.query('UPDATE finance SET description = ?, amount = ?, category = ?, date = ? WHERE id = ?', [
      description,
      amount,
      category,
      date,
      id,
    ]);
    res.redirect(`/mainPage/finance/${username}`);
  } catch (err) {
    console.error('Finance update error:', err);
    res.status(500).send('Failed to update finance record');
  }
});

app.delete('/mainPage/finance/:username/delete/:id', isAuthenticated, async (req, res) => {
  const { id, username } = req.params;
  try {
    await database.query('DELETE FROM finance WHERE id = ?', [id]);
    res.redirect(`/mainPage/finance/${username}`);
  } catch (err) {
    console.error('Finance delete error:', err);
    res.status(500).send('Failed to delete finance record');
  }
});

// 404 Not Found handler
app.use((req, res) => {
  res.status(404).send('Page not found');
});

// Start server
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server started on port ${PORT}`));