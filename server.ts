import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import os from "os";
import OpenAI, { toFile } from "openai";
import dotenv from "dotenv";
import ffmpeg from "fluent-ffmpeg";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";

dotenv.config();

// Configura o caminho do binário do FFmpeg
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Aumenta o limite de JSON para suportar arquivos em Base64 (50mb para cobrir os 25mb da OpenAI + overhead do Base64)
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // API routes FIRST
  app.post("/api/transcribe", async (req, res) => {
    let tempVideoPath = "";
    let tempAudioPath = "";

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
      let fileObj;

      // Se for vídeo, converte para MP3 primeiro
      if (mimeType.startsWith('video/')) {
        console.log("Vídeo detectado. Extraindo áudio com FFmpeg...");
        
        tempVideoPath = path.join(os.tmpdir(), `video-${Date.now()}.mp4`);
        tempAudioPath = path.join(os.tmpdir(), `audio-${Date.now()}.mp3`);
        
        fs.writeFileSync(tempVideoPath, buffer);
        
        await new Promise<void>((resolve, reject) => {
          ffmpeg(tempVideoPath)
            .noVideo()
            .audioCodec('libmp3lame')
            .save(tempAudioPath)
            .on('end', () => {
              console.log("Conversão para MP3 concluída.");
              resolve();
            })
            .on('error', (err) => {
              console.error("Erro no FFmpeg:", err);
              reject(err);
            });
        });

        const audioBuffer = fs.readFileSync(tempAudioPath);
        fileObj = await toFile(audioBuffer, "audio.mp3", { type: "audio/mp3" });
      } else {
        fileObj = await toFile(buffer, fileName, { type: mimeType });
      }

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
    } finally {
      // Limpa os arquivos temporários
      if (tempVideoPath && fs.existsSync(tempVideoPath)) fs.unlinkSync(tempVideoPath);
      if (tempAudioPath && fs.existsSync(tempAudioPath)) fs.unlinkSync(tempAudioPath);
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
