import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import multer from "multer";
import fs from "fs";
import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = "uploads/";
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir);
    }
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + "-" + Date.now() + ext);
  }
});

const upload = multer({ storage: storage });

async function startServer() {
  const app = express();
  const PORT = 3000;

  // API routes FIRST
  app.post("/api/transcribe", upload.single("file"), async (req, res) => {
    let filePath = "";
    try {
      const currentApiKey = process.env.OPENAI_API_KEY;
      
      if (!currentApiKey) {
        throw new Error("OPENAI_API_KEY não encontrada no ambiente. Verifique o painel de Secrets e clique em 'Apply changes'.");
      }

      // Initialize OpenAI instance
      const openai = new OpenAI({ apiKey: currentApiKey });

      if (!req.file) {
        return res.status(400).json({ error: "Nenhum arquivo enviado." });
      }

      filePath = req.file.path;
      const mimeType = req.file.mimetype;
      
      console.log(`Processando com Whisper: ${req.file.originalname} (${mimeType})`);

      // Request transcription from OpenAI Whisper
      const transcription = await openai.audio.transcriptions.create({
        file: fs.createReadStream(filePath),
        model: "whisper-1",
      });

      res.json({ transcription: transcription.text });
    } catch (error) {
      console.error("Erro detalhado na transcrição:", error);
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido no servidor";
      res.status(500).json({ error: `Falha ao processar transcrição: ${errorMessage}` });
    } finally {
      // Clean up local file
      if (filePath && fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (cleanupError) {
          console.error("Erro ao deletar arquivo temporário:", cleanupError);
        }
      }
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
