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

// ===== Schemas =====
const userSchema = new mongoose.Schema({
  nome: String,
  email: String,
  senhaHash: String,
  cpfCripto: String,
  telefoneCripto: String,
  categoria: String, // RH | VENDEDOR | ADMIN
  turno: String, // MANHA | TARDE
  dataAdmissao: { type: Date, default: new Date() },
  jaTirouFerias: { type: Boolean, default: false },
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

const trocaSchema = new mongoose.Schema({
  solicitanteId: String,
  parceiroId: String,
  dataTroca: Date,
  turnoSolicitado: String,
  status: { type: String, default: "pendente" }, // pendente | aceito | rejeitado
});

const User = mongoose.model("User", userSchema);
const Ponto = mongoose.model("Ponto", pontoSchema);
const Ferias = mongoose.model("Ferias", feriasSchema);
const Troca = mongoose.model("Troca", trocaSchema);

// ============================================================
// 🌱 SEED INICIAL + CORREÇÃO DE NOMES
// ============================================================
async function seedUsuariosBase() {
  if (await User.countDocuments()) return;
  console.log("🌱 Criando usuários padrão...");
  const baseUsers = [
    {
      nome: "Ana Souza",
      email: "ana.rh@empresa.com",
      cpf: "12345678900",
      telefone: "11999999999",
      categoria: "RH",
      dataAdmissao: new Date("2023-01-02"),
    },
    {
      nome: "Bruno Vendedor",
      email: "bruno@empresa.com",
      cpf: "98765432100",
      telefone: "11988888888",
      categoria: "VENDEDOR",
      turno: "MANHA",
      dataAdmissao: new Date("2023-02-10"),
    },
    {
      nome: "Carla Vendedora",
      email: "carla@empresa.com",
      cpf: "11122333444",
      telefone: "11977777777",
      categoria: "VENDEDOR",
      turno: "TARDE",
      dataAdmissao: new Date("2023-03-15"),
    },
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
async function corrigirNomesCriptografados() {
  const usuarios = await User.find();
  for (const u of usuarios) {
    if (u.nome && u.nome.includes(":")) {
      u.nome = decrypt(u.nome);
      await u.save();
    }
  }
}
mongoose.connection.once("open", async () => {
  await seedUsuariosBase();
  await corrigirNomesCriptografados();
});

// ============================================================
// 🔒 CONTROLE DE HORÁRIO DE LOGIN
// ============================================================
function dentroDoHorarioPermitido(user) {
  const agora = new Date();
  const hora = agora.getHours() + agora.getMinutes() / 60;
  const hoje = agora.getDay(); // 0 domingo ... 6 sábado
  const tolerancia = 0.25; // 15 min
  const datasComemorativas = ["12-24", "12-31"];
  const hojeFmt = `${String(agora.getMonth() + 1).padStart(2, "0")}-${String(
    agora.getDate()
  ).padStart(2, "0")}`;
  const especial = datasComemorativas.includes(hojeFmt);

  if (user.categoria === "RH") {
    if (hoje === 0 || hoje === 6) return false;
    return hora >= 9 - tolerancia && hora <= 18;
  }

  if (user.categoria === "VENDEDOR") {
    if (especial) return hora >= 9 - tolerancia && hora <= 18;
    if (hoje === 0) return hora >= 14 - tolerancia && hora <= 20; // domingo
    if (user.turno === "MANHA") return hora >= 10 - tolerancia && hora <= 16;
    if (user.turno === "TARDE") return hora >= 16 - tolerancia && hora <= 22;
  }
  return false;
}

// ============================================================
// 🔑 LOGIN
// ============================================================
app.post("/login", async (req, res) => {
  const { email, senha } = req.body;
  const user = await User.findOne({ email });
  if (!user) return res.status(404).json({ error: "Usuário não encontrado." });

  const ok = await bcrypt.compare(senha, user.senhaHash);
  if (!ok) return res.status(401).json({ error: "Senha incorreta." });

  if (!dentroDoHorarioPermitido(user))
    return res.status(403).json({ error: "Fora do horário permitido para login." });

  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
    expiresIn: "8h",
  });
  res.json({ token, usuario: user });
});

function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: "Token ausente." });
  try {
    const decoded = jwt.verify(header.split(" ")[1], process.env.JWT_SECRET);
    req.userId = decoded.id;
    next();
  } catch {
    res.status(401).json({ error: "Token inválido." });
  }
}

// ============================================================
// 🕒 REGISTRO DE PONTO
// ============================================================
app.post("/ponto/registrar", auth, upload.single("foto"), async (req, res) => {
  try {
    await new Ponto({
      userId: req.userId,
      tipo: req.body.tipo,
      dataHora: new Date(),
      fotoUrl: req.file?.path || "",
    }).save();
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "Erro ao registrar ponto." });
  }
});

// ============================================================
// 🌴 FÉRIAS
// ============================================================
app.get("/ferias/info", auth, async (req, res) => {
  const u = await User.findById(req.userId);
  if (!u) return res.status(404).json({ error: "Usuário não encontrado." });
  const adm = new Date(u.dataAdmissao);
  const hoje = new Date();
  const dias = Math.floor((hoje - adm) / 86400000);
  const proxima = new Date(adm.getTime() + 365 * 86400000);
  let status = "OK";
  if (dias > 365) status = `⚠️ Férias vencidas há ${dias - 365} dias`;
  else if (dias > 335) status = `⚠️ Férias vencem em ${365 - dias} dias`;
  res.json({ dataAdmissao: u.dataAdmissao, statusFerias: status, proxima });
});
app.get("/ferias/ultimas", auth, async (req, res) => {
  const u = await User.findById(req.userId);
  const ultima = await Ferias.findOne({ userId: u._id, status: "aprovada" }).sort({
    dataInicio: -1,
  });
  res.json({ ultimaFerias: ultima });
});
app.post("/ferias/solicitar", auth, async (req, res) => {
  const { tipo } = req.body;
  if (!tipo) return res.status(400).json({ error: "Tipo obrigatório." });
  const hoje = new Date();
  const dias = tipo === "15em15" ? 15 : 30;
  const f = new Ferias({
    userId: req.userId,
    tipo,
    dataInicio: hoje,
    dataFim: new Date(hoje.getTime() + dias * 86400000),
    dias,
  });
  await f.save();
  res.json({ ok: true });
});

// ============================================================
// 🔁 TROCA DE TURNO
// ============================================================
app.post("/troca/solicitar", auth, async (req, res) => {
  const { parceiroEmail, dataTroca } = req.body;
  const solicitante = await User.findById(req.userId);
  if (!solicitante || solicitante.categoria !== "VENDEDOR")
    return res.status(403).json({ error: "Somente vendedores." });
  const parceiro = await User.findOne({
    email: parceiroEmail,
    categoria: "VENDEDOR",
  });
  if (!parceiro) return res.status(404).json({ error: "Parceiro não encontrado." });
  if (solicitante.turno === parceiro.turno)
    return res
      .status(400)
      .json({ error: "Troca só permitida entre turnos diferentes." });
  await new Troca({
    solicitanteId: solicitante._id,
    parceiroId: parceiro._id,
    dataTroca: new Date(dataTroca),
    turnoSolicitado: parceiro.turno,
  }).save();
  res.json({ ok: true });
});
app.get("/troca/pendentes", auth, async (req, res) => {
  const trocas = await Troca.find({ parceiroId: req.userId, status: "pendente" });
  const lista = await Promise.all(
    trocas.map(async (t) => {
      const s = await User.findById(t.solicitanteId);
      return {
        id: t._id,
        nomeSolicitante: s?.nome,
        dataTroca: t.dataTroca,
        turnoSolicitado: t.turnoSolicitado,
      };
    })
  );
  res.json(lista);
});
app.post("/troca/responder", auth, async (req, res) => {
  const { trocaId, aceitar } = req.body;
  const t = await Troca.findById(trocaId);
  if (!t) return res.status(404).json({ error: "Solicitação não encontrada." });
  if (t.parceiroId !== req.userId)
    return res.status(403).json({ error: "Sem permissão." });
  t.status = aceitar ? "aceito" : "rejeitado";
  await t.save();
  res.json({ ok: true });
});

// ============================================================
// 👥 ADMIN / RH – CRUD FUNCIONÁRIOS
// ============================================================
app.get("/admin/funcionarios", auth, async (_, res) => {
  const list = await User.find();
  res.json(
    list.map((u) => ({
      id: u._id,
      nome: u.nome,
      categoria: u.categoria,
      turno: u.turno || "-",
      dataAdmissao: u.dataAdmissao?.toISOString().split("T")[0] || "-",
    }))
  );
});
app.post("/admin/criar-funcionario", auth, async (req, res) => {
  const {
    nome,
    email,
    cpf,
    telefone,
    categoria,
    turno,
    dataAdmissao,
    feriasTipoInicial,
  } = req.body;
  const senhaGerada = cpf.substring(0, 5);
  const novo = new User({
    nome,
    email,
    senhaHash: bcrypt.hashSync(senhaGerada, 10),
    cpfCripto: encrypt(cpf),
    telefoneCripto: encrypt(telefone),
    categoria,
    turno,
    dataAdmissao: new Date(dataAdmissao),
    jaTirouFerias: feriasTipoInicial !== "nenhuma",
    formaUltimasFerias:
      feriasTipoInicial === "nenhuma" ? null : feriasTipoInicial,
  });
  await novo.save();
  res.json({ ok: true, senhaGerada });
});
app.put("/admin/funcionario/:id", auth, async (req, res) => {
  await User.findByIdAndUpdate(req.params.id, req.body);
  res.json({ ok: true });
});
app.delete("/admin/funcionario/:id", auth, async (req, res) => {
  await User.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
});

// ============================================================
// 🚀 INICIAR SERVIDOR
// ============================================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`🚀 Servidor rodando na porta ${PORT}`)
);
