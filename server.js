// --- 1. Importar las librerías ---
const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// --- 2. Middlewares ---
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

let pool;

// --- 3. Función para Conectar a MySQL y Crear/Actualizar la Tabla ---
async function initDB() {
  try {
    const connectionUrl = process.env.DATABASE_URL || 
      `mysql://${process.env.MYSQLUSER}:${process.env.MYSQLPASSWORD}@${process.env.MYSQLHOST}:${process.env.MYSQLPORT}/${process.env.MYSQLDATABASE}`;

    pool = mysql.createPool(connectionUrl);

    // Paso A: Asegurar que la tabla base exista
    await pool.query(`
      CREATE TABLE IF NOT EXISTS rifa (
        number INT PRIMARY KEY,
        name VARCHAR(255) NOT NULL
      );
    `);
    
    // Paso B: AÑADIR LA NUEVA COLUMNA 'is_paid' SI NO EXISTE
    // Lo hacemos en un try/catch separado por si la tabla ya existe
    // y solo queremos añadir la columna.
    try {
      await pool.query(`
        ALTER TABLE rifa ADD COLUMN is_paid BOOLEAN DEFAULT FALSE;
      `);
      console.log('Columna is_paid añadida/asegurada.');
    } catch (error) {
      // Si el error es 'ER_DUP_FIELDNAME', significa que la columna ya existe.
      // Lo ignoramos y continuamos.
      if (error.code !== 'ER_DUP_FIELDNAME') {
        throw error; // Lanzamos cualquier otro error
      }
    }
    
    console.log('Base de datos conectada y tabla rifa actualizada.');
  } catch (error) {
    console.error('Error al conectar o inicializar la DB:', error);
  }
}

// --- 4. Las Rutas de la API (La comunicación) ---

// [GET] /api/numbers
// Devuelve TODOS los números guardados (AHORA CON ESTADO DE PAGO)
app.get('/api/numbers', async (req, res) => {
  try {
    // SELECT * traerá 'number', 'name', y 'is_paid'
    const [rows] = await pool.query('SELECT * FROM rifa');
    
    // Transformamos el array en un objeto para el frontend
    // La data ahora será: { 5: { name: "Ana", is_paid: 1 }, 10: { name: "Juan", is_paid: 0 } }
    const data = rows.reduce((acc, row) => {
      acc[row.number] = {
        name: row.name,
        // MySQL devuelve 1 o 0 para BOOLEAN, lo convertimos a true/false
        is_paid: !!row.is_paid 
      };
      return acc;
    }, {});
    res.json(data);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener números', error });
  }
});

// [POST] /api/save
// Guarda o actualiza un número (AHORA CON ESTADO DE PAGO)
app.post('/api/save', async (req, res) => {
  // Recibimos 'is_paid' (que será true o false)
  const { number, name, is_paid } = req.body;

  if (name === null || name.trim() === '') {
    return res.status(400).json({ message: 'El nombre no puede estar vacío.' });
  }

  try {
    // Actualizamos la consulta para incluir 'is_paid'
    const query = 'INSERT INTO rifa (number, name, is_paid) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE name = ?, is_paid = ?';
    // Pasamos los nuevos parámetros
    await pool.query(query, [number, name, is_paid, name, is_paid]);
    res.json({ success: true, message: `Número ${number} guardado para ${name}` });
  } catch (error) {
    res.status(500).json({ message: 'Error al guardar el número', error });
  }
});

// [POST] /api/release
// Libera (elimina) un número (SIN CAMBIOS)
app.post('/api/release', async (req, res) => {
  const { number } = req.body;
  try {
    const query = 'DELETE FROM rifa WHERE number = ?';
    await pool.query(query, [number]);
    res.json({ success: true, message: `Número ${number} liberado` });
  } catch (error) {
    res.status(500).json({ message: 'Error al liberar el número', error });
  }
});

// --- 5. Iniciar el Servidor ---
app.listen(PORT, async () => {
  await initDB(); // Conecta a la DB primero
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});