import { ChangeEvent, useCallback, useEffect, useRef, useState } from 'react';

/**
 * Réduit l'image côté navigateur avant de la stocker en data URL :
 * les photos sont enregistrées dans une colonne texte, pas sur un disque.
 */
function canvasToDataUrl(
  source: CanvasImageSource,
  width: number,
  height: number,
  maxSize: number,
  quality: number,
): string | null {
  const ratio = Math.min(1, maxSize / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', quality);
}

async function fileToDataUrl(file: File, maxSize: number, quality: number): Promise<string> {
  const source = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error('Lecture du fichier impossible'));
    reader.readAsDataURL(file);
  });

  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Image illisible'));
    img.src = source;
  });

  return canvasToDataUrl(image, image.width, image.height, maxSize, quality) ?? source;
}

export type ImageUploadFieldProps = {
  label?: string;
  value: string;
  onChange: (dataUrl: string) => void;
  hint?: string;
  /** Côté le plus long de l'image enregistrée, en pixels. */
  maxSize?: number;
  quality?: number;
  round?: boolean;
  disabled?: boolean;
};

export default function ImageUploadField({
  label = 'Photo',
  value,
  onChange,
  hint = 'JPEG ou PNG, redimensionnée automatiquement.',
  maxSize = 600,
  quality = 0.82,
  round = false,
  disabled = false,
}: ImageUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [cameraOn, setCameraOn] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraOn(false);
  }, []);

  useEffect(() => stopCamera, [stopCamera]);

  const startCamera = async (mode: 'user' | 'environment' = facingMode) => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Aucun appareil photo accessible depuis ce navigateur.');
      return;
    }
    setError('');
    setBusy(true);
    try {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: mode, width: { ideal: 1280 }, height: { ideal: 960 } },
        audio: false,
      });
      streamRef.current = stream;
      setFacingMode(mode);
      setCameraOn(true);
      // Le <video> n'est monté qu'une fois cameraOn passé à true.
      window.setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play();
        }
      }, 0);
    } catch {
      setError('Accès à la caméra refusé ou indisponible.');
      stopCamera();
    } finally {
      setBusy(false);
    }
  };

  const capture = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const dataUrl = canvasToDataUrl(video, video.videoWidth, video.videoHeight, maxSize, quality);
    if (dataUrl) onChange(dataUrl);
    stopCamera();
  };

  const handleFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Choisissez un fichier image.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      onChange(await fileToDataUrl(file, maxSize, quality));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import impossible');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="img-upload">
      <span className="img-upload-label">{label}</span>
      <div className="img-upload-body">
        <div className={`img-upload-preview${round && !cameraOn ? ' is-round' : ''}${cameraOn ? ' is-camera' : ''}`}>
          {cameraOn
            ? <video ref={videoRef} muted playsInline />
            : value
              ? <img src={value} alt="" />
              : <span className="img-upload-empty">Aucune photo</span>}
        </div>
        <div className="img-upload-actions">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={handleFile}
            disabled={disabled || busy}
          />
          {cameraOn ? (
            <>
              <button type="button" className="erp-btn erp-btn--sm" onClick={capture} disabled={busy}>
                Capturer
              </button>
              <button
                type="button"
                className="erp-btn erp-btn--sm erp-btn--ghost"
                onClick={() => startCamera(facingMode === 'user' ? 'environment' : 'user')}
                disabled={busy}
              >
                Changer de caméra
              </button>
              <button type="button" className="erp-btn erp-btn--sm erp-btn--ghost" onClick={stopCamera}>
                Fermer la caméra
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="erp-btn erp-btn--sm"
                onClick={() => inputRef.current?.click()}
                disabled={disabled || busy}
              >
                {busy ? 'Traitement...' : value ? 'Remplacer la photo' : 'Charger une photo'}
              </button>
              <button
                type="button"
                className="erp-btn erp-btn--sm erp-btn--ghost"
                onClick={() => startCamera()}
                disabled={disabled || busy}
              >
                Prendre une photo
              </button>
              {value && (
                <button
                  type="button"
                  className="erp-btn erp-btn--sm erp-btn--ghost"
                  onClick={() => onChange('')}
                  disabled={disabled || busy}
                >
                  Retirer
                </button>
              )}
            </>
          )}
          <p className="img-upload-hint">
            {error || (cameraOn ? 'Cadrez le sujet puis cliquez sur Capturer.' : hint)}
          </p>
        </div>
      </div>
    </div>
  );
}
