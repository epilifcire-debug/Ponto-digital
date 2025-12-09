// ============================================================
// 💼 PONTO DIGITAL - Backend Completo (CommonJS)
// ============================================================

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const multer = require("multer");
const { v2: cloudinary } = require("cloudinary");
const { CloudinaryStorage } = require("multer-storage-cloudinary");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

const PORT = process.env.PORT || 3000;

// ============================================================
// 📦 CONEXÃO MONGODB
// ============================================================
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log("✅ Conectado ao MongoDB Atlas"))
  .catch(err => console.error("❌ Erro MongoDB:", err));

// ============================================================
// 🔐 CRIPTOGRAFIA AES-256-CBC
// ============================================================
const ENCRYPT_KEY = Buffer.from(process.env.ENCRYPT_KEY, "hex");
const IV_LENGTH = 16;

function encrypt(text) {
  if (!text) return null;
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv("aes-256-cbc", ENCRYPT_KEY, iv);
  let encrypted = cipher.update(text, "utf8", "base64");
  encrypted += cipher.final("base64");
  return iv.toString("base64") + ":" + encrypted;
}

function decrypt(data) {
  if (!data) return null;
  const [ivB64, encrypted] = data.split(":");
  const iv = Buffer.from(ivB64, "base64");
  const decipher = crypto.createDecipheriv("aes-256-cbc", ENCRYPT_KEY, iv);
  let decrypted = decipher.update(encrypted, "base64", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

// ============================================================
// ☁️ CLOUDINARY CONFIG
// ============================================================
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "ponto-digital",
    allowed_formats: ["jpg", "jpeg", "png"]
  }
});
const upload = multer({ storage });

// ============================================================
// 🧱 MODELOS MONGOOSE
// ============================================================
const userSchema = new mongoose.Schema({
  userId: String,
  nome: String,
  email: String,
  cpf: String,
  telefone: String,
  categoria: String, // RH, ADMIN, VENDEDOR
  turno: String, // MANHA, TARDE
  senhaHash: String,
  dataAdmissao: String
});
const User = mongoose.model("User", userSchema);

const pontoSchema = new mongoose.Schema({
  userId: String,
  data: String,
  horaEntrada: String,
  horaSaida: String,
  horasTrabalhadasMin: Number,
  saldoDiaMin: Number,
  urlFotoEntrada: String,
  urlFotoSaida: String
});
const Ponto = mongoose.model("Ponto", pontoSchema);

const feriasSchema = new mongoose.Schema({
  userId: String,
  dataInicio: String,
  dataFim: String,
  dias: Number,
  tipo: String,
  status: { type: String, default: "PENDENTE" },
  dataSolicitacao: { type: Date, default: Date.now }
});
const Ferias = mongoose.model("Ferias", feriasSchema);

// ============================================================
// 🔑 AUTENTICAÇÃO JWT
// ============================================================
function gerarToken(user) {
  return jwt.sign(
    { userId: user.userId, categoria: user.categoria },
    process.env.JWT_SECRET,
    { expiresIn: "8h" }
  );
}

function autenticarToken(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Token ausente" });

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: "Token inválido" });
    req.user = user;
    next();
  });
}

// ============================================================
// 🌱 CRIAR USUÁRIOS PADRÃO
// ============================================================
async function seedUsuariosBase() {
  const total = await User.countDocuments();
  if (total > 0) return;

  const base = [
    { nome: "Ana Souza", email: "ana.rh@empresa.com", cpf: "1234512345", telefone: "79999990000", categoria: "RH" },
    { nome: "Bruno Vendedor", email: "bruno@empresa.com", cpf: "9876512345", telefone: "79999991111", categoria: "VENDEDOR", turno: "MANHA" },
    { nome: "Carla Vendedora", email: "carla@empresa.com", cpf: "1112212345", telefone: "79999992222", categoria: "VENDEDOR", turno: "TARDE" }
  ];

  for (const u of base) {
    const senhaHash = await bcrypt.hash(u.cpf.substring(0, 5), 10);
    const userId = Math.floor(Math.random() * 90000 + 10000).toString();
    await User.create({
      userId,
      nome: encrypt(u.nome),
      email: u.email.toLowerCase(),
      cpf: encrypt(u.cpf),
      telefone: encrypt(u.telefone),
      categoria: u.categoria,
      turno: u.turno,
      senhaHash,
      dataAdmissao: "2024-02-10"
    });
  }

  console.log("🌱 Usuários padrão criados.");
}
seedUsuariosBase();

// ============================================================
// 👤 LOGIN
// ============================================================
app.post("/login", async (req, res) => {
  const { email, senha } = req.body;
  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) return res.status(401).json({ error: "Usuário não encontrado" });

  const ok = await bcrypt.compare(senha, user.senhaHash);
  if (!ok) return res.status(401).json({ error: "Senha incorreta" });

  const token = gerarToken(user);
  res.json({
    token,
    usuario: {
      userId: user.userId,
      nome: decrypt(user.nome),
      email: user.email,
      categoria: user.categoria,
      turno: user.turno
    }
  });
});

// ============================================================
// 📸 REGISTRAR PONTO (entrada/saída)
// ============================================================
app.post("/ponto/registrar", autenticarToken, upload.single("foto"), async (req, res) => {
  try {
    const { tipo } = req.body; // entrada ou saida
    const userId = req.user.userId;
    const hoje = new Date().toISOString().split("T")[0];
    const hora = new Date().toLocaleTimeString("pt-BR", { hour12: false });

    let ponto = await Ponto.findOne({ userId, data: hoje });

    if (!ponto) {
      ponto = new Ponto({ userId, data: hoje });
    }

    if (tipo === "entrada") {
      ponto.horaEntrada = hora;
      ponto.urlFotoEntrada = req.file?.path;
    } else if (tipo === "saida") {
      ponto.horaSaida = hora;
      ponto.urlFotoSaida = req.file?.path;

      // cálculo horas
      if (ponto.horaEntrada) {
        const [h1, m1] = ponto.horaEntrada.split(":").map(Number);
        const [h2, m2] = hora.split(":").map(Number);
        const diffMin = (h2 * 60 + m2) - (h1 * 60 + m1);
        ponto.horasTrabalhadasMin = diffMin;
        ponto.saldoDiaMin = diffMin - 480; // meta 8h
      }
    }

    await ponto.save();
    res.json({ message: "Ponto registrado com sucesso" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao registrar ponto" });
  }
});

// ============================================================
// 🌴 FÉRIAS (info + solicitar)
// ============================================================
function diferencaDias(d1, d2) {
  const a = new Date(d1), b = new Date(d2);
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
}

app.get("/ferias/info", autenticarToken, async (req, res) => {
  try {
    const user = await User.findOne({ userId: req.user.userId });
    if (!user?.dataAdmissao)
      return res.json({ temDados: false, mensagem: "Sem data de admissão" });

    const adm = new Date(user.dataAdmissao);
    const hoje = new Date();
    const dias = diferencaDias(adm, hoje);
    const ciclos = Math.floor(dias / 365);
    const disp = ciclos * 30;

    const prox = new Date(adm); prox.setFullYear(adm.getFullYear() + ciclos + 1);
    const limite = new Date(adm); limite.setFullYear(adm.getFullYear() + ciclos + 2);

    const faltam = diferencaDias(hoje, prox);
    const vence = diferencaDias(hoje, limite);

    let status = "";
    if (vence < 0) status = `⚠️ Férias vencidas há ${Math.abs(vence)} dias!`;
    else if (vence <= 30) status = `⚠️ Férias vencem em ${vence} dias.`;
    else status = `✅ Dentro do prazo (${vence} dias p/ vencimento).`;

    res.json({
      temDados: true,
      dataAdmissao: user.dataAdmissao,
      ciclosCompletos: ciclos,
      diasDisponiveis: disp,
      proximaDataAquisitiva: prox.toISOString().split("T")[0],
      diasParaProxima: faltam,
      dataLimiteGozo: limite.toISOString().split("T")[0],
      diasParaVencimento: vence,
      statusFerias: status
    });
  } catch (e) { res.status(500).json({ error: "Erro férias" }); }
});

app.post("/ferias/solicitar", autenticarToken, async (req, res) => {
  const { tipo, dataInicio, dias } = req.body;
  const ini = new Date(dataInicio);
  const fim = new Date(ini); fim.setDate(fim.getDate() + Number(dias) - 1);
  await Ferias.create({
    userId: req.user.userId,
    tipo, dias,
    dataInicio,
    dataFim: fim.toISOString().split("T")[0]
  });
  res.json({ message: "Solicitação registrada", status: "PENDENTE" });
});

// ============================================================
// 🧭 PAINEL RH / ADMIN
// ============================================================
function isRHouAdmin(req, res, next) {
  if (!req.user || !["RH", "ADMIN"].includes(req.user.categoria))
    return res.status(403).json({ error: "Acesso restrito" });
  next();
}

// funcionários com status de férias
app.get("/admin/funcionarios", autenticarToken, isRHouAdmin, async (req, res) => {
  const lista = await User.find({}, "userId nome categoria turno dataAdmissao");
  const out = lista.map(f => {
    const nome = decrypt(f.nome);
    const adm = new Date(f.dataAdmissao);
    const hoje = new Date();
    const dias = diferencaDias(adm, hoje);
    const ciclos = Math.floor(dias / 365);
    const limite = new Date(adm); limite.setFullYear(adm.getFullYear() + ciclos + 2);
    const vence = diferencaDias(hoje, limite);
    let st = "";
    if (vence < 0) st = `⚠️ Vencidas há ${Math.abs(vence)} dias`;
    else if (vence <= 30) st = `⚠️ Vencem em ${vence} dias`;
    else st = `✅ Dentro do prazo (${vence} dias)`;
    return { userId: f.userId, nome, categoria: f.categoria, turno: f.turno, dataAdmissao: f.dataAdmissao, statusFerias: st };
  });
  res.json(out);
});

// banco de horas
app.get("/admin/banco-horas", autenticarToken, isRHouAdmin, async (req, res) => {
  const users = await User.find({});
  const out = [];
  for (const u of users) {
    const pontos = await Ponto.find({ userId: u.userId });
    const total = pontos.reduce((a, b) => a + (b.saldoDiaMin || 0), 0);
    out.push({ nome: decrypt(u.nome), categoria: u.categoria, saldoMin: total });
  }
  res.json(out);
});

// ============================================================
// 🚀 START
// ============================================================
app.listen(PORT, () => console.log(`🚀 Servidor rodando na porta ${PORT}`));
