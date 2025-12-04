import express from "express";
import cors from "cors";
import multer from "multer";
import path from "path";
import fs from "fs";
import sqlite3 from "sqlite3";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "troque-esta-chave-por-uma-bem-segura";

// ----------------- MIDDLEWARES BÁSICOS -----------------
app.use(cors());
app.use(express.json());

// Pasta para arquivos enviados
const documentosDir = path.join(__dirname, "documentos");
if (!fs.existsSync(documentosDir)) {
  fs.mkdirSync(documentosDir, { recursive: true });
}
app.use("/documentos", express.static(documentosDir));

// ----------------- BANCO DE DADOS (SQLite) -----------------
const db = new sqlite3.Database(path.join(__dirname, "db.sqlite"));

db.serialize(() => {
  // Eventos
  db.run(`
    CREATE TABLE IF NOT EXISTS eventos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      data TEXT,
      descricao TEXT
    )
  `);

  // Pessoas
  db.run(`
    CREATE TABLE IF NOT EXISTS pessoas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      cpf TEXT NOT NULL UNIQUE,
      telefone TEXT,
      descricao TEXT
    )
  `);

  // Relação pessoa x evento
  db.run(`
    CREATE TABLE IF NOT EXISTS pessoa_evento (
      pessoa_id INTEGER,
      evento_id INTEGER,
      PRIMARY KEY (pessoa_id, evento_id)
    )
  `);

  // Documentos enviados
  db.run(`
    CREATE TABLE IF NOT EXISTS documentos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pessoa_id INTEGER NOT NULL,
      tipo TEXT NOT NULL,
      filename TEXT NOT NULL,
      filepath TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Usuários (login)
  db.run(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      senha_hash TEXT NOT NULL,
      role TEXT DEFAULT 'user',
      ativo INTEGER DEFAULT 1
    )
  `);

  // Cria usuário admin padrão se não existir nenhum usuário
  db.get("SELECT COUNT(*) AS total FROM usuarios", (err, row) => {
    if (err) {
      console.error("Erro ao contar usuários:", err);
      return;
    }
    if (row.total === 0) {
      const nome = "Administrador";
      const email = "admin@pcd.com";
      const senha = "1234";
      const role = "admin";

      bcrypt.hash(senha, 10, (errHash, hash) => {
        if (errHash) {
          console.error("Erro ao gerar hash da senha:", errHash);
          return;
        }
        db.run(
          "INSERT INTO usuarios (nome, email, senha_hash, role, ativo) VALUES (?, ?, ?, ?, 1)",
          [nome, email, hash, role],
          (errIns) => {
            if (errIns) {
              console.error("Erro ao criar usuário admin padrão:", errIns);
            } else {
              console.log("Usuário admin padrão criado:");
              console.log("  Email:", email);
              console.log("  Senha:", senha);
            }
          }
        );
      });
    }
  });
});

// ----------------- AUXILIARES -----------------
function slugify(str) {
  return String(str)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
}

const TIPOS_OBRIGATORIOS = [
  "requerimento",
  "foto",
  "doc_oficial",
  "laudo",
  "cad_unico",
  "comprovante"
];
const TIPOS_OPCIONAIS = ["cartao_bpc"];

function getDocStatusForPessoa(pessoaId) {
  return new Promise((resolve, reject) => {
    db.all(
      "SELECT tipo FROM documentos WHERE pessoa_id = ?",
      [pessoaId],
      (err, rows) => {
        if (err) return reject(err);
        const tipos = rows.map((r) => r.tipo);
        const missing = TIPOS_OBRIGATORIOS.filter((t) => !tipos.includes(t));
        const completo = missing.length === 0;
        resolve({ completo, missing, presentes: tipos });
      }
    );
  });
}

// ----------------- AUTENTICAÇÃO (JWT) -----------------
function authMiddleware(req, res, next) {
  const authHeader = req.headers["authorization"];
  if (!authHeader) return res.status(401).json({ error: "Token não informado" });

  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") {
    return res.status(401).json({ error: "Formato de token inválido" });
  }

  const token = parts[1];
  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(401).json({ error: "Token inválido ou expirado" });
    req.user = decoded; // { id, nome, email, role }
    next();
  });
}

function adminMiddleware(req, res, next) {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ error: "Acesso negado. Somente admin." });
  }
  next();
}

// ----------------- MULTER (UPLOAD) -----------------
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!req.pessoaDir) {
      return cb(new Error("Diretório da pessoa não definido"), null);
    }
    cb(null, req.pessoaDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || "";
    const base = slugify(file.fieldname);
    const ts = Date.now();
    cb(null, `${base}_${ts}${ext}`);
  }
});
const upload = multer({ storage });

// ----------------- ROTAS DE LOGIN / USUÁRIOS -----------------

// Login real no backend
app.post("/api/login", (req, res) => {
  const { email, senha } = req.body;
  if (!email || !senha) {
    return res.status(400).json({ error: "Informe email e senha." });
  }

  db.get("SELECT * FROM usuarios WHERE email = ? AND ativo = 1", [email], (err, user) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!user) return res.status(401).json({ error: "Usuário ou senha inválidos." });

    bcrypt.compare(senha, user.senha_hash, (errComp, same) => {
      if (errComp) return res.status(500).json({ error: "Erro ao validar senha." });
      if (!same) return res.status(401).json({ error: "Usuário ou senha inválidos." });

      const payload = {
        id: user.id,
        nome: user.nome,
        email: user.email,
        role: user.role
      };

      const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "1d" });

      res.json({
        token,
        user: payload
      });
    });
  });
});

// Criar usuário (somente admin logado)
app.post("/api/usuarios", authMiddleware, adminMiddleware, (req, res) => {
  const { nome, email, senha, role } = req.body;
  if (!nome || !email || !senha) {
    return res.status(400).json({ error: "Nome, email e senha são obrigatórios." });
  }

  bcrypt.hash(senha, 10, (errHash, hash) => {
    if (errHash) return res.status(500).json({ error: "Erro ao gerar hash de senha." });

    db.run(
      "INSERT INTO usuarios (nome, email, senha_hash, role, ativo) VALUES (?, ?, ?, ?, 1)",
      [nome, email, hash, role || "user"],
      function (errIns) {
        if (errIns) {
          if (errIns.message.includes("UNIQUE")) {
            return res.status(400).json({ error: "Email já cadastrado." });
          }
          return res.status(500).json({ error: errIns.message });
        }
        db.get("SELECT id, nome, email, role, ativo FROM usuarios WHERE id = ?", [this.lastID], (e2, row) => {
          if (e2) return res.status(500).json({ error: e2.message });
          res.status(201).json(row);
        });
      }
    );
  });
});

// Listar usuários (somente admin)
app.get("/api/usuarios", authMiddleware, adminMiddleware, (req, res) => {
  db.all("SELECT id, nome, email, role, ativo FROM usuarios", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Ativar/desativar usuário
app.patch("/api/usuarios/:id/toggle", authMiddleware, adminMiddleware, (req, res) => {
  const { id } = req.params;
  db.get("SELECT ativo FROM usuarios WHERE id = ?", [id], (err, user) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!user) return res.status(404).json({ error: "Usuário não encontrado" });

    const novo = user.ativo ? 0 : 1;
    db.run("UPDATE usuarios SET ativo = ? WHERE id = ?", [novo, id], function (err2) {
      if (err2) return res.status(500).json({ error: err2.message });
      res.json({ success: true, ativo: novo });
    });
  });
});

// ----------------- ROTAS DE EVENTOS (PROTEGIDAS) -----------------
app.get("/api/eventos", authMiddleware, (req, res) => {
  db.all("SELECT * FROM eventos", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });

    const comData = rows.filter((e) => e.data);
    const semData = rows.filter((e) => !e.data);

    comData.sort((a, b) => a.data.localeCompare(b.data));
    const ordenados = [...comData, ...semData];
    res.json(ordenados);
  });
});

app.post("/api/eventos", authMiddleware, (req, res) => {
  const { nome, data, descricao } = req.body;
  if (!nome) return res.status(400).json({ error: "Nome do evento é obrigatório" });

  db.run(
    "INSERT INTO eventos (nome, data, descricao) VALUES (?, ?, ?)",
    [nome, data || null, descricao || null],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      db.get("SELECT * FROM eventos WHERE id = ?", [this.lastID], (e2, row) => {
        if (e2) return res.status(500).json({ error: e2.message });
        res.status(201).json(row);
      });
    }
  );
});

app.put("/api/eventos/:id", authMiddleware, (req, res) => {
  const { id } = req.params;
  const { nome, data, descricao } = req.body;

  db.run(
    "UPDATE eventos SET nome = ?, data = ?, descricao = ? WHERE id = ?",
    [nome, data || null, descricao || null, id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: "Evento não encontrado" });

      db.get("SELECT * FROM eventos WHERE id = ?", [id], (e2, row) => {
        if (e2) return res.status(500).json({ error: e2.message });
        res.json(row);
      });
    }
  );
});

app.delete("/api/eventos/:id", authMiddleware, (req, res) => {
  const { id } = req.params;
  db.serialize(() => {
    db.run("DELETE FROM pessoa_evento WHERE evento_id = ?", [id]);
    db.run("DELETE FROM eventos WHERE id = ?", [id], function (err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: "Evento não encontrado" });
      res.json({ success: true });
    });
  });
});

// ----------------- ROTAS DE PESSOAS (PROTEGIDAS) -----------------
app.get("/api/pessoas", authMiddleware, (req, res) => {
  db.all("SELECT * FROM pessoas", (err, pessoasRows) => {
    if (err) return res.status(500).json({ error: err.message });

    db.all("SELECT * FROM pessoa_evento", async (err2, peRows) => {
      if (err2) return res.status(500).json({ error: err2.message });

      const eventosPorPessoa = {};
      peRows.forEach((pe) => {
        if (!eventosPorPessoa[pe.pessoa_id]) eventosPorPessoa[pe.pessoa_id] = [];
        eventosPorPessoa[pe.pessoa_id].push(pe.evento_id);
      });

      pessoasRows.sort((a, b) =>
        a.nome.localeCompare(b.nome, "pt", { sensitivity: "base" })
      );

      const resultado = [];
      for (const p of pessoasRows) {
        const eventosIds = eventosPorPessoa[p.id] || [];
        const docsStatus = await getDocStatusForPessoa(p.id);
        resultado.push({
          ...p,
          eventos: eventosIds,
          docsStatus
        });
      }

      res.json(resultado);
    });
  });
});

app.post("/api/pessoas", authMiddleware, (req, res) => {
  const { nome, cpf, telefone, descricao, eventos } = req.body;
  if (!nome || !cpf) {
    return res.status(400).json({ error: "Nome e CPF são obrigatórios" });
  }

  db.serialize(() => {
    db.run(
      "INSERT INTO pessoas (nome, cpf, telefone, descricao) VALUES (?, ?, ?, ?)",
      [nome, cpf, telefone || null, descricao || null],
      function (err) {
        if (err) return res.status(500).json({ error: err.message });

        const pessoaId = this.lastID;
        if (Array.isArray(eventos) && eventos.length > 0) {
          const stmt = db.prepare(
            "INSERT OR IGNORE INTO pessoa_evento (pessoa_id, evento_id) VALUES (?, ?)"
          );
          eventos.forEach((eid) => stmt.run(pessoaId, eid));
          stmt.finalize();
        }

        db.get("SELECT * FROM pessoas WHERE id = ?", [pessoaId], async (e2, row) => {
          if (e2) return res.status(500).json({ error: e2.message });
          const docsStatus = await getDocStatusForPessoa(pessoaId);
          res.status(201).json({
            ...row,
            eventos: eventos || [],
            docsStatus
          });
        });
      }
    );
  });
});

app.put("/api/pessoas/:id", authMiddleware, (req, res) => {
  const { id } = req.params;
  const { nome, cpf, telefone, descricao, eventos } = req.body;

  if (!nome || !cpf) {
    return res.status(400).json({ error: "Nome e CPF são obrigatórios" });
  }

  db.serialize(() => {
    db.run(
      "UPDATE pessoas SET nome = ?, cpf = ?, telefone = ?, descricao = ? WHERE id = ?",
      [nome, cpf, telefone || null, descricao || null, id],
      function (err) {
        if (err) return res.status(500).json({ error: err.message });

        db.run("DELETE FROM pessoa_evento WHERE pessoa_id = ?", [id], (err2) => {
          if (err2) return res.status(500).json({ error: err2.message });

          if (Array.isArray(eventos) && eventos.length > 0) {
            const stmt = db.prepare(
              "INSERT OR IGNORE INTO pessoa_evento (pessoa_id, evento_id) VALUES (?, ?)"
            );
            eventos.forEach((eid) => stmt.run(id, eid));
            stmt.finalize();
          }

          db.get("SELECT * FROM pessoas WHERE id = ?", [id], async (e3, row) => {
            if (e3) return res.status(500).json({ error: e3.message });
            const docsStatus = await getDocStatusForPessoa(id);
            res.json({
              ...row,
              eventos: eventos || [],
              docsStatus
            });
          });
        });
      }
    );
  });
});

app.delete("/api/pessoas/:id", authMiddleware, (req, res) => {
  const { id } = req.params;
  db.serialize(() => {
    db.run("DELETE FROM pessoa_evento WHERE pessoa_id = ?", [id]);
    db.run("DELETE FROM documentos WHERE pessoa_id = ?", [id]);
    db.run("DELETE FROM pessoas WHERE id = ?", [id], function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true });
    });
  });
});

// ----------------- UPLOAD DE DOCUMENTOS (PROTEGIDO) -----------------
function loadPessoaMiddleware(req, res, next) {
  const { id } = req.params;
  db.get("SELECT * FROM pessoas WHERE id = ?", [id], (err, pessoa) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!pessoa) return res.status(404).json({ error: "Pessoa não encontrada" });

    const pastaNome = slugify(`${pessoa.nome}_${pessoa.id}`);
    const dir = path.join(documentosDir, pastaNome);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    req.pessoa = pessoa;
    req.pessoaDir = dir;
    next();
  });
}

const uploadCampos = upload.fields([
  { name: "requerimento", maxCount: 1 },
  { name: "foto", maxCount: 1 },
  { name: "doc_oficial", maxCount: 1 },
  { name: "laudo", maxCount: 1 },
  { name: "cad_unico", maxCount: 1 },
  { name: "cartao_bpc", maxCount: 1 },
  { name: "comprovante", maxCount: 1 }
]);

app.post(
  "/api/pessoas/:id/docs",
  authMiddleware,
  loadPessoaMiddleware,
  uploadCampos,
  (req, res) => {
    const pessoaId = req.pessoa.id;
    const files = req.files || {};

    db.serialize(() => {
      const stmtDel = db.prepare("DELETE FROM documentos WHERE pessoa_id = ? AND tipo = ?");
      const stmtIns = db.prepare(
        "INSERT INTO documentos (pessoa_id, tipo, filename, filepath) VALUES (?, ?, ?, ?)"
      );

      Object.keys(files).forEach((field) => {
        files[field].forEach((file) => {
          stmtDel.run(pessoaId, field);
          const relPath = path.relative(__dirname, file.path).replace(/\\/g, "/");
          stmtIns.run(pessoaId, field, file.filename, `/${relPath}`);
        });
      });

      stmtDel.finalize();
      stmtIns.finalize();

      getDocStatusForPessoa(pessoaId)
        .then((status) => res.json({ success: true, pessoaId, docsStatus: status }))
        .catch((err) => res.status(500).json({ error: err.message }));
    });
  }
);

app.get("/api/pessoas/:id/docs", authMiddleware, loadPessoaMiddleware, (req, res) => {
  const pessoaId = req.pessoa.id;
  db.all(
    "SELECT id, tipo, filename, filepath, created_at FROM documentos WHERE pessoa_id = ?",
    [pessoaId],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ pessoa: req.pessoa, documentos: rows });
    }
  );
});

// ----------------- BACKUP -----------------
app.get("/api/backup", authMiddleware, (req, res) => {
  db.all("SELECT * FROM eventos", (e1, ev) => {
    if (e1) return res.status(500).json({ error: e1.message });
    db.all("SELECT * FROM pessoas", (e2, pe) => {
      if (e2) return res.status(500).json({ error: e2.message });
      db.all("SELECT * FROM pessoa_evento", (e3, pe2) => {
        if (e3) return res.status(500).json({ error: e3.message });
        db.all("SELECT * FROM documentos", (e4, docs) => {
          if (e4) return res.status(500).json({ error: e4.message });

          res.json({ eventos: ev, pessoas: pe, pessoa_evento: pe2, documentos: docs });
        });
      });
    });
  });
});

// ----------------- ROTA RAIZ -----------------
app.get("/", (req, res) => {
  res.send("API PCD Eventos rodando ✅");
});

// ----------------- INÍCIO DO SERVIDOR -----------------
app.listen(PORT, () => {
  console.log(`✅ Servidor rodando na porta ${PORT}`);
});
