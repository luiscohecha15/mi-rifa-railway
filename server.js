// --- 1. Importar las librerías ---
const express = require('express');
const mysql = require('mysql2/promise'); // Usamos 'promise' para código más limpio
const cors = require('cors');
require('dotenv').config(); // Para leer variables de entorno (aunque Railway las inyecta)

const app = express();
// Railway te dará un puerto, o usamos el 3000 para pruebas locales
const PORT = process.env.PORT || 3000;

// --- 2. Middlewares ---
app.use(cors()); // Permite que tu frontend (en otro dominio) hable con este backend
app.use(express.json()); // Permite al servidor entender JSON (que enviaremos desde el frontend)
app.use(express.static('public')); // Sirve tu 'index.html' desde la carpeta 'public'

let pool; // La conexión a la base de datos

// --- 3. Función para Conectar a MySQL y Crear la Tabla ---
async function initDB() {
  try {
    // Railway provee la URL de conexión en una sola variable
    // Si no existe (ej. en local), usa las variables individuales
    const connectionUrl = process.env.DATABASE_URL || 
      `mysql://${process.env.MYSQLUSER}:${process.env.MYSQLPASSWORD}@${process.env.MYSQLHOST}:${process.env.MYSQLPORT}/${process.env.MYSQLDATABASE}`;

    pool = mysql.createPool(connectionUrl);

    // Conectar y crear la tabla si no existe
    await pool.query(`
      CREATE TABLE IF NOT EXISTS rifa (
        number INT PRIMARY KEY,
        name VARCHAR(255) NOT NULL
      );
    `);
    console.log('Base de datos conectada y tabla rifa asegurada.');
    console.log(connectionUrl ? 'DATABASE_URL encontrada.' : 'Usando variables individuales de DB.');
  } catch (error) {
    console.error('Error al conectar o inicializar la DB:', error);
  }
}

// --- 4. Las Rutas de la API (La comunicación) ---

// [GET] /api/numbers
// Devuelve TODOS los números guardados
app.get('/api/numbers', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM rifa');
    // Transforma el array [ {number: 5, name: "Ana"} ]
    // en un objeto { 5: "Ana" } para que el frontend lo entienda
    const data = rows.reduce((acc, row) => {
      acc[row.number] = row.name;
      return acc;
    }, {});
    res.json(data);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener números', error });
  }
});

// [POST] /api/save
// Guarda o actualiza un número
app.post('/api/save', async (req, res) => {
  const { number, name } = req.body;

  if (name === null || name.trim() === '') {
    // Si el nombre está vacío, es una liberación
    return res.status(400).json({ message: 'El nombre no puede estar vacío. Use /api/release para liberar.' });
  }

  try {
    // 'INSERT ... ON DUPLICATE KEY UPDATE' es perfecto para esto:
    // Si el número (PRIMARY KEY) existe, actualiza el nombre.
    // Si no existe, inserta la nueva fila.
    const query = 'INSERT INTO rifa (number, name) VALUES (?, ?) ON DUPLICATE KEY UPDATE name = ?';
    await pool.query(query, [number, name, name]);
    res.json({ success: true, message: `Número ${number} guardado para ${name}` });
  } catch (error) {
    res.status(500).json({ message: 'Error al guardar el número', error });
  }
});

// [POST] /api/release
// Libera (elimina) un número
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