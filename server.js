const express = require('express');
const mysql = require('mysql2/promise');
const path = require('path');
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
      CREATE TABLE IF NOT EXISTS notas (
        ID INT AUTO_INCREMENT PRIMARY KEY,
        Titulo VARCHAR(255) NOT NULL,
        Contenido TEXT NOT NULL,
        categoria ENUM('politica', 'deportes', 'tecnologia', 'economia', 'salud', 'entretenimiento') NOT NULL,
        imagen VARCHAR(255),
        visible BOOLEAN DEFAULT TRUE,
        autorID INT,
        FechaCreacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        fechaActualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

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
      SELECT n.*, 
      (SELECT COUNT(*) FROM nota_imagenes ni WHERE ni.notaID = n.ID) > 0 AS hasImages
      FROM notas n 
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
      'SELECT n.* FROM notas n WHERE n.ID = ? AND n.visible = TRUE',
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

// Get first image for a note (used in card view)
app.get('/api/notas/:id/imagenes', async (req, res) => {
  try {
    const firstOnly = req.query.first === 'true';
    let query = 'SELECT imagen, mime_type FROM nota_imagenes WHERE notaID = ? ORDER BY orden';
    
    if (firstOnly) {
      query += ' LIMIT 1';
    }

    const [rows] = await pool.execute(query, [req.params.id]);
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'No images found' });
    }

    if (firstOnly) {
      const row = rows[0];
      res.set('Content-Type', row.mime_type);
      res.send(row.imagen);
    } else {
      res.json(rows.map(row => ({
        data: row.imagen.toString('base64'),
        mimeType: row.mime_type
      })));
    }
  } catch (error) {
    console.error('Error fetching images:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/nota/:id', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'nota-detalle.html'));
});

// Initialize database and start server
initDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`Public Server running on port ${PORT}`);
  });
}).catch(console.error);

module.exports = app;