import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import crypto from "crypto";

dotenv.config();
const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static("public"));

// ============================================================
// 🔐 CONFIGURAÇÕES
// ============================================================
const JWT_SECRET = process.env.JWT_SECRET || "segredo";
const ENCRYPT_KEY = process.env.ENCRYPT_KEY || crypto.randomBytes(32).toString("hex");

// ============================================================
// ☁️ CLOUDINARY CONFIG
// ============================================================
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ============================================================
// 🗂️ MULTER (upload temporário de imagem)
// ============================================================
const storage = multer.memoryStorage();
const upload = multer({ storage });

// ============================================================
// 🔒 CRIPTOGRAFIA AUXILIAR
// ============================================================
function encrypt(text) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", Buffer.from(ENCRYPT_KEY, "hex"), iv);
  let encrypted = cipher.update(text, "utf8", "base64");
  encrypted += cipher.final("base64");
  return iv.toString("base64") + ":" + encrypted;
}

function decrypt(text) {
  try {
    const [iv, encryptedData] = text.split(":");
    const decipher = crypto.createDecipheriv(
      "aes-256-cbc",
      Buffer.from(ENCRYPT_KEY, "hex"),
      Buffer.from(iv, "base64")
    );
    let decrypted = decipher.update(encryptedData, "base64", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch {
    return text;
  }
}

// ============================================================
// 📦 MONGODB
// ============================================================
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("✅ Conectado ao MongoDB Atlas"))
  .catch((err) => console.error("❌ Erro MongoDB:", err));

// ============================================================
// 👥 MODELOS
// ============================================================
const userSchema = new mongoose.Schema({
  userId: { type: String, unique: true },
  nome: String,
  email: String,
  senhaHash: String,
  categoria: String, // ADMIN, RH, VENDEDOR
  turno: String, // MANHA, TARDE
  cpfCripto: String,
  telefoneCripto: String,
  dataAdmissao: Date,
});

const registroSchema = new mongoose.Schema({
  userId: String,
  tipo: String,
  dataHora: Date,
  fotoUrl: String,
});

const feriasSchema = new mongoose.Schema({
  userId: String,
  inicio: Date,
  fim: Date,
  tipo: String, // 30dias ou 15/15
  status: String, // solicitada, aprovada, negada
});

const User = mongoose.model("User", userSchema);
const Registro = mongoose.model("Registro", registroSchema);
const Ferias = mongoose.model("Ferias", feriasSchema);

// ============================================================
// 🧑‍💼 ADMIN DEFAULT
// ============================================================
async function seedAdmin() {
  const adminEmail = "admin@empresa.com";
  const admin = await User.findOne({ email: adminEmail });
  if (!admin) {
    const senha = "admin123";
    const novo = new User({
      userId: crypto.randomUUID(),
      nome: "Administrador Master",
      email: adminEmail,
      senhaHash: bcrypt.hashSync(senha, 10),
      categoria: "ADMIN",
      cpfCripto: encrypt("00000000000"),
      telefoneCripto: encrypt("11900000000"),
      dataAdmissao: new Date(),
    });
    await novo.save();
    console.log(`👑 Admin criado: ${adminEmail} | senha: ${senha}`);
  }
}
seedAdmin();

// ============================================================
// 🔑 AUTENTICAÇÃO JWT
// ============================================================
function gerarToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: "8h" });
}

function autenticarJWT(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Token ausente." });
  try {
    const dec = jwt.verify(token, JWT_SECRET);
    req.userId = dec.userId;
    next();
  } catch {
    res.status(403).json({ error: "Token inválido." });
  }
}

// ============================================================
// 🔐 LOGIN
// ============================================================
app.post("/login", async (req, res) => {
  const { email, senha } = req.body;
  const user = await User.findOne({ email });
  if (!user) return res.status(400).json({ error: "Usuário não encontrado." });
  const ok = bcrypt.compareSync(senha, user.senhaHash);
  if (!ok) return res.status(400).json({ error: "Senha incorreta." });

  const token = gerarToken(user._id);
  res.json({
    token,
    usuario: {
      nome: user.nome,
      email: user.email,
      categoria: user.categoria,
      turno: user.turno,
    },
  });
});

// ============================================================
// 👥 ADMIN: LISTAR FUNCIONÁRIOS
// ============================================================
app.get("/admin/funcionarios", autenticarJWT, async (req, res) => {
  const users = await User.find();
  res.json(users);
});

// ============================================================
// ➕ ADMIN: CRIAR FUNCIONÁRIO
// ============================================================
app.post("/admin/criar-funcionario", autenticarJWT, async (req, res) => {
  try {
    const { nome, email, cpf, telefone, categoria, turno, dataAdmissao } = req.body;
    const senhaGerada = cpf.slice(0, 5);
    const novo = new User({
      userId: crypto.randomUUID(),
      nome,
      email,
      senhaHash: bcrypt.hashSync(senhaGerada, 10),
      categoria,
      turno,
      cpfCripto: encrypt(cpf),
      telefoneCripto: encrypt(telefone),
      dataAdmissao: new Date(dataAdmissao),
    });
    await novo.save();
    res.json({ sucesso: true, senhaGerada });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao cadastrar funcionário." });
  }
});

// ============================================================
// 📸 REGISTRAR PONTO (Respeitando horários)
// ============================================================
app.post("/ponto/registrar", autenticarJWT, upload.single("foto"), async (req, res) => {
  try {
    const { tipo } = req.body;
    const usuario = await User.findById(req.userId);
    if (!usuario) return res.status(404).json({ error: "Usuário não encontrado." });

    const agora = new Date();
    const horaAtual = agora.getHours() + agora.getMinutes() / 60;

    let inicio, fim;
    if (usuario.categoria === "RH") {
      inicio = 9;
      fim = 18;
    } else if (usuario.categoria === "VENDEDOR") {
      inicio = usuario.turno === "MANHA" ? 10 : 16;
      fim = usuario.turno === "MANHA" ? 16 : 22;
    }

    const inicioPermitido = inicio - 0.25;
    const fimPermitido = fim + 0.25;

    if (horaAtual < inicioPermitido || horaAtual > fimPermitido) {
      return res.status(403).json({
        error: `Fora do horário permitido para registrar ponto (${inicio}:00–${fim}:00).`,
      });
    }

    // Upload da foto (se houver)
    let urlFoto = null;
    if (req.file) {
      const result = await cloudinary.uploader.upload_stream(
        { folder: "ponto_digital" },
        (error, result) => {
          if (error) console.error(error);
          else urlFoto = result.secure_url;
        }
      );
    }

    await Registro.create({
      userId: usuario._id,
      tipo,
      dataHora: agora,
      fotoUrl: urlFoto,
    });

    res.json({ sucesso: true, msg: "Ponto registrado com sucesso!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao registrar ponto." });
  }
});

// ============================================================
// 🌴 STATUS DE FÉRIAS
// ============================================================
app.get("/ferias/info", autenticarJWT, async (req, res) => {
  const user = await User.findById(req.userId);
  if (!user || !user.dataAdmissao) return res.json({ statusFerias: null });

  const adm = new Date(user.dataAdmissao);
  const proximo = new Date(adm);
  proximo.setFullYear(adm.getFullYear() + 1);

  const hoje = new Date();
  const diff = Math.floor((proximo - hoje) / (1000 * 60 * 60 * 24));

  let statusFerias = "✅ Férias em dia.";
  if (diff <= 0) statusFerias = `⚠️ Férias vencidas há ${Math.abs(diff)} dias.`;
  else if (diff <= 30) statusFerias = `⚠️ Férias vencem em ${diff} dias.`;

  res.json({ statusFerias });
});

// ============================================================
// 🚀 SERVER START
// ============================================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Servidor rodando na porta ${PORT}`));
