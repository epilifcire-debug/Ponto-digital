// ============================================================
// 🌐 PONTO DIGITAL – BACKEND COMPLETO (2025)
// ============================================================

import express from "express";
import cors from "cors";
import multer from "multer";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import crypto from "crypto";
import dotenv from "dotenv";
import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";

dotenv.config();
const app = express();

app.use(express.json());
app.use(cors());
app.use(express.static("public"));

// ============================================================
// ☁️ CLOUDINARY
// ============================================================
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "ponto-digital",
    allowed_formats: ["jpg", "jpeg", "png"],
  },
});
const upload = multer({ storage });

// ============================================================
// 🔐 CRIPTOGRAFIA AES-256-CBC
// ============================================================
const ENCRYPT_KEY = process.env.ENCRYPT_KEY;
function encrypt(text) {
  if (!text) return "";
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(
    "aes-256-cbc",
    Buffer.from(ENCRYPT_KEY, "hex"),
    iv
  );
  const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  return iv.toString("hex") + ":" + encrypted.toString("hex");
}
function decrypt(text) {
  try {
    if (!text || !text.includes(":")) return text;
    const [ivHex, contentHex] = text.split(":");
    const iv = Buffer.from(ivHex, "hex");
    const decipher = crypto.createDecipheriv(
      "aes-256-cbc",
      Buffer.from(ENCRYPT_KEY, "hex"),
      iv
    );
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(contentHex, "hex")),
      decipher.final(),
    ]);
    return decrypted.toString("utf8");
  } catch {
    return text;
  }
}

// ============================================================
// 🧩 MONGODB
// ============================================================
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("✅ Conectado ao MongoDB Atlas"))
  .catch((err) => console.error("❌ Erro MongoDB:", err));

const userSchema = new mongoose.Schema({
  nome: String,
  email: String,
  senhaHash: String,
  cpfCripto: String,
  telefoneCripto: String,
  categoria: String,
  turno: String,
  dataAdmissao: Date,
  jaTirouFerias: Boolean,
  formaUltimasFerias: String,
  dataUltimasFeriasInicio: Date,
  dataUltimasFeriasFim: Date,
});

const pontoSchema = new mongoose.Schema({
  userId: String,
  tipo: String,
  dataHora: Date,
  fotoUrl: String,
});

const feriasSchema = new mongoose.Schema({
  userId: String,
  tipo: String,
  dataInicio: Date,
  dataFim: Date,
  dias: Number,
  status: { type: String, default: "pendente" },
});

const User = mongoose.model("User", userSchema);
const Ponto = mongoose.model("Ponto", pontoSchema);
const Ferias = mongoose.model("Ferias", feriasSchema);

// ============================================================
// 🌱 SEED INICIAL
// ============================================================
async function seed() {
  if (await User.countDocuments()) return;
  console.log("🌱 Criando usuários padrão...");
  const base = [
    { nome: "Ana RH", email: "ana.rh@empresa.com", cpf: "12345678900", telefone: "11999999999", categoria: "RH", dataAdmissao: new Date("2023-01-02") },
    { nome: "Bruno Vendedor", email: "bruno@empresa.com", cpf: "98765432100", telefone: "11988888888", categoria: "VENDEDOR", turno: "MANHA", dataAdmissao: new Date("2023-02-10") },
  ];
  for (const u of base) {
    const senha = u.cpf.substring(0, 5);
    await new User({
      ...u,
      senhaHash: bcrypt.hashSync(senha, 10),
      cpfCripto: encrypt(u.cpf),
      telefoneCripto: encrypt(u.telefone),
    }).save();
    console.log(`Usuário: ${u.email} | senha: ${senha}`);
  }
}
mongoose.connection.once("open", seed);

// ============================================================
// 🔑 LOGIN
// ============================================================
function dentroDoHorarioPermitido(user) {
  const agora = new Date();
  const h = agora.getHours() + agora.getMinutes() / 60;
  const hoje = agora.getDay();
  const tolerancia = 0.25;
  const feriados = ["12-24", "12-31"];
  const dia = `${String(agora.getMonth() + 1).padStart(2, "0")}-${String(agora.getDate()).padStart(2, "0")}`;
  const especial = feriados.includes(dia);

  if (user.categoria === "RH") return hoje >= 1 && hoje <= 5 && h >= 9 - tolerancia && h <= 18;
  if (user.categoria === "VENDEDOR") {
    if (especial) return h >= 9 - tolerancia && h <= 18;
    if (hoje === 0) return h >= 14 - tolerancia && h <= 20;
    if (user.turno === "MANHA") return h >= 10 - tolerancia && h <= 16;
    if (user.turno === "TARDE") return h >= 16 - tolerancia && h <= 22;
  }
  return false;
}

app.post("/login", async (req, res) => {
  const { email, senha } = req.body;
  const u = await User.findOne({ email });
  if (!u) return res.status(404).json({ error: "Usuário não encontrado" });
  if (!bcrypt.compareSync(senha, u.senhaHash)) return res.status(401).json({ error: "Senha incorreta" });
  if (!dentroDoHorarioPermitido(u)) return res.status(403).json({ error: "Fora do horário permitido" });
  const token = jwt.sign({ id: u._id }, process.env.JWT_SECRET, { expiresIn: "8h" });
  res.json({ token, usuario: u });
});

function auth(req, res, next) {
  const h = req.headers.authorization;
  if (!h) return res.status(401).json({ error: "Token ausente" });
  try {
    const { id } = jwt.verify(h.split(" ")[1], process.env.JWT_SECRET);
    req.userId = id;
    next();
  } catch {
    res.status(401).json({ error: "Token inválido" });
  }
}

// ============================================================
// 📸 REGISTRAR PONTO
// ============================================================
app.post("/ponto/registrar", auth, upload.single("foto"), async (req, res) => {
  await new Ponto({ userId: req.userId, tipo: req.body.tipo, dataHora: new Date(), fotoUrl: req.file?.path || "" }).save();
  res.json({ ok: true });
});

// ============================================================
// 🌴 FÉRIAS
// ============================================================
app.get("/ferias/info", auth, async (req, res) => {
  const u = await User.findById(req.userId);
  const adm = new Date(u.dataAdmissao);
  const hoje = new Date();
  const dias = Math.floor((hoje - adm) / 86400000);
  const status = dias > 365 ? `⚠️ Férias vencidas há ${dias - 365} dias` : dias > 335 ? `⚠️ Férias vencem em ${365 - dias} dias` : "OK";
  res.json({ statusFerias: status, dataAdmissao: u.dataAdmissao });
});

app.post("/ferias/solicitar", auth, async (req, res) => {
  const tipo = req.body.tipo;
  const hoje = new Date();
  const dias = tipo === "15em15" ? 15 : 30;
  await new Ferias({ userId: req.userId, tipo, dataInicio: hoje, dataFim: new Date(hoje.getTime() + dias * 86400000), dias }).save();
  res.json({ ok: true });
});

// ============================================================
// 🧑‍💼 ADMIN CRUD
// ============================================================
app.get("/admin/funcionarios", auth, async (_, res) => {
  res.json(await User.find());
});

app.post("/admin/criar-funcionario", auth, async (req, res) => {
  const { nome, email, cpf, telefone, categoria, turno, dataAdmissao } = req.body;
  const senha = cpf.substring(0, 5);
  await new User({
    nome,
    email,
    senhaHash: bcrypt.hashSync(senha, 10),
    cpfCripto: encrypt(cpf),
    telefoneCripto: encrypt(telefone),
    categoria,
    turno,
    dataAdmissao: new Date(dataAdmissao),
  }).save();
  res.json({ ok: true, senhaGerada: senha });
});

app.put("/admin/funcionario/:id", auth, async (req, res) => {
  const { nome, email, telefone, categoria, turno, dataFeriasInicio, dataFeriasFim, feriasTipo } = req.body;
  const update = { nome, email, telefone, categoria, turno };
  if (dataFeriasInicio && dataFeriasFim && feriasTipo) {
    update.jaTirouFerias = true;
    update.formaUltimasFerias = feriasTipo;
    update.dataUltimasFeriasInicio = new Date(dataFeriasInicio);
    update.dataUltimasFeriasFim = new Date(dataFeriasFim);
    await Ferias.create({
      userId: req.params.id,
      tipo: feriasTipo,
      dataInicio: new Date(dataFeriasInicio),
      dataFim: new Date(dataFeriasFim),
      dias: feriasTipo === "15em15" ? 30 : 30,
      status: "aprovada",
    });
  }
  await User.findByIdAndUpdate(req.params.id, update);
  res.json({ ok: true });
});

app.delete("/admin/funcionario/:id", auth, async (req, res) => {
  await User.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
});

// ============================================================
// 🚀 START
// ============================================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Servidor rodando na porta ${PORT}`));
