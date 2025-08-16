const express = require('express');
const mysql = require('mysql2/promise');
const path = require('path');
const fs = require('fs').promises;
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Database connection
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'Yorch0711!',
  database: process.env.DB_NAME || 'news_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

const pool = mysql.createPool(dbConfig);



// Initialize database tables
async function initDatabase() {
  try {
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS usuarios (
        ID INT AUTO_INCREMENT PRIMARY KEY,
        nombre VARCHAR(100) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        rol ENUM('admin', 'usuario') DEFAULT 'usuario',
        fechaCreacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.execute(`
      CREATE TABLE IF NOT EXISTS notas (
        ID INT AUTO_INCREMENT PRIMARY KEY,
        Titulo VARCHAR(255) NOT NULL,
        Contenido TEXT NOT NULL,
        categoria ENUM('politica', 'deportes', 'tecnologia', 'economia', 'salud', 'entretenimiento') NOT NULL,
        imagen VARCHAR(255),
        visible BOOLEAN DEFAULT TRUE,
        autorID INT,
        FechaCreacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        fechaActualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (autorID) REFERENCES usuarios(ID)
      )
    `);

    // Create default admin user if not exists
    const [existingAdmin] = await pool.execute('SELECT * FROM usuarios WHERE email = ?', ['admin@news.com']);
    if (existingAdmin.length === 0) {
      const hashedPassword = await bcrypt.hash('admin123', 10);
      await pool.execute(
        'INSERT INTO usuarios (nombre, email, password, rol) VALUES (?, ?, ?, ?)',
        ['Administrator', 'admin@news.com', hashedPassword, 'admin']
      );
    }

    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Error initializing database:', error);
  }
}

// Routes

// Public routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Get all visible news for public
app.get('/api/notas', async (req, res) => {
  try {
    const { categoria } = req.query;
    let query = `
      SELECT n.*, u.nombre as autor 
      FROM notas n 
      LEFT JOIN usuarios u ON n.autorID = u.ID 
      WHERE n.visible = TRUE
    `;
    const params = [];

    if (categoria && categoria !== 'todas') {
      query += ' AND n.categoria = ?';
      params.push(categoria);
    }

    query += ' ORDER BY n.FechaCreacion DESC';

    const [rows] = await pool.execute(query, params);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching news:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get single news article
app.get('/api/notas/:id', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT n.*, u.nombre as autor FROM notas n LEFT JOIN usuarios u ON n.autorID = u.ID WHERE n.ID = ? AND n.visible = TRUE',
      [req.params.id]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'News article not found' });
    }
    
    res.json(rows[0]);
  } catch (error) {
    console.error('Error fetching news article:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Initialize database and start server
initDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}).catch(console.error);

module.exports = app;