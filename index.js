    const express = require('express');
    const path = require('path');
    const session = require('express-session');
    const methodOverride = require('method-override');
    const database = require('./database/lifeVault_db');
    const { send } = require('process');
    const { queryObjects } = require('v8');
    require('dotenv').config();

    const app = express();

    app.use(express.urlencoded({ extended: true }));
    app.use(express.json());
    app.use(express.static(path.join(__dirname, 'public')));
    app.use(methodOverride('_method'));

    app.use(session({
        secret: 'atif-khan',
        resave: false,
        saveUninitialized: false,
    }));

    app.set('view engine', 'ejs');
    app.set('views', path.join(__dirname, 'views'));

    function isAuthenticated(req, res, next) {
        if (req.session.username) return next();
        res.redirect('/login');
    }

    app.get('/', (req, res) => {
        res.render('Home');
    });

    app.get('/login', (req, res) => {
        res.render('Login');
    });

    app.post('/login', (req, res) => {
        const { email, password } = req.body;

        database.query(
            'SELECT * FROM signup WHERE email = ? AND password = ?',
            [email, password],
            (err, results) => {
                if (err) {
                    console.error('Login error:', err);
                    return res.send('Server error');
                }
                if (results.length > 0) {
                    req.session.username = results[0].username;
                    res.redirect('/mainPage');
                } else {
                    res.send('Invalid credentials');
                }
            }
        );
    });

    app.get('/logout', (req, res) => {
        req.session.destroy(err => {
            if (err) console.error('Logout error:', err);
            res.redirect('/');
        });
    });

    app.get('/signup', (req, res) => {
        res.render('Signup');
    });

    app.post('/signup', (req, res) => {
        const { username, email, password } = req.body;

        database.query(
            'SELECT * FROM signup WHERE username = ? and email = ?',
            [username, email],
            (err, results) => {
                if (err) {
                    console.error('Signup error:', err);
                    return res.send('Server error');
                }
                if (results.length > 0) {
                    return res.send('Username or email already taken');
                }

                // Insert new user
                database.query(
                    'INSERT INTO signup (username, email, password) VALUES (?, ?, ?)',
                    [username, email, password],
                    (err) => {
                        if (err) {
                            console.error('Insert error:', err);
                            return res.send('Database error');
                        }
                        req.session.username = username;
                        res.redirect('/mainPage');
                    }
                );
            }
        );
    });
    app.get('/contact', (req, res) => res.render('contact'));
    app.get('/about', (req, res) => res.render('about'));

    app.get('/mainPage', isAuthenticated, (req, res) => {
        res.render('mainPage', { username: req.session.username });
    });

    function getUserId(username, callback) {
        database.query('SELECT id FROM signup WHERE username = ?', [username], (err, results) => {
            if (err) return callback(err);
            if (results.length === 0) return callback(new Error('User not found'));
            callback(null, results[0].id);
        });
    }

    // Diary routes

    app.get(['/mainPage/diary/:username', '/mainPage/diary_main/:username'], isAuthenticated, (req, res) => {
        const username = req.session.username;
        const query = `
            SELECT d.id, d.title, d.content, d.created_at
            FROM diary d
            JOIN signup s ON d.user_id = s.id
            WHERE s.username = ?
            ORDER BY d.created_at DESC
        `;

        database.query(query, [username], (err, results) => {
            if (err) {
                console.error('Fetch diary error:', err);
                return res.send('Error fetching diary entries');
            }
            res.render('diary', { username, records: results });
        });
    });

    app.post('/mainPage/diary/:username', isAuthenticated, (req, res) => {
        const { username } = req.params;
        const { title, content } = req.body;

        getUserId(username, (err, user_id) => {
            if (err) {
                console.error(err);
                return res.status(404).send('User not found');
            }
            const insertQuery = 'INSERT INTO diary (user_id, title, content, created_at) VALUES (?, ?, ?, NOW())';
            database.query(insertQuery, [user_id, title, content], (err) => {
                if (err) {
                    console.error('Insert diary error:', err);
                    return res.status(500).send('Failed to add diary entry');
                }
                res.redirect(`/mainPage/diary/${username}`);
            });
        });
    });

    app.put('/mainPage/diary/:username/edit/:id', isAuthenticated, (req, res) => {
        const { id, username } = req.params;
        const { title, content } = req.body;

        const updateQuery = 'UPDATE diary SET title = ?, content = ? WHERE id = ?';
        database.query(updateQuery, [title, content, id], (err) => {
            if (err) {
                console.error('Update diary error:', err);
                return res.send('Failed to update entry');
            }
            res.redirect(`/mainPage/diary/${username}`);
        });
    });

    app.delete('/mainPage/diary/:username/delete/:id', isAuthenticated, (req, res) => {
        const { id, username } = req.params;

        database.query('DELETE FROM diary WHERE id = ?', [id], (err) => {
            if (err) {
                console.error('Delete diary error:', err);
                return res.send('Failed to delete entry');
            }
            res.redirect(`/mainPage/diary/${username}`);
        });
    });

    // Memory routes 

    app.get(['/mainPage/memory/:username', '/mainPage/memory-entry/:username'], isAuthenticated, (req, res) => {
        const username = req.session.username;
        const query = `
            SELECT d.id, d.title, d.content, d.created_at
            FROM memory d
            JOIN signup s ON d.user_id = s.id
            WHERE s.username = ?
            ORDER BY d.created_at DESC
        `;

        database.query(query, [username], (err, results) => {
            if (err) {
                console.error('Fetch memory error:', err);
                return res.send('Error fetching memory entries');
            }
            res.render('memory', { username, records: results });
        });
    });


    app.post('/mainPage/memory/:username', isAuthenticated, (req, res) => {
        const { username } = req.params;
        const { title, content } = req.body;

        getUserId(username, (err, user_id) => {
            if (err) {
                console.error(err);
                return res.status(404).send('User not found');
            }
            const insertQuery = 'INSERT INTO memory (user_id, title, content, created_at) VALUES (?, ?, ?, NOW())';
            database.query(insertQuery, [user_id, title, content], (err) => {
                if (err) {
                    console.error('Insert memory error:', err);
                    return res.status(500).send('Failed to add memory entry');
                }
                res.redirect(`/mainPage/memory/${username}`);
            });
        });
    });

    app.put('/mainPage/memory/:username/edit/:id', isAuthenticated, (req, res) => {
        const { id, username } = req.params;
        const { title, content } = req.body;

        const updateQuery = 'UPDATE memory SET title = ?, content = ? WHERE id = ?';
        database.query(updateQuery, [title, content, id], (err) => {
            if (err) {
                console.error('Update memory error:', err);
                return res.send('Failed to update entry');
            }
            res.redirect(`/mainPage/memory/${username}`);
        });
    });

    app.delete('/mainPage/memory/:username/delete/:id', isAuthenticated, (req, res) => {
        const { id, username } = req.params;

        database.query('DELETE FROM memory WHERE id = ?', [id], (err) => {
            if (err) {
                console.error('Delete memory error:', err);
                return res.send('Failed to delete entry');
            }
            res.redirect(`/mainPage/memory/${username}`);
        });
    });

    app.get('/mainPage/finance/:username', isAuthenticated, (req, res) => {
        const username = req.session.username;
        
    

            const query = 
            'select f.id, f.description, f.amount, f.category, f.date, f.created_at from finance f join signup s on s.id = f.user_id order by f.created_at desc';
       database.query(query, (err, results) => {
    if (err) {
        return res.send('error while listing records ' + err);
    }
    res.render('finance', { username, records: results });
    });

        
    });

    app.post('/mainPage/finance/:username', (req, res)=>{
        let{username} = req.params;
        let{description, amount, category, date} = req.body;
        
      getUserId(username, (err, user_id)=>{
        if(err){
            return res.status(404).send("error in inserting record");
        }

        const query = 'insert into finance(user_id,description,amount,category,date, created_at) values(?,?,?,?,?,now())';
        database.query(query,[user_id,description, amount, category, date], (err, result)=>{
            if(err){
                return res.send('Error while insertin '+err);
            }
            res.redirect(`/mainPage/finance/${username}`);
        });
      })
    })

    app.put('/mainPage/finance/:username/edit/:id', (req, res)=>{
        const{username,id} = req.params;
        const{description, amount, category, date} = req.body;

    query = 
        'update finance set description = ?, amount = ?, category = ?, date = ?, created_at = now() where id = ?';

        database.query(query,[description, amount, category, date, id], (err, results)=>{
            if(err){
                return res.status(404).send(err);
            }

            res.redirect(`/mainPage/finance/${username}`);
        })

    })
    app.delete('/mainPage/finance/:username/delete/:id',(req, res)=>{
        const {username, id} = req.params;
        const query = 
        'delete from finance where id = ?';

        database.query(query,[id],(err, results)=>{
            if(err){
                return res.send(err);
            }
            res.redirect(`/mainPage/finance/${username}`)
        })
    });
    app.post('/contact/feedback',(req, res)=>{
        res.send('Thank you for the feedback');
    })

    app.use((req, res) => {
        res.status(404).render('404');
    });

    app.listen(3000, () => {
        console.log('App is listening on port 3000');
    });
