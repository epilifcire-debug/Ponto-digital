// ============================================================
// 🌐 PONTO DIGITAL - BACKEND COMPLETO + CADASTRO FUNCIONÁRIOS
// ============================================================

const express = require("express");
const cors = require("cors");
const multer = require("multer");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const crypto = require("crypto");
const dotenv = require("dotenv");
const { v2: cloudinary } = require("cloudinary");
const { CloudinaryStorage } = require("multer-storage-cloudinary");

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
  params: { folder: "ponto-digital", allowed_formats: ["jpg", "jpeg", "png"] },
});
const upload = multer({ storage });

// ============================================================
// 🔐 CRIPTOGRAFIA AES-256-CBC
// ============================================================
const ENCRYPT_KEY = process.env.ENCRYPT_KEY;
function encrypt(text) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", Buffer.from(ENCRYPT_KEY, "hex"), iv);
  const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  return iv.toString("hex") + ":" + encrypted.toString("hex");
}
function decrypt(text) {
  try {
    if (!text || !text.includes(":")) return text;
    const [ivHex, contentHex] = text.split(":");
    const iv = Buffer.from(ivHex, "hex");
    const decipher = crypto.createDecipheriv("aes-256-cbc", Buffer.from(ENCRYPT_KEY, "hex"), iv);
    const decrypted = Buffer.concat([decipher.update(Buffer.from(contentHex, "hex")), decipher.final()]);
    return decrypted.toString("utf8");
  } catch {
    return text;
  }
}

// ============================================================
// 🧩 MONGODB
// ============================================================
mongoose
  .connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("✅ Conectado ao MongoDB Atlas"))
  .catch((err) => console.error("❌ Erro MongoDB:", err));

const User = mongoose.model(
  "User",
  new mongoose.Schema({
    nome: String,
    email: String,
    senhaHash: String,
    cpfCripto: String,
    telefoneCripto: String,
    categoria: String,
    turno: String,
    dataAdmissao: { type: Date, default: new Date() },
  })
);

const Ponto = mongoose.model(
  "Ponto",
  new mongoose.Schema({ userId: String, tipo: String, dataHora: Date, fotoUrl: String })
);

const Ferias = mongoose.model(
  "Ferias",
  new mongoose.Schema({
    userId: String,
    dataInicio: String,
    dataFim: String,
    dias: Number,
    status: { type: String, default: "pendente" },
  })
);

// ============================================================
// 🌱 SEED USUÁRIOS PADRÃO
// ============================================================
async function seedUsuariosBase() {
  const count = await User.countDocuments();
  if (count === 0) {
    console.log("🌱 Criando usuários padrão...");
    const baseUsers = [
      { nome: "Ana Souza", email: "ana.rh@empresa.com", cpf: "12345678900", telefone: "11999999999", categoria: "RH" },
      { nome: "Bruno Vendedor", email: "bruno@empresa.com", cpf: "98765432100", telefone: "11988888888", categoria: "VENDEDOR", turno: "MANHA" },
      { nome: "Carla Vendedora", email: "carla@empresa.com", cpf: "11122333444", telefone: "11977777777", categoria: "VENDEDOR", turno: "TARDE" },
    ];

    for (const u of baseUsers) {
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
}
mongoose.connection.once("open", seedUsuariosBase);

// ============================================================
// 🔑 LOGIN + JWT
// ============================================================
app.post("/login", async (req, res) => {
  const { email, senha } = req.body;
  const user = await User.findOne({ email });
  if (!user) return res.status(404).json({ error: "Usuário não encontrado" });
  if (!bcrypt.compareSync(senha, user.senhaHash))
    return res.status(401).json({ error: "Senha incorreta" });
  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "8h" });
  res.json({ token, usuario: user });
});

function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: "Token ausente" });
  try {
    const token = header.split(" ")[1];
    req.userId = jwt.verify(token, process.env.JWT_SECRET).id;
    next();
  } catch {
    res.status(401).json({ error: "Token inválido" });
  }
}

// ============================================================
// 🕒 REGISTRAR PONTO
// ============================================================
app.post("/ponto/registrar", auth, upload.single("foto"), async (req, res) => {
  await new Ponto({
    userId: req.userId,
    tipo: req.body.tipo,
    dataHora: new Date(),
    fotoUrl: req.file?.path || "",
  }).save();
  res.json({ ok: true });
});

// ============================================================
// 🧮 FÉRIAS
// ============================================================
app.get("/ferias/info", auth, async (req, res) => {
  const user = await User.findById(req.userId);
  const adm = new Date(user.dataAdmissao);
  const hoje = new Date();
  const diasTrabalhados = Math.floor((hoje - adm) / (1000 * 60 * 60 * 24));
  const ciclos = Math.floor(diasTrabalhados / 365);
  const proxData = new Date(adm.getTime() + (ciclos + 1) * 365 * 86400000);
  const diasProx = Math.ceil((proxData - hoje) / 86400000);
  const vencidas = diasTrabalhados - ciclos * 365 - 365;

  let statusFerias = "OK";
  if (vencidas > 0) statusFerias = `⚠️ Férias vencidas há ${vencidas} dias`;
  else if (diasProx < 30) statusFerias = `⚠️ Férias vencem em ${diasProx} dias`;

  res.json({ dataAdmissao: user.dataAdmissao, statusFerias, proximaDataAquisitiva: proxData });
});

// ============================================================
// 👥 ADMIN / RH ROTAS
// ============================================================
app.get("/admin/funcionarios", auth, async (req, res) => {
  const users = await User.find();
  res.json(users.map((u) => ({
    nome: u.nome,
    categoria: u.categoria,
    turno: u.turno || "-",
    dataAdmissao: u.dataAdmissao?.toISOString().split("T")[0],
  })));
});

// ➕ Criar novo funcionário
app.post("/admin/criar-funcionario", auth, async (req, res) => {
  const user = await User.findById(req.userId);
  if (!["RH", "ADMIN"].includes(user.categoria))
    return res.status(403).json({ error: "Acesso negado" });

  const { nome, email, cpf, telefone, categoria, turno } = req.body;
  const senhaGerada = cpf.substring(0, 5);
  await new User({
    nome, email,
    senhaHash: bcrypt.hashSync(senhaGerada, 10),
    cpfCripto: encrypt(cpf),
    telefoneCripto: encrypt(telefone),
    categoria,
    turno: categoria === "VENDEDOR" ? turno : undefined,
  }).save();

  res.json({ ok: true, senhaGerada });
});

// 📊 STATUS ADMIN + EXPORTAÇÃO CSV
app.get("/admin/status", auth, async (req, res) => {
  const totalUsers = await User.countDocuments();
  const pontosHoje = await Ponto.countDocuments({ dataHora: { $gte: new Date().setHours(0, 0, 0, 0) } });
  const feriasPendentes = await Ferias.countDocuments({ status: "pendente" });
  const logsRecentes = (await Ponto.find().sort({ dataHora: -1 }).limit(10)).map(
    (p) => `${p.tipo.toUpperCase()} - ${new Date(p.dataHora).toLocaleString()} (${p.fotoUrl ? "📷" : "—"})`
  );
  const fotosRecentes = (await Ponto.find({ fotoUrl: { $ne: "" } }).sort({ dataHora: -1 }).limit(5)).map(
    (p) => p.fotoUrl
  );
  res.json({ funcionariosAtivos: totalUsers, pontosHoje, feriasPendentes, logsRecentes, fotosRecentes, ultimaAtualizacao: new Date() });
});

app.get("/admin/exportar", auth, async (req, res) => {
  const totalUsers = await User.countDocuments();
  const pontosHoje = await Ponto.countDocuments({ dataHora: { $gte: new Date().setHours(0, 0, 0, 0) } });
  const feriasPendentes = await Ferias.countDocuments({ status: "pendente" });
  const logsRecentes = (await Ponto.find().sort({ dataHora: -1 }).limit(10)).map(
    (p) => `${p.tipo.toUpperCase()};${new Date(p.dataHora).toLocaleString()};${p.fotoUrl || "-"}`
  );
  let csv = "Relatório Administrativo - Ponto Digital\n\n";
  csv += `Gerado em:;${new Date().toLocaleString()}\n\n`;
  csv += "Funcionários;Pontos Hoje;Férias Pendentes\n";
  csv += `${totalUsers};${pontosHoje};${feriasPendentes}\n\n`;
  csv += "Tipo;Data/Hora;Foto\n";
  csv += logsRecentes.join("\n");
  res.header("Content-Type", "text/csv");
  res.attachment(`Relatorio_${new Date().toISOString().slice(0, 10)}.csv`);
  res.send(csv);
});

// ============================================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Servidor rodando na porta ${PORT}`));
