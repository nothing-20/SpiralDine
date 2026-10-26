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
  ScanLine,
  Info
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
        const cleanTableNum = String(tableRaw).trim().replace(/^(table|tbl)[-\s]*/i, '').replace(/[^a-z0-9_-]/gi, '');
        if (cleanTenant && cleanTableNum && /^[a-z0-9_-]+$/.test(cleanTenant) && /^[a-z0-9_-]+$/i.test(cleanTableNum)) {
          return {
            tenantId: cleanTenant,
            tableId: cleanTableNum.toUpperCase().startsWith('TBL-') ? cleanTableNum.toUpperCase() : `TBL-${cleanTableNum}`,
            tableNumber: cleanTableNum,
          };
        }
      }
    } catch (_) {
      // Ignore JSON parse failure and proceed
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
    const rawTable = rTableMatch[2];
    const cleanTableNum = rawTable.replace(/^(table|tbl)[-\s]*/i, '');
    return {
      tenantId,
      tableId: rawTable.toUpperCase().startsWith('TBL-') ? rawTable : `TBL-${cleanTableNum}`,
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
      const cleanTableNum = tableParam.replace(/^(table|tbl)[-\s]*/i, '');
      return {
        tenantId,
        tableId: tableParam.toUpperCase().startsWith('TBL-') ? tableParam : `TBL-${cleanTableNum}`,
        tableNumber: cleanTableNum,
      };
    }
  }

  // If it was a full URL (http/https) and didn't match recognized SpiralDine paths, reject
  if (isFullUrl) {
    return null;
  }

  // Pattern C: shorthand manual entry: "tenantId/tableId" or "tenantId/table/tableId"
  const shorthandMatch = trimmed.match(/^([a-zA-Z0-9_-]+)(?:\/table)?[\/:]+(?:table|tbl)?[-\s]*([a-zA-Z0-9_-]+)$/i);
  if (shorthandMatch) {
    const tenantId = shorthandMatch[1].toLowerCase();
    const cleanTableNum = shorthandMatch[2].replace(/^(table|tbl)[-\s]*/i, '');
    if (tenantId && cleanTableNum) {
      return {
        tenantId,
        tableId: `TBL-${cleanTableNum}`,
        tableNumber: cleanTableNum,
      };
    }
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
  const scanTimerRef = useRef<any>(null);
  const hasDetectedRef = useRef<boolean>(false);
  const isScanningActiveRef = useRef<boolean>(false);
  const barcodeDetectorRef = useRef<any>(null);

  const [status, setStatus] = useState<CameraStatus>('requesting');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [scanHint, setScanHint] = useState<string>('Center the table QR code in the box');
  const [manualInput, setManualInput] = useState('');
  const [showManualFallback, setShowManualFallback] = useState(false);
  const [isProcessingCode, setIsProcessingCode] = useState(false);

  // Initialize BarcodeDetector if natively available (Hardware-accelerated on Android Chrome)
  useEffect(() => {
    if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
      try {
        barcodeDetectorRef.current = new (window as any).BarcodeDetector({
          formats: ['qr_code'],
        });
      } catch (err) {
        console.warn('[QrScannerModal] BarcodeDetector init failed, using jsQR fallback:', err);
        barcodeDetectorRef.current = null;
      }
    }
  }, []);

  // Stop camera tracks and timers cleanly
  const stopCameraStream = useCallback(() => {
    isScanningActiveRef.current = false;

    if (scanTimerRef.current !== null) {
      clearTimeout(scanTimerRef.current);
      scanTimerRef.current = null;
    }

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
      toast.success(`Table QR Verified! Opening Table ${tableDisplay}...`, {
        icon: '🍽️',
        id: 'table-verified-toast',
      });

      if (onSuccess) {
        onSuccess(parsed);
      } else {
        // Direct navigation to the customer menu with table context and QR source established
        navigate(`/customer/restaurant/${parsed.tenantId}/menu?table=${tableDisplay}&source=qr`);
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
        setScanHint('Unrecognized code. Please scan the QR code on your table.');
        return false;
      }
    },
    [handleValidQr]
  );

  // Continuous frame-scanning loop with dual-engine (native BarcodeDetector + optimized jsQR)
  const scanFrame = useCallback(async () => {
    if (hasDetectedRef.current || !isScanningActiveRef.current) return;

    const video = videoRef.current;
    if (!video || video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) {
      // Video not ready with frame data yet; wait for next frame
      animFrameRef.current = requestAnimationFrame(scanFrame);
      return;
    }

    let detectedRawText: string | null = null;

    // 1. Primary Engine: Native Hardware BarcodeDetector (instant on Android Chrome)
    if (barcodeDetectorRef.current) {
      try {
        const barcodes = await barcodeDetectorRef.current.detect(video);
        if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
          detectedRawText = barcodes[0].rawValue;
        }
      } catch (_) {
        // Fall back to jsQR if detector fails on this frame
      }
    }

    // 2. Secondary Engine: Optimized jsQR with central crop & max 480x480 resolution
    if (!detectedRawText && !hasDetectedRef.current) {
      const canvas = canvasRef.current;
      if (canvas) {
        const vw = video.videoWidth;
        const vh = video.videoHeight;

        // Crop to the center square region (matching the user's on-screen viewfinder)
        const cropSize = Math.min(vw, vh);
        const startX = Math.floor((vw - cropSize) / 2);
        const startY = Math.floor((vh - cropSize) / 2);

        // Constrain canvas dimensions to max 480x480 for fast decoding
        const targetSize = Math.min(cropSize, 480);
        if (canvas.width !== targetSize || canvas.height !== targetSize) {
          canvas.width = targetSize;
          canvas.height = targetSize;
        }

        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (ctx) {
          ctx.drawImage(video, startX, startY, cropSize, cropSize, 0, 0, targetSize, targetSize);
          const imageData = ctx.getImageData(0, 0, targetSize, targetSize);

          // Support both standard and inverted QR patterns
          const code = jsQR(imageData.data, targetSize, targetSize, {
            inversionAttempts: 'attemptBoth',
          });

          if (code && code.data) {
            detectedRawText = code.data;
          }
        }
      }
    }

    // If code detected:
    if (detectedRawText && !hasDetectedRef.current) {
      const parsed = parseSpiralDineQr(detectedRawText);
      if (parsed) {
        hasDetectedRef.current = true;
        handleValidQr(parsed);
        return;
      } else {
        setScanHint('QR detected, but not a SpiralDine table. Center table card.');
      }
    }

    // Schedule next frame with 60ms throttle (~16 checks/sec, 60fps smooth video, zero CPU choke)
    if (isScanningActiveRef.current && !hasDetectedRef.current) {
      scanTimerRef.current = setTimeout(() => {
        animFrameRef.current = requestAnimationFrame(scanFrame);
      }, 60);
    }
  }, [handleValidQr]);

  // Start camera stream
  const startCamera = useCallback(async () => {
    stopCameraStream();
    hasDetectedRef.current = false;
    isScanningActiveRef.current = false;
    setStatus('requesting');
    setErrorMessage(null);
    setScanHint('Position the table QR code inside the frame');

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
        const video = videoRef.current;
        video.srcObject = stream;
        video.setAttribute('playsinline', 'true');
        video.setAttribute('autoplay', 'true');
        video.muted = true;

        // Wait until video has begun playing before starting loop
        await video.play().catch((playErr) => {
          console.warn('[QrScannerModal] Video play warning:', playErr);
        });

        setStatus('active');
        isScanningActiveRef.current = true;
        animFrameRef.current = requestAnimationFrame(scanFrame);
      }
    } catch (err: any) {
      console.warn('[QrScannerModal] Camera error:', err);
      if (
        err?.name === 'NotAllowedError' ||
        err?.name === 'PermissionDeniedError' ||
        err?.name === 'SecurityError'
      ) {
        setStatus('denied');
        setErrorMessage('Camera access was blocked. Please enable camera permissions in your browser or enter your table code manually.');
      } else if (err?.name === 'NotFoundError' || err?.name === 'DevicesNotFoundError') {
        setStatus('unsupported');
        setErrorMessage('No camera device was found on this device.');
      } else {
        setStatus('error');
        setErrorMessage('Unable to start camera. Please try again or use manual table entry.');
      }
      setShowManualFallback(true);
    }
  }, [scanFrame, stopCameraStream]);

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
      className="fixed inset-0 z-50 bg-[#202124]/80 backdrop-blur-md flex items-center justify-center p-2 min-[340px]:p-4 sm:p-6 overflow-y-auto animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-sm bg-[#FCFAF7] border border-[#E5DCD5] rounded-2xl sm:rounded-3xl shadow-2xl p-3.5 min-[340px]:p-5 sm:p-6 text-center overflow-hidden flex flex-col items-center min-w-0">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close QR scanner"
          className="absolute top-3 right-3 sm:top-4 sm:right-4 p-1.5 sm:p-2 bg-white/90 hover:bg-[#F3E8DF] border border-[#E5DCD5] rounded-full text-[#756B64] hover:text-[#202124] transition-colors cursor-pointer shadow-xs z-20"
        >
          <X className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
        </button>

        {/* Header */}
        <div className="space-y-1 mb-3 sm:mb-4 pt-1 w-full min-w-0">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#F3E8DF] text-[#C85A3F] text-[10px] font-extrabold uppercase tracking-wider mb-1">
            <ScanLine className="w-3.5 h-3.5" />
            <span>Live Table Scanner</span>
          </div>
          <h3 id="qr-scanner-title" className="text-sm sm:text-base font-extrabold text-[#202124] truncate px-6">
            Scan Table QR Code
          </h3>
          <p className="text-[11px] sm:text-xs text-[#756B64] font-medium max-w-xs mx-auto">
            {scanHint}
          </p>
        </div>

        {/* Viewfinder Window */}
        <div className="relative w-full max-w-[260px] aspect-square rounded-2xl overflow-hidden bg-black border-2 border-[#C85A3F]/80 shadow-inner flex items-center justify-center">
          {/* Live Video Feed */}
          <video
            ref={videoRef}
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${
              status === 'active' ? 'opacity-100' : 'opacity-0'
            }`}
            muted
            playsInline
            autoPlay
          />

          {/* Offscreen Canvas for Frame Decoding */}
          <canvas ref={canvasRef} className="hidden" />

          {/* Active Camera Viewfinder Overlay */}
          {status === 'active' && (
            <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-between p-4">
              {/* Corner targeting marks */}
              <div className="absolute top-3 left-3 w-7 h-7 border-t-3 border-l-3 border-[#C85A3F] rounded-tl-lg" />
              <div className="absolute top-3 right-3 w-7 h-7 border-t-3 border-r-3 border-[#C85A3F] rounded-tr-lg" />
              <div className="absolute bottom-3 left-3 w-7 h-7 border-b-3 border-l-3 border-[#C85A3F] rounded-bl-lg" />
              <div className="absolute bottom-3 right-3 w-7 h-7 border-b-3 border-r-3 border-[#C85A3F] rounded-br-lg" />

              {/* Laser scanning beam */}
              <div className="absolute inset-x-6 top-1/2 -translate-y-1/2 h-0.5 bg-gradient-to-r from-transparent via-[#C85A3F] to-transparent shadow-[0_0_12px_#C85A3F] animate-pulse" />

              <div className="w-full flex justify-center pt-1">
                <span className="text-[10px] font-extrabold text-white/95 bg-black/65 px-3 py-1 rounded-full backdrop-blur-xs flex items-center gap-1.5 shadow-sm">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  <span>Camera Active — Aim at Table QR</span>
                </span>
              </div>

              <div className="w-full flex justify-center pb-1">
                <span className="text-[9.5px] font-bold text-white/80 bg-black/50 px-2.5 py-0.5 rounded-full">
                  Hold steady 10–20 cm away
                </span>
              </div>
            </div>
          )}

          {/* Loading / Requesting Camera State */}
          {status === 'requesting' && (
            <div className="flex flex-col items-center justify-center space-y-2 p-4 text-center text-white">
              <Camera className="w-8 h-8 text-[#C85A3F] animate-pulse" />
              <p className="text-xs font-semibold text-white/90">Starting camera...</p>
              <p className="text-[10px] text-white/60">Please allow camera permissions if prompted</p>
            </div>
          )}

          {/* Permission Denied State */}
          {status === 'denied' && (
            <div className="flex flex-col items-center justify-center space-y-2.5 p-4 text-center bg-[#FCFAF7] h-full w-full">
              <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h4 className="text-xs font-bold text-[#202124]">Camera Permission Blocked</h4>
              <p className="text-[11px] text-[#756B64] leading-relaxed">
                Camera access was denied. Please allow camera permissions in your browser address bar or use manual entry below.
              </p>
              <button
                type="button"
                onClick={startCamera}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#C85A3F] text-white text-xs font-bold rounded-lg hover:bg-[#A94332] transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Retry Camera</span>
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
              <span className="text-xs font-bold">QR Verified! Opening Menu...</span>
            </div>
          )}
        </div>

        {/* Fallback & Manual Input Section */}
        <div className="w-full mt-4 space-y-2.5">
          <button
            type="button"
            onClick={() => setShowManualFallback(!showManualFallback)}
            className="text-xs text-[#C85A3F] hover:text-[#A94332] font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Keyboard className="w-3.5 h-3.5" />
            <span>{showManualFallback ? 'Hide manual entry' : 'Trouble scanning? Enter table code manually'}</span>
          </button>

          {showManualFallback && (
            <form onSubmit={handleManualSubmit} className="space-y-2 text-left pt-1 w-full animate-in fade-in duration-150">
              <label htmlFor="manual-table-code" className="text-[11px] font-bold text-[#756B64] block">
                Restaurant & Table Code (e.g. bawarchi-restaurant/12 or table URL)
              </label>
              <div className="flex flex-col min-[300px]:flex-row gap-2">
                <input
                  id="manual-table-code"
                  type="text"
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                  placeholder="restaurant-id/table-number"
                  className="flex-1 min-w-0 px-3 py-2 text-xs bg-white border border-[#E5DCD5] rounded-xl text-[#202124] focus:outline-none focus:ring-2 focus:ring-[#C85A3F]/50 font-mono"
                />
                <button
                  type="submit"
                  disabled={!manualInput.trim()}
                  className="px-3.5 py-2 bg-[#C85A3F] hover:bg-[#A94332] disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer shrink-0 text-center"
                >
                  Open Table
                </button>
              </div>
            </form>
          )}

          <div className="pt-2 text-center">
            <span className="text-[10px] text-[#756B64] font-medium flex items-center justify-center gap-1">
              <Info className="w-3 h-3 text-[#756B64]/70" />
              <span>Table QR codes are located on your dining table stand.</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QrScannerModal;
