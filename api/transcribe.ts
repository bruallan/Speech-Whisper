import OpenAI, { toFile } from "openai";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb', // Aumenta o limite de payload JSON para arquivos maiores
    },
  },
};

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

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
    
    // Converte o Buffer para um objeto File que a OpenAI aceita
    const fileObj = await toFile(buffer, fileName, { type: mimeType });

    // Solicita a transcrição ao Whisper
    const transcription = await openai.audio.transcriptions.create({
      file: fileObj,
      model: "whisper-1",
    });

    return res.status(200).json({ transcription: transcription.text });
  } catch (error: any) {
    console.error("Erro na Vercel:", error);
    return res.status(500).json({ error: error.message || "Erro interno no servidor" });
  }
}
