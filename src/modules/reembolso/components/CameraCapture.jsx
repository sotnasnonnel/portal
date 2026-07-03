import { useEffect, useRef, useState } from "react";
import { Camera, RefreshCw, X } from "lucide-react";
import "./CameraCapture.css";

// Camera ao vivo dentro do app (getUserMedia). Funciona em contexto seguro
// (localhost/HTTPS). Captura um frame e devolve um File JPEG via onCapture.
export default function CameraCapture({ onCapture, onClose }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [facingMode, setFacingMode] = useState("environment");
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");

  function stopStream() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function start() {
      setReady(false);
      setError("");
      stopStream();
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: facingMode } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        setReady(true);
      } catch {
        setError(
          "Não foi possível acessar a câmera. Permita o acesso no navegador ou use 'Importar NF'."
        );
      }
    }

    start();

    return () => {
      cancelled = true;
      stopStream();
    };
  }, [facingMode]);

  function capture() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (blob) {
          onCapture(new File([blob], `nf-${Date.now()}.jpg`, { type: "image/jpeg" }));
        }
      },
      "image/jpeg",
      0.92
    );
  }

  return (
    <div className="cam-overlay" role="dialog" aria-modal="true">
      <div className="cam-box">
        <button type="button" className="cam-close" onClick={onClose} aria-label="Fechar">
          <X size={22} />
        </button>

        {error ? (
          <div className="cam-error">{error}</div>
        ) : (
          <video ref={videoRef} className="cam-video" playsInline muted />
        )}

        <div className="cam-actions">
          <button
            type="button"
            className="cam-icon-btn"
            onClick={() => setFacingMode((m) => (m === "environment" ? "user" : "environment"))}
            title="Trocar câmera"
            disabled={!!error}
          >
            <RefreshCw size={20} />
          </button>
          <button
            type="button"
            className="cam-shutter"
            onClick={capture}
            disabled={!ready || !!error}
            aria-label="Capturar foto"
          >
            <Camera size={26} />
          </button>
          <span className="cam-spacer" />
        </div>
      </div>
    </div>
  );
}
