import OpenAI, { toFile } from "openai";
import fs from "fs";
import os from "os";
import path from "path";
import ffmpeg from "fluent-ffmpeg";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";

// Configura o caminho do binário do FFmpeg
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '50mb', // Aumenta o limite de payload JSON para arquivos maiores
    },
  },
};

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  let tempVideoPath = "";
  let tempAudioPath = "";

  try {
    const currentApiKey = process.env.OPENAI_API_KEY;
    
    if (!currentApiKey) {
      return res.status(500).json({ error: "OPENAI_API_KEY não encontrada no ambiente da Vercel." });
    }

    const openai = new OpenAI({ apiKey: currentApiKey });

    const { file, mimeType, fileName } = req.body;
    
    if (!file) {
      return res.status(400).json({ error: "Nenhum arquivo enviado." });
    }

    // Converte o Base64 de volta para um Buffer
    const buffer = Buffer.from(file, 'base64');
    let fileObj;

    // Se for vídeo, converte para MP3 primeiro usando a pasta /tmp (única permitida na Vercel)
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

    // Solicita a transcrição ao Whisper
    const transcription = await openai.audio.transcriptions.create({
      file: fileObj,
      model: "whisper-1",
    });

    return res.status(200).json({ transcription: transcription.text });
  } catch (error: any) {
    console.error("Erro na Vercel:", error);
    return res.status(500).json({ error: error.message || "Erro interno no servidor" });
  } finally {
    // Limpa os arquivos temporários da pasta /tmp
    if (tempVideoPath && fs.existsSync(tempVideoPath)) fs.unlinkSync(tempVideoPath);
    if (tempAudioPath && fs.existsSync(tempAudioPath)) fs.unlinkSync(tempAudioPath);
  }
}
