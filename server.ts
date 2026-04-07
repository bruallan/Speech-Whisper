import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import OpenAI, { toFile } from "openai";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Aumenta o limite de JSON para suportar arquivos em Base64
  app.use(express.json({ limit: '20mb' }));

  // API routes FIRST
  app.post("/api/transcribe", async (req, res) => {
    try {
      const currentApiKey = process.env.OPENAI_API_KEY;
      
      if (!currentApiKey) {
        throw new Error("OPENAI_API_KEY não encontrada no ambiente. Verifique o painel de Secrets e clique em 'Apply changes'.");
      }

      // Initialize OpenAI instance
      const openai = new OpenAI({ apiKey: currentApiKey });

      const { file, mimeType, fileName } = req.body;

      if (!file) {
        return res.status(400).json({ error: "Nenhum arquivo enviado." });
      }

      console.log(`Processando localmente com Whisper: ${fileName} (${mimeType})`);

      // Converte Base64 para Buffer
      const buffer = Buffer.from(file, 'base64');
      const fileObj = await toFile(buffer, fileName, { type: mimeType });

      // Request transcription from OpenAI Whisper
      const transcription = await openai.audio.transcriptions.create({
        file: fileObj,
        model: "whisper-1",
      });

      res.json({ transcription: transcription.text });
    } catch (error) {
      console.error("Erro detalhado na transcrição:", error);
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido no servidor";
      res.status(500).json({ error: `Falha ao processar transcrição: ${errorMessage}` });
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
