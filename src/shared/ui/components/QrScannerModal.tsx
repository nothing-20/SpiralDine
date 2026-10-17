import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import jsQR from 'jsqr';
import {
  X,
  Camera,
  AlertTriangle,
  RefreshCw,
  Keyboard,
  CheckCircle2,
  ScanLine
} from 'lucide-react';
import toast from 'react-hot-toast';

export interface ParsedTableQr {
  tenantId: string;
  tableId: string;
  tableNumber: string;
}

/**
 * Validates and safely extracts restaurant tenantId and tableId from a scanned QR payload.
 * Supports:
 * - Direct URLs: https://domain/r/:tenantId/table/:tableId
 * - Menu query URLs: https://domain/customer/restaurant/:tenantId/menu?table=:tableId
 * - Relative paths: /r/:tenantId/table/:tableId
 * - JSON payloads: {"tenantId":"...","tableId":"..."} or {"r":"...","t":"..."}
 * - Shorthand format: tenantId/tableNumber or tenantId/table/tableNumber
 */
export function parseSpiralDineQr(raw: string): ParsedTableQr | null {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // 1. JSON payload support
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const data = JSON.parse(trimmed);
      const tenantId = data.tenantId || data.restaurantId || data.r;
      const tableRaw = data.tableId || data.table || data.t;
      if (tenantId && tableRaw) {
        const cleanTenant = String(tenantId).trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
        const cleanTableNum = String(tableRaw).trim().replace(/^TBL-/i, '').replace(/[^0-9]/g, '');
        if (cleanTenant && cleanTableNum && /^[a-z0-9_-]+$/.test(cleanTenant) && /^[0-9]+$/.test(cleanTableNum)) {
          return {
            tenantId: cleanTenant,
            tableId: `TBL-${cleanTableNum}`,
            tableNumber: cleanTableNum,
          };
        }
      }
    } catch (_) {
      // Ignore JSON parse failure and proceed to URL/text parsing
    }
  }

  // 2. URL parsing (absolute or relative)
  let isFullUrl = false;
  let path = trimmed;
  let search = '';
  try {
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      isFullUrl = true;
      const parsedUrl = new URL(trimmed);
      path = parsedUrl.pathname;
      search = parsedUrl.search;
    } else if (trimmed.startsWith('/')) {
      const fakeUrl = new URL(`https://dummy.local${trimmed}`);
      path = fakeUrl.pathname;
      search = fakeUrl.search;
    }
  } catch (_) {
    // Keep raw path
  }

  // Pattern A: /r/:tenantId/table/:tableId
  const rTableMatch = path.match(/\/r\/([a-zA-Z0-9_-]+)\/table\/([a-zA-Z0-9_-]+)/i);
  if (rTableMatch) {
    const tenantId = rTableMatch[1].toLowerCase();
    const cleanTableNum = rTableMatch[2].replace(/^TBL-/i, '');
    return {
      tenantId,
      tableId: rTableMatch[2].startsWith('TBL-') ? rTableMatch[2] : `TBL-${cleanTableNum}`,
      tableNumber: cleanTableNum,
    };
  }

  // Pattern B: /customer/restaurant/:tenantId/menu?table=:tableId
  const menuMatch = path.match(/\/customer\/restaurant\/([a-zA-Z0-9_-]+)(?:\/menu)?/i);
  if (menuMatch) {
    const tenantId = menuMatch[1].toLowerCase();
    const params = new URLSearchParams(search);
    const tableParam = params.get('table') || params.get('tableId') || params.get('t');
    if (tableParam) {
      const cleanTableNum = tableParam.replace(/^TBL-/i, '');
      return {
        tenantId,
        tableId: tableParam.startsWith('TBL-') ? tableParam : `TBL-${cleanTableNum}`,
        tableNumber: cleanTableNum,
      };
    }
  }

  // If it was a full URL (http/https) and didn't match recognized SpiralDine paths, reject
  if (isFullUrl) {
    return null;
  }

  // Pattern C: shorthand manual entry only: "tenantId/tableNumber" or "tenantId/table/number" or "tenantId:tableNumber"
  // e.g. "bawarchi-restaurant/12" or "gourmet-palace-saas/3"
  const shorthandMatch = trimmed.match(/^([a-zA-Z0-9_-]+)(?:\/table)?[\/:\s]+(?:TBL-)?([0-9]+)$/i);
  if (shorthandMatch) {
    const tenantId = shorthandMatch[1].toLowerCase();
    const cleanTableNum = shorthandMatch[2];
    return {
      tenantId,
      tableId: `TBL-${cleanTableNum}`,
      tableNumber: cleanTableNum,
    };
  }

  return null;
}

interface QrScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (parsed: ParsedTableQr) => void;
}

type CameraStatus = 'requesting' | 'active' | 'denied' | 'unsupported' | 'error';

export const QrScannerModal: React.FC<QrScannerModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const navigate = useNavigate();

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const hasDetectedRef = useRef<boolean>(false);

  const [status, setStatus] = useState<CameraStatus>('requesting');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [manualInput, setManualInput] = useState('');
  const [showManualFallback, setShowManualFallback] = useState(false);
  const [isProcessingCode, setIsProcessingCode] = useState(false);

  // Stop camera tracks cleanly
  const stopCameraStream = useCallback(() => {
    if (animFrameRef.current !== null) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (_) {}
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  // Safe handler when a code is detected or manually entered
  const handleValidQr = useCallback(
    (parsed: ParsedTableQr) => {
      stopCameraStream();
      setIsProcessingCode(true);

      const tableDisplay = parsed.tableNumber || parsed.tableId.replace(/^TBL-/i, '');
      toast.success(`Table QR Verified! Opening session for Table ${tableDisplay}...`, {
        icon: '🍽️',
      });

      if (onSuccess) {
        onSuccess(parsed);
      } else {
        navigate(`/r/${parsed.tenantId}/table/${parsed.tableId}`);
      }

      onClose();
    },
    [navigate, onClose, onSuccess, stopCameraStream]
  );

  // Process raw payload string
  const processRawPayload = useCallback(
    (raw: string) => {
      const parsed = parseSpiralDineQr(raw);
      if (parsed) {
        handleValidQr(parsed);
        return true;
      } else {
        toast.error('The scanned QR code is not a valid SpiralDine table QR code.', {
          id: 'invalid-qr-toast',
        });
        return false;
      }
    },
    [handleValidQr]
  );

  // Scanning loop
  const scanLoop = useCallback(() => {
    if (hasDetectedRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
      const width = video.videoWidth;
      const height = video.videoHeight;

      if (width > 0 && height > 0) {
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (ctx) {
          ctx.drawImage(video, 0, 0, width, height);
          const imageData = ctx.getImageData(0, 0, width, height);
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'dontInvert',
          });

          if (code && code.data && !hasDetectedRef.current) {
            const parsed = parseSpiralDineQr(code.data);
            if (parsed) {
              hasDetectedRef.current = true;
              handleValidQr(parsed);
              return;
            }
          }
        }
      }
    }

    animFrameRef.current = requestAnimationFrame(scanLoop);
  }, [handleValidQr]);

  // Start camera stream
  const startCamera = useCallback(async () => {
    stopCameraStream();
    hasDetectedRef.current = false;
    setStatus('requesting');
    setErrorMessage(null);

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setStatus('unsupported');
      setShowManualFallback(true);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true'); // Required for iOS Safari
        await videoRef.current.play();
        setStatus('active');
        animFrameRef.current = requestAnimationFrame(scanLoop);
      }
    } catch (err: any) {
      console.warn('[QrScannerModal] Camera error:', err);
      if (
        err?.name === 'NotAllowedError' ||
        err?.name === 'PermissionDeniedError' ||
        err?.name === 'SecurityError'
      ) {
        setStatus('denied');
        setErrorMessage('Camera access was denied. Please allow camera permissions in your browser or enter your table code manually.');
      } else if (err?.name === 'NotFoundError' || err?.name === 'DevicesNotFoundError') {
        setStatus('unsupported');
        setErrorMessage('No camera device was found on this device.');
      } else {
        setStatus('error');
        setErrorMessage('Unable to start the camera. Please try again or use the manual fallback.');
      }
      setShowManualFallback(true);
    }
  }, [scanLoop, stopCameraStream]);

  // Lifecycle when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      hasDetectedRef.current = false;
      setIsProcessingCode(false);
      startCamera();
    } else {
      stopCameraStream();
    }

    return () => {
      stopCameraStream();
    };
  }, [isOpen, startCamera, stopCameraStream]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Handle manual submit
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualInput.trim()) return;
    processRawPayload(manualInput);
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="qr-scanner-title"
      className="fixed inset-0 z-50 bg-[#202124]/80 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 overflow-y-auto animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-sm bg-[#FCFAF7] border border-[#E5DCD5] rounded-3xl shadow-2xl p-5 sm:p-6 text-center overflow-hidden flex flex-col items-center">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close QR scanner"
          className="absolute top-4 right-4 p-2 bg-white/90 hover:bg-[#F3E8DF] border border-[#E5DCD5] rounded-full text-[#756B64] hover:text-[#202124] transition-colors cursor-pointer shadow-xs z-20"
        >
          <X className="w-4.5 h-4.5" />
        </button>

        {/* Header */}
        <div className="space-y-1 mb-4 pt-1 w-full">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#F3E8DF] text-[#C85A3F] text-[10px] font-extrabold uppercase tracking-wider mb-1">
            <ScanLine className="w-3.5 h-3.5" />
            <span>Table Scanner</span>
          </div>
          <h3 id="qr-scanner-title" className="text-base font-extrabold text-[#202124]">
            Scan Table QR Code
          </h3>
          <p className="text-xs text-[#756B64] font-medium max-w-xs mx-auto">
            Point your camera at the QR code on your restaurant dining table.
          </p>
        </div>

        {/* Viewfinder Window */}
        <div className="relative w-64 h-64 sm:w-68 sm:h-68 rounded-2xl overflow-hidden bg-black border-2 border-[#C85A3F]/80 shadow-inner flex items-center justify-center">
          {/* Live Video Feed */}
          <video
            ref={videoRef}
            className={`absolute inset-0 w-full h-full object-cover ${
              status === 'active' ? 'opacity-100' : 'opacity-0'
            }`}
            muted
            playsInline
          />

          {/* Offscreen Canvas for Frame Decoding */}
          <canvas ref={canvasRef} className="hidden" />

          {/* Active Camera Viewfinder Overlay */}
          {status === 'active' && (
            <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
              {/* Corner targeting marks */}
              <div className="absolute top-3 left-3 w-6 h-6 border-t-2 border-l-2 border-[#C85A3F]" />
              <div className="absolute top-3 right-3 w-6 h-6 border-t-2 border-r-2 border-[#C85A3F]" />
              <div className="absolute bottom-3 left-3 w-6 h-6 border-b-2 border-l-2 border-[#C85A3F]" />
              <div className="absolute bottom-3 right-3 w-6 h-6 border-b-2 border-r-2 border-[#C85A3F]" />

              {/* Scanning laser line */}
              <div className="absolute inset-x-4 h-0.5 bg-gradient-to-r from-transparent via-[#C85A3F] to-transparent shadow-[0_0_12px_#C85A3F] animate-bounce" />

              <span className="text-[10px] font-bold text-white/90 bg-black/60 px-2.5 py-1 rounded-full backdrop-blur-xs">
                Scanning for Table QR...
              </span>
            </div>
          )}

          {/* Loading / Requesting Camera State */}
          {status === 'requesting' && (
            <div className="flex flex-col items-center justify-center space-y-2 p-4 text-center text-white">
              <Camera className="w-8 h-8 text-[#C85A3F] animate-pulse" />
              <p className="text-xs font-semibold text-white/90">Starting camera...</p>
              <p className="text-[10px] text-white/60">Please approve camera permission if prompted</p>
            </div>
          )}

          {/* Permission Denied State */}
          {status === 'denied' && (
            <div className="flex flex-col items-center justify-center space-y-2.5 p-4 text-center bg-[#FCFAF7] h-full w-full">
              <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h4 className="text-xs font-bold text-[#202124]">Camera Permission Denied</h4>
              <p className="text-[11px] text-[#756B64] leading-relaxed">
                Camera access was blocked. Please enable camera permissions in your browser or use manual entry below.
              </p>
              <button
                type="button"
                onClick={startCamera}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#C85A3F] text-white text-xs font-bold rounded-lg hover:bg-[#A94332] transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Retry Permission</span>
              </button>
            </div>
          )}

          {/* Unsupported or Error State */}
          {(status === 'unsupported' || status === 'error') && (
            <div className="flex flex-col items-center justify-center space-y-2.5 p-4 text-center bg-[#FCFAF7] h-full w-full">
              <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h4 className="text-xs font-bold text-[#202124]">Camera Unavailable</h4>
              <p className="text-[11px] text-[#756B64] leading-relaxed">
                {errorMessage || 'Camera could not be started on this device. You can enter your table link or code below.'}
              </p>
              <button
                type="button"
                onClick={startCamera}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#C85A3F] text-white text-xs font-bold rounded-lg hover:bg-[#A94332] transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Try Again</span>
              </button>
            </div>
          )}

          {/* Code Processing Overlay */}
          {isProcessingCode && (
            <div className="absolute inset-0 bg-[#202124]/90 backdrop-blur-xs flex flex-col items-center justify-center text-white space-y-2 z-30">
              <CheckCircle2 className="w-10 h-10 text-emerald-400 animate-pulse" />
              <span className="text-xs font-bold">QR Code Verified!</span>
            </div>
          )}
        </div>

        {/* Fallback & Manual Input Section */}
        <div className="w-full mt-4 space-y-3">
          <button
            type="button"
            onClick={() => setShowManualFallback(!showManualFallback)}
            className="text-xs text-[#C85A3F] hover:text-[#A94332] font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Keyboard className="w-3.5 h-3.5" />
            <span>{showManualFallback ? 'Hide manual entry' : 'Trouble scanning? Enter code manually'}</span>
          </button>

          {showManualFallback && (
            <form onSubmit={handleManualSubmit} className="space-y-2 text-left pt-1 w-full animate-in fade-in duration-150">
              <label htmlFor="manual-table-code" className="text-[11px] font-bold text-[#756B64] block">
                Restaurant & Table (e.g., bawarchi-restaurant/12 or URL)
              </label>
              <div className="flex gap-2">
                <input
                  id="manual-table-code"
                  type="text"
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                  placeholder="bawarchi-restaurant/12"
                  className="flex-1 px-3 py-2 text-xs bg-white border border-[#E5DCD5] rounded-xl text-[#202124] focus:outline-none focus:ring-2 focus:ring-[#C85A3F]/50 font-mono"
                />
                <button
                  type="submit"
                  disabled={!manualInput.trim()}
                  className="px-3.5 py-2 bg-[#C85A3F] hover:bg-[#A94332] disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer shrink-0"
                >
                  Open Table
                </button>
              </div>
            </form>
          )}

          {/* Quick verified demo tables for instant testing */}
          <div className="pt-2 border-t border-[#F3E8DF] w-full text-left">
            <span className="text-[10px] text-[#756B64] font-extrabold uppercase tracking-wider block mb-1.5">
              Available Demo Tables
            </span>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => processRawPayload('/r/gourmet-palace-saas/table/TBL-3')}
                className="p-2 bg-white hover:bg-[#F3E8DF] border border-[#E5DCD5] rounded-xl text-[11px] text-[#202124] hover:text-[#C85A3F] font-bold transition-all text-left truncate cursor-pointer shadow-2xs"
              >
                Gourmet Palace (T-3)
              </button>
              <button
                type="button"
                onClick={() => processRawPayload('/r/bawarchi-restaurant/table/TBL-12')}
                className="p-2 bg-white hover:bg-[#F3E8DF] border border-[#E5DCD5] rounded-xl text-[11px] text-[#202124] hover:text-[#C85A3F] font-bold transition-all text-left truncate cursor-pointer shadow-2xs"
              >
                Bawarchi (T-12)
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QrScannerModal;
