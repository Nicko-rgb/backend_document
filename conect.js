const express = require('express');
const app = express();
const mongoose = require('mongoose');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const nodemailer = require('nodemailer'); //para enviar email
require('dotenv').config(); // Asegúrate de tener dotenv instalado

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
        // Verificar si el email ya está registrado
        const existingAdmin = await Admin.findOne({ email });
        if (existingAdmin) {
            return res.status(409).json({ message: 'El correo electrónico ya está registrado.' }); // Cambiar a 409 (Conflicto)
        }

        // Hashear la contraseña antes de guardarla
        const hashedPassword = await bcrypt.hash(password, 10);

        const newAdmin = new Admin({ carrera, admin, email, password: hashedPassword });
        await newAdmin.save();
        res.status(201).json({ message: 'Administrador registrado exitosamente' });
    } catch (error) {
        console.error('Error al registrar el administrador:', error);
        res.status(500).json({ message: 'Error al registrar el administrador', error });
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
        const user = await Admin.findOne({ admin });
        if (!user) {
            return res.status(401).json({ message: 'Credenciales inválidas' });
        }

        // Comparar la contraseña hasheada con la contraseña proporcionada
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
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
// Definir el modelo para los tokens de recuperación de contraseña
const tokenPasswordSchema = new mongoose.Schema({
    email: { type: String, required: true },
    token: { type: String, required: true },
    createdAt: { type: Date, default: Date.now, expires: '1h' }, // El token expirará en 1 hora
});

const TokenPassword = mongoose.model('TokenPassword', tokenPasswordSchema);

// Configura el transportador de Nodemailer
const transporter = nodemailer.createTransport({
    service: 'gmail', // o el servicio de correo que estés utilizando
    auth: {
        user: 'mancillanixon7@gmail.com',
        pass: 'aylt pjvp qivj rbrt' // Asegúrate de usar un método seguro para manejar las contraseñas
    }
});
// Ruta para solicitar el restablecimiento de contraseña
app.post('/api/reset-password', async (req, res) => {
    const { email } = req.body;

    try {
        // Verificar si el email existe en la base de datos
        const admin = await Admin.findOne({ email });
        if (!admin) {
            return res.status(404).send('No se encontró un administrador con este correo electrónico');
        }

        // Generar un token único
        const token = crypto.randomBytes(20).toString('hex');

        // Guardar el token en la base de datos
        const tokenEntry = new TokenPassword({ email, token });
        await tokenEntry.save();

        // Enviar el correo electrónico con el enlace para restablecer la contraseña
        const resetLink = `http://tu_dominio.com/reset-password/${token}`; // Cambia esto a tu dominio real
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'Restablecimiento de Contraseña',
            text: `Haz clic en el siguiente enlace para restablecer tu contraseña: ${resetLink}`,
        };

        await transporter.sendMail(mailOptions);
        res.send('Se ha enviado un enlace para restablecer tu contraseña a tu correo electrónico.');
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Error al procesar la solicitud');
    }
});

// Ruta para verificar el token y mostrar el formulario para restablecer la contraseña
app.get('/api/reset-password/:token', async (req, res) => {
    const { token } = req.params;

    try {
        // Verificar si el token es válido y no ha expirado
        const tokenEntry = await TokenPassword.findOne({ token });
        if (!tokenEntry) {
            return res.status(401).send('Token inválido o expirado');
        }

        // Aquí podrías enviar una respuesta que permita al cliente mostrar el formulario
        res.status(200).send('Token válido. Puedes restablecer tu contraseña.');
    } catch (error) {
        console.error('Error al verificar el token:', error);
        res.status(500).send('Error al verificar el token');
    }
});

// Ruta para restablecer la contraseña
app.post('/api/new-password', async (req, res) => {
    const { token, newPassword } = req.body;

    try {
        // Verificar si el token es válido y no ha expirado
        const tokenEntry = await TokenPassword.findOne({ token });
        if (!tokenEntry) {
            return res.status(401).send('Token inválido o expirado');
        }

        // Actualizar la contraseña del administrador
        const hashedPassword = bcrypt.hashSync(newPassword, 10); // Hashear la nueva contraseña
        await Admin.updateOne({ email: tokenEntry.email }, { password: hashedPassword });

        // Eliminar el token de la base de datos
        await TokenPassword.deleteOne({ token });

        res.send('Contraseña restablecida exitosamente');
    } catch (error) {
        console.error('Error al restablecer la contraseña:', error);
        res.status(500).send('Error al restablecer la contraseña');
    }
});


// Iniciar el servidor
const port = process.env.PORT || 8080;
app.listen(port, () => {
    console.log('\x1b[32mServidor Iniciado en el puerto \x1b[0m', port);
});