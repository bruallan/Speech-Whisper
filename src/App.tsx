import { useState, useRef } from 'react';
import { UploadCloud, Loader2, Copy, Check } from 'lucide-react';

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [transcription, setTranscription] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.type.startsWith('audio/') || droppedFile.type.startsWith('video/')) {
        setFile(droppedFile);
        setError(null);
      } else {
        setError('Por favor, envie apenas arquivos de áudio ou vídeo.');
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
      setError(null);
    }
  };

  const handleGenerate = async () => {
    if (!file) return;

    // Validação de tamanho (25MB é o limite da OpenAI Whisper)
    const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB em bytes
    if (file.size > MAX_FILE_SIZE) {
      setError("O arquivo é muito grande. O limite máximo suportado pela OpenAI é de 25MB.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setTranscription(null);
    setCopied(false);

    try {
      // Converter arquivo para Base64
      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(',')[1]); // Remove o prefixo data:audio/mp3;base64,
        };
        reader.onerror = (error) => reject(error);
      });

      const response = await fetch('/api/transcribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          file: base64Data,
          mimeType: file.type,
          fileName: file.name
        }),
      });

      // Tratamento para caso a Vercel retorne uma página HTML de erro (ex: 404 ou 500)
      const contentType = response.headers.get("content-type");
      if (!response.ok) {
        if (contentType && contentType.includes("application/json")) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Erro ao processar a transcrição.');
        } else {
          throw new Error(`Erro no servidor (${response.status}). A rota da API não foi encontrada ou falhou.`);
        }
      }

      const data = await response.json();
      setTranscription(data.transcription);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ocorreu um erro desconhecido.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = () => {
    if (transcription) {
      navigator.clipboard.writeText(transcription);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-gray-800 font-sans flex flex-col">
      {/* Cabeçalho */}
      <header className="py-12 text-center">
        <h1 className="text-3xl font-light tracking-wide text-gray-700">Transcrição de Mídia</h1>
        <p className="mt-3 text-purple-400 font-medium">{"Espero que goste <3"}</p>
      </header>

      {/* Conteúdo Principal */}
      <main className="flex-grow flex flex-col items-center px-4 max-w-3xl mx-auto w-full">
        
        {/* Área de Upload */}
        <div
          className={`w-full p-10 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed transition-colors cursor-pointer
            ${isDragging ? 'border-purple-400 bg-purple-50/50' : 'border-purple-300 bg-white hover:bg-slate-50'}
            ${isLoading ? 'opacity-50 pointer-events-none' : ''}
          `}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="audio/*,video/*"
            className="hidden"
            disabled={isLoading}
          />
          <UploadCloud className="w-12 h-12 text-purple-300 mb-4" strokeWidth={1.5} />
          <p className="text-center text-gray-600">
            {file ? (
              <span className="font-medium text-purple-400">{file.name}</span>
            ) : (
              "Arraste seus vídeos ou áudios aqui, ou clique para selecionar."
            )}
          </p>
        </div>

        {error && (
          <p className="mt-4 text-red-400 text-sm">{error}</p>
        )}

        {/* Botão de Ação */}
        <button
          onClick={handleGenerate}
          disabled={!file || isLoading}
          className={`mt-8 px-8 py-3 rounded-full bg-white border border-purple-300 text-gray-700 font-medium transition-all flex items-center justify-center min-w-[200px]
            ${!file || isLoading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-purple-50 hover:border-purple-400 hover:text-purple-500'}
          `}
        >
          {isLoading ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin text-purple-400" />
              Processando...
            </>
          ) : (
            "Gerar Transcrição"
          )}
        </button>

        {/* Área de Resultado */}
        {transcription && (
          <div className="w-full mt-12 mb-12 relative animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="absolute top-4 right-4">
              <button
                onClick={handleCopy}
                className="p-2 rounded-md bg-white/80 hover:bg-purple-50 border border-purple-200 text-gray-500 hover:text-purple-400 transition-colors flex items-center shadow-sm"
                title="Copiar texto"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
            <div className="w-full min-h-[200px] max-h-[500px] overflow-y-auto p-6 bg-white border border-purple-200 rounded-xl shadow-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
              {transcription}
            </div>
          </div>
        )}
      </main>

      {/* Rodapé */}
      <footer className="py-6 text-center text-sm text-gray-400">
      </footer>
    </div>
  );
}
