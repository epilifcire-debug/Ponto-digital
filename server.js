// ============================================================
// ✅ SISTEMA BACKEND PCD EVENTOS — VERSÃO FINAL ESTÁVEL 2025
// ============================================================
// Suporte completo: Uploads + Backup JSON + Listagem de Backups
// ============================================================

import express from "express";
import cors from "cors";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import dotenv from "dotenv";
import streamifier from "streamifier";

dotenv.config();
const app = express();

// ============================================================
// 🌐 CONFIGURAÇÕES BÁSICAS
// ============================================================
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// ============================================================
// ☁️ CONFIGURAÇÃO DO CLOUDINARY
// ============================================================
cloudinary.config({
  cloud_name: process.env.CLOUD_NAME || "djln3mjwd",
  api_key: process.env.CLOUD_KEY,
  api_secret: process.env.CLOUD_SECRET,
});

// ============================================================
// 📦 MULTER + CLOUDINARY (UPLOAD DE DOCUMENTOS)
// ============================================================
const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    const nomePessoa = req.body.nomePessoa || "sem-nome";
    return {
      folder: `uploads_pcd_eventos/${nomePessoa}`,
      resource_type: "auto",
      public_id: file.originalname.split(".")[0],
      format: undefined,
    };
  },
});

const upload = multer({ storage });

// ============================================================
// 🔼 ROTA DE UPLOAD DE DOCUMENTOS
// ============================================================
app.post("/upload", upload.any(), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: "Nenhum arquivo recebido." });
    }

    const arquivos = {};
    req.files.forEach((file) => {
      arquivos[file.fieldname] = {
        url: file.path,
        id: file.filename,
        tipo: file.mimetype,
        tamanho: file.size,
      };
    });

    res.json({
      message: "Upload concluído com sucesso!",
      arquivos,
    });
  } catch (err) {
    console.error("Erro no upload:", err);
    res.status(500).json({ error: "Erro ao enviar documentos." });
  }
});

// ============================================================
// 💾 BACKUP JSON — ENVIA PARA CLOUDINARY
// ============================================================
app.post("/backup-json", async (req, res) => {
  try {
    const jsonData = JSON.stringify(req.body, null, 2);
    const nomeArquivo = `backup-${Date.now()}.json`;

    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: "uploads_pcd_eventos/backups",
        resource_type: "raw",
        public_id: nomeArquivo.replace(".json", ""),
      },
      (error, result) => {
        if (error) {
          console.error("Erro ao enviar backup:", error);
          res.status(500).json({ error: "Falha ao enviar backup." });
        } else {
          res.json({
            message: "Backup enviado com sucesso!",
            url: result.secure_url,
          });
        }
      }
    );

    streamifier.createReadStream(jsonData).pipe(uploadStream);
  } catch (err) {
    console.error("Erro ao processar backup:", err);
    res.status(500).json({ error: "Erro ao processar backup JSON." });
  }
});

// ============================================================
// 📋 LISTAR BACKUPS E PEGAR O MAIS RECENTE (CORRIGIDO)
// ============================================================
app.get("/listar-backups", async (req, res) => {
  try {
    const result = await cloudinary.api.resources({
      type: "authenticated", // ✅ CORRIGIDO — permite listar backups RAW
      resource_type: "raw",
      prefix: "uploads_pcd_eventos/backups/",
      max_results: 50,
      direction: "desc",
    });

    if (!result.resources || result.resources.length === 0) {
      return res.status(404).json({ error: "Nenhum backup encontrado." });
    }

    // Ordena por data e pega o mais recente
    const backups = result.resources.sort(
      (a, b) => new Date(b.created_at) - new Date(a.created_at)
    );
    const ultimo = backups[0];

    res.json({
      message: "Backup mais recente encontrado",
      public_id: ultimo.public_id,
      created_at: ultimo.created_at,
      url: ultimo.secure_url,
    });
  } catch (err) {
    console.error("Erro ao listar backups:", err);
    res.status(500).json({ error: "Erro ao listar backups." });
  }
});

// ============================================================
// 🔄 TESTE RÁPIDO DO SERVIDOR
// ============================================================
app.get("/", (req, res) => {
  res.send("✅ Servidor PCD Eventos rodando e conectado ao Cloudinary.");
});

// ============================================================
// 🚀 INICIALIZAÇÃO DO SERVIDOR
// ============================================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
});
