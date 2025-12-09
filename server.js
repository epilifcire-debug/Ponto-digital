// ============================================================
// 🌐 PONTO DIGITAL - BACKEND COMPLETO + STATUS ADMINISTRATIVO
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
// ☁️ CONFIG CLOUDINARY
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
// 🔐 CRIPTOGRAFIA SEGURA
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
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(contentHex, "hex")),
      decipher.final(),
    ]);
    return decrypted.toString("utf8");
  } catch (err) {
    console.warn("⚠️ Erro ao descriptografar:", err.message);
    return text;
  }
}

// ============================================================
// 🧩 CONEXÃO COM MONGODB
// ============================================================
mongoose
  .connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
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
  dataAdmissao: { type: Date, default: new Date() },
});

const pontoSchema = new mongoose.Schema({
  userId: String,
  tipo: String,
  dataHora: Date,
  fotoUrl: String,
});

const feriasSchema = new mongoose.Schema({
  userId: String,
  dataInicio: String,
  dataFim: String,
  dias: Number,
  status: { type: String, default: "pendente" },
});

const User = mongoose.model("User", userSchema);
const Ponto = mongoose.model("Ponto", pontoSchema);
const Ferias = mongoose.model("Ferias", feriasSchema);

// ============================================================
// 🌱 USUÁRIOS BASE
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
      const novo = new User({
        ...u,
        senhaHash: bcrypt.hashSync(senha, 10),
        cpfCripto: encrypt(u.cpf),
        telefoneCripto: encrypt(u.telefone),
      });
      await novo.save();
      console.log(`Usuário: ${u.email} | senha: ${senha}`);
    }
  }
}

mongoose.connection.once("open", async () => {
  try {
    await seedUsuariosBase();
    console.log("✅ Usuários verificados");
  } catch (err) {
    if (err.message.includes("bad decrypt")) {
      console.warn("🔄 Chave alterada — recriando usuários padrão...");
      await mongoose.connection.db.dropCollection("users").catch(() => {});
      await seedUsuariosBase();
    }
  }
});

// ============================================================
// 🔑 LOGIN E JWT
// ============================================================
app.post("/login", async (req, res) => {
  try {
    const { email, senha } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: "Usuário não encontrado" });
    const ok = await bcrypt.compare(senha, user.senhaHash);
    if (!ok) return res.status(401).json({ error: "Senha incorreta" });

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "8h" });
    res.json({ token, usuario: user });
  } catch {
    res.status(500).json({ error: "Erro no login" });
  }
});

function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: "Token ausente" });
  try {
    const token = header.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.id;
    next();
  } catch {
    res.status(401).json({ error: "Token inválido" });
  }
}

// ============================================================
// 🕒 REGISTRO DE PONTO
// ============================================================
app.post("/ponto/registrar", auth, upload.single("foto"), async (req, res) => {
  try {
    const ponto = new Ponto({
      userId: req.userId,
      tipo: req.body.tipo,
      dataHora: new Date(),
      fotoUrl: req.file?.path || "",
    });
    await ponto.save();
    res.json({ ok: true, msg: "Ponto registrado com sucesso" });
  } catch {
    res.status(500).json({ error: "Erro ao registrar ponto" });
  }
});

// ============================================================
// 🧮 FÉRIAS
// ============================================================
app.get("/ferias/info", auth, async (req, res) => {
  const user = await User.findById(req.userId);
  if (!user) return res.status(404).json({ error: "Usuário não encontrado" });

  const adm = new Date(user.dataAdmissao);
  const hoje = new Date();
  const diasTrabalhados = Math.floor((hoje - adm) / (1000 * 60 * 60 * 24));
  const ciclos = Math.floor(diasTrabalhados / 365);
  const proxData = new Date(adm.getTime() + (ciclos + 1) * 365 * 24 * 60 * 60 * 1000);
  const diasProx = Math.ceil((proxData - hoje) / (1000 * 60 * 60 * 24));
  const vencidas = diasTrabalhados - ciclos * 365 - 365;

  let statusFerias = "OK";
  if (vencidas > 0) statusFerias = `⚠️ Férias vencidas há ${vencidas} dias`;
  else if (diasProx < 30) statusFerias = `⚠️ Férias vencem em ${diasProx} dias`;

  res.json({
    temDados: true,
    dataAdmissao: user.dataAdmissao,
    ciclosCompletos: ciclos,
    proximaDataAquisitiva: proxData,
    diasParaProxima: diasProx,
    statusFerias,
  });
});

app.post("/ferias/solicitar", auth, async (req, res) => {
  const { tipo, dataInicio, dias } = req.body;
  const ferias = new Ferias({
    userId: req.userId,
    dataInicio,
    dataFim: new Date(new Date(dataInicio).getTime() + dias * 86400000)
      .toISOString()
      .split("T")[0],
    dias,
  });
  await ferias.save();
  res.json({ ok: true });
});

// ============================================================
// 🧠 ADMIN / RH ROTAS
// ============================================================
app.get("/admin/funcionarios", auth, async (req, res) => {
  const users = await User.find();
  const lista = users.map((u) => ({
    nome: u.nome,
    categoria: u.categoria,
    turno: u.turno || "-",
    dataAdmissao: u.dataAdmissao?.toISOString().split("T")[0],
    statusFerias: "OK",
  }));
  res.json(lista);
});

app.get("/admin/banco-horas", auth, async (req, res) => {
  const users = await User.find();
  res.json(users.map((u) => ({ nome: u.nome, categoria: u.categoria, saldoMin: 0 })));
});

// ============================================================
// 📊 STATUS ADMINISTRATIVO
// ============================================================
app.get("/admin/status", auth, async (req, res) => {
  const user = await User.findById(req.userId);
  if (!["RH", "ADMIN"].includes(user.categoria))
    return res.status(403).json({ error: "Acesso negado" });

  const totalUsers = await User.countDocuments();
  const pontosHoje = await Ponto.countDocuments({
    dataHora: { $gte: new Date().setHours(0, 0, 0, 0) },
  });
  const feriasPendentes = await Ferias.countDocuments({ status: "pendente" });

  const logsRecentes = await Ponto.find()
    .sort({ dataHora: -1 })
    .limit(10)
    .populate("userId", "nome")
    .then((pontos) =>
      pontos.map((p) => `${p.tipo.toUpperCase()} - ${p.dataHora.toLocaleString()} (${p.fotoUrl ? "📷" : "—"})`)
    );

  const fotosRecentes = await Ponto.find({ fotoUrl: { $ne: "" } })
    .sort({ dataHora: -1 })
    .limit(5)
    .then((p) => p.map((p) => p.fotoUrl));

  res.json({
    funcionariosAtivos: totalUsers,
    pontosHoje,
    feriasPendentes,
    logsRecentes,
    fotosRecentes,
    ultimaAtualizacao: new Date().toISOString(),
  });
});

// ============================================================
// 🚀 INICIAR SERVIDOR
// ============================================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Servidor rodando na porta ${PORT}`));
