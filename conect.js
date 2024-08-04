const express = require('express');
const app = express();
const mongoose = require('mongoose');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const nodemailer = require('nodemailer'); //para enviar email


// Configurar el middleware para servir archivos estáticos
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Conectar a la base de datos MongoDB Atlas
// const uri = "mongodb://localhost:27017/system_documento";
const uri = "mongodb+srv://mancillanixon7:um8xTFnPbq9eMwnx@systemdsi.mouqdaf.mongodb.net/system_documento?retryWrites=true&w=majority";

mongoose.connect(uri)
    .then(() => console.log('Conectado a MongoDB Atlas!'))
    .catch((error) => console.error('Error conectando a MongoDB local:', error));

// Definir el modelo para registrar los documentos
const documentSchema = new mongoose.Schema({
    nombre: { type: String, required: true },
    apellido: { type: String, required: true },
    dni: { type: String, required: true },
    receptor: { type: String, required: true },
    emisor: { type: String, required: true },
    motivoArchivo: { type: String, required: true },
    archivo: {
        filename: { type: String },
        path: { type: String },
    },
    txtArchivo: { type: String },
    leido: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
});
const Document = mongoose.model('Document', documentSchema);

// Configurar Multer para manejar la subida de archivos
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/'); // Cambia a 'uploads/' si es necesario
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}${path.extname(file.originalname)}`);
    },
});

const upload = multer({ storage: storage });

// Middleware para parsear el cuerpo de las solicitudes
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configurar CORS "ESTO ES MUY IMPORTANTE"
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', 'https://system-document-suiza.vercel.app/'); // Reemplaza con el dominio de tu aplicación React
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    next();
});
app.use(cors());

// Ruta para guardar los documentos a la base de datos
app.post('/api/registrar', upload.single('archivo'), async (req, res) => {
    try {
        const { nombre, apellido, dni, receptor, emisor, motivoArchivo, txtArchivo } = req.body;
        const archivo = req.file ? { filename: req.file.filename, path: req.file.path } : null;

        // Validar que todos los campos requeridos estén presentes
        if (!nombre || !apellido || !dni || !receptor || !emisor || !motivoArchivo) {
            return res.status(400).json({ message: 'Todos los campos son requeridos' });
        }
        const newDocument = new Document({
            nombre,
            apellido,
            dni,
            receptor,
            emisor,
            motivoArchivo,
            archivo,
            txtArchivo,
            leido: false,
        });

        await newDocument.save();
        res.status(201).json({ message: 'Documento enviado - server' });
        console.log('Nuevo Documento Enviado - server');
    } catch (error) {
        console.error('Error al guardar el documento:', error);
        res.status(500).json({ message: 'Error al enviar el documento', error: error.message });
    }
});

// Definir el modelo para la colección "admins"
const adminSchema = new mongoose.Schema({
    carrera: { type: String, required: true },
    admin: { type: String, required: true },
    email: {type: String, require: true},
    password: { type: String, required: true },
});
const Admin = mongoose.model('admins', adminSchema);

// Ruta para registrar un nuevo administrador
app.post('/api/register/admins', async (req, res) => {
    const { carrera, admin, email, password } = req.body;

    try {
        const newAdmin = new Admin({ carrera, admin, email, password });
        await newAdmin.save();
        res.status(201).json({ message: 'Administrador registrado exitosamente' });
    } catch (error) {
        res.status(500).json({ message: 'Error al registrar el administrador', error });
    }
});

// Ruta para verificar si el email ya está registrado
app.post('/api/check-email', async (req, res) => {
    const { email } = req.body;

    try {
        const existingAdmin = await Admin.findOne({ email });
        if (existingAdmin) {
            return res.status(409).json({ message: 'El correo electrónico ya está registrado' });
        }
        res.status(200).json({ message: 'El correo electrónico está disponible' });
    } catch (error) {
        res.status(500).json({ message: 'Error al verificar el correo electrónico', error });
    }
});

// Ruta para obtener los datos de la colección "admins"
app.get('/api/admins', async (req, res) => {
    try {
        const admins = await Admin.find();
        res.status(200).json(admins);
    } catch (error) {
        console.error('Error al obtener los datos:', error);
        res.status(500).json({ message: 'Error al obtener los datos' });
    }
});

// Ruta para iniciar sesión
app.post('/api/login', async (req, res) => {
    try {
        const { admin, password } = req.body;
        const user = await Admin.findOne({ admin, password });
        if (!user) {
            return res.status(401).json({ message: 'Credenciales inválidas' });
        }

        // Obtener los documentos recibidos por la carrera del usuario
        const receivedDocuments = await Document.find({ receptor: user.carrera });

        // Obtener los documentos enviados por la carrera del usuario
        const sentDocuments = await Document.find({ emisor: user.carrera });

        res.json({ carrera: user.carrera, receivedDocuments, sentDocuments });
    } catch (error) {
        console.error('Error al iniciar sesión:', error);
        res.status(500).json({ message: 'Error al iniciar sesión' });
    }
});

// Ruta para actualizar el estado de un documento
app.patch('/api/documents/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { leido } = req.body;
        const updatedDocument = await Document.findByIdAndUpdate(id, { leido }, { new: true });
        res.status(200).json(updatedDocument);
    } catch (error) {
        console.error('Error al actualizar el documento:', error);
        res.status(500).json({ message: 'Error al actualizar el documento' });
    }
});

// Ruta para obtener todos los documentos
app.get('/api/documents', async (req, res) => {
    try {
        const documents = await Document.find();
        res.status(200).json(documents);
    } catch (error) {
        console.error('Error al obtener los documentos:', error);
        res.status(500).json({ message: 'Error al obtener los documentos' });
    }
});

////////////////////////////////////////////////////////////////////
// Configura el transportador de Nodemailer
const transporter = nodemailer.createTransport({
    service: 'gmail', // o el servicio de correo que estés utilizando
    auth: {
        user: 'mancillanixon7@gmail.com',
        pass: 'aylt pjvp qivj rbrt' // Asegúrate de usar un método seguro para manejar las contraseñas
    }
});


// Iniciar el servidor
const port = process.env.PORT || 8080;
app.listen(port, () => {
    console.log('\x1b[32mServidor Iniciado en el puerto \x1b[0m', port);
});