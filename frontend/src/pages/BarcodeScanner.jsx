import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Quagga from '@ericblade/quagga2';
import { Layout } from '../components/Layout';
import { GlassCard, GlassCardContent, GlassCardHeader, GlassCardTitle } from '../components/GlassCard';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { useTheme } from '../context/ThemeContext';
import { cn } from '../lib/utils';
import { 
  ScanBarcode, 
  Camera, 
  Loader2, 
  Package,
  AlertTriangle,
  CameraOff,
  ScanLine
} from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export const BarcodeScanner = () => {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const [barcode, setBarcode] = useState('');
  const [loading, setLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraSupported, setCameraSupported] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const canvasRef = useRef(null);
  const scanIntervalRef = useRef(null);

  const getToken = () => localStorage.getItem('token');

  // Check camera support on mount
  useEffect(() => {
    const checkCameraSupport = async () => {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          setCameraSupported(false);
          setCameraError('Camera API not available');
          return;
        }
        // On mobile, assume camera is available
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        if (isMobile) {
          setCameraSupported(true);
          return;
        }
        // On desktop, check for camera
        const devices = await navigator.mediaDevices.enumerateDevices();
        const hasCamera = devices.some(device => device.kind === 'videoinput');
        setCameraSupported(hasCamera);
        if (!hasCamera) {
          setCameraError('No camera detected');
        }
      } catch (err) {
        console.error('Camera check error:', err);
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        setCameraSupported(isMobile);
      }
    };
    checkCameraSupport();
  }, []);

  const lookupBarcode = async (code) => {
    if (!code || code.length < 8) {
      toast.error('Please enter a valid barcode (8-14 digits)');
      return;
    }

    setLoading(true);
    setNotFound(false);

    try {
      const res = await fetch(`${API_URL}/api/barcode/lookup/${code}`, {
        headers: {
          'Authorization': `Bearer ${getToken()}`,
        },
      });

      if (res.status === 404) {
        setNotFound(true);
        toast.error('Food not found');
        return;
      }

      if (!res.ok) {
        throw new Error('Lookup failed');
      }

      const data = await res.json();
      
      // Stop camera after successful scan
      if (cameraActive) {
        stopCamera();
      }
      
      // Navigate to food details page
      toast.success(`Found: ${data.product_name || 'Product'}`);
      navigate(`/food/${data.fdc_id}`);
    } catch (err) {
      toast.error('Failed to look up barcode');
    } finally {
      setLoading(false);
    }
  };

  const handleManualLookup = () => {
    lookupBarcode(barcode);
  };

  // Scan for barcode using Quagga on a video frame
  const scanVideoFrame = useCallback(() => {
    if (!videoRef.current || !canvasRef.current || scanning) return;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    if (video.readyState !== video.HAVE_ENOUGH_DATA) return;
    
    // Set canvas size to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    // Draw video frame to canvas
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Get image data for Quagga
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    
    setScanning(true);
    
    Quagga.decodeSingle({
      src: canvas.toDataURL('image/jpeg'),
      numOfWorkers: 0,
      decoder: {
        readers: ['ean_reader', 'ean_8_reader', 'upc_reader', 'upc_e_reader', 'code_128_reader']
      },
      locate: true
    }, (result) => {
      setScanning(false);
      if (result && result.codeResult && result.codeResult.code) {
        const code = result.codeResult.code;
        if (code.length >= 8) {
          setBarcode(code);
          toast.success(`Barcode detected: ${code}`);
          stopCamera();
          lookupBarcode(code);
        }
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanning]);

  const startCamera = async () => {
    setCameraError(null);
    
    try {
      // Request camera access with back camera preferred
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });
      
      streamRef.current = stream;
      
      // Set camera active first so video element renders
      setCameraActive(true);
      
      // Wait for DOM update
      await new Promise(resolve => setTimeout(resolve, 100));
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        
        // Start scanning interval - try native BarcodeDetector first, fallback to Quagga
        if ('BarcodeDetector' in window) {
          const detector = new window.BarcodeDetector({
            formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128']
          });
          
          scanIntervalRef.current = setInterval(async () => {
            if (!videoRef.current || scanning) return;
            try {
              const barcodes = await detector.detect(videoRef.current);
              if (barcodes.length > 0) {
                const code = barcodes[0].rawValue;
                setBarcode(code);
                toast.success(`Barcode detected: ${code}`);
                stopCamera();
                lookupBarcode(code);
              }
            } catch (e) {
              // Ignore detection errors
            }
          }, 300);
        } else {
          // Use Quagga for barcode detection on video frames
          scanIntervalRef.current = setInterval(scanVideoFrame, 500);
        }
        
        toast.info('Camera active. Position barcode in view.');
      }
    } catch (err) {
      console.error('Camera error:', err);
      setCameraActive(false);
      const errorMsg = err.name === 'NotAllowedError' 
        ? 'Camera permission denied. Please allow camera access in your browser settings.'
        : err.name === 'NotFoundError'
        ? 'No camera found on this device.'
        : `Could not access camera: ${err.message}`;
      setCameraError(errorMsg);
      toast.error(errorMsg);
    }
  };

  const stopCamera = () => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    
    setCameraActive(false);
    setScanning(false);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (scanIntervalRef.current) {
        clearInterval(scanIntervalRef.current);
      }
    };
  }, []);

  return (
    <Layout>
      <div className={cn(
        "min-h-screen p-4 md:p-8 max-w-2xl mx-auto",
        theme === 'dark' ? 'bg-zinc-950' : 'bg-gray-50'
      )}>
        {/* Header */}
        <div className="mb-6">
          <h1 className={cn(
            "text-2xl md:text-3xl font-bold",
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          )}>
            Barcode Scanner
          </h1>
          <p className={cn(
            "mt-1 text-sm",
            theme === 'dark' ? 'text-zinc-500' : 'text-gray-500'
          )}>
            Scan or enter a barcode to find food
          </p>
        </div>

        {/* Camera Scanner Section */}
        {!cameraActive && (
          <GlassCard className="mb-6" data-testid="camera-scanner-card">
            <GlassCardContent className="py-8">
              <div className="flex flex-col items-center">
                {cameraSupported === null ? (
                  <div className="flex flex-col items-center">
                    <div className={cn(
                      "w-24 h-24 rounded-full flex items-center justify-center mb-4",
                      theme === 'dark' ? 'bg-cyan-500/10' : 'bg-cyan-100'
                    )}>
                      <Loader2 className="w-12 h-12 text-cyan-500 animate-spin" />
                    </div>
                    <p className={theme === 'dark' ? 'text-zinc-400' : 'text-gray-500'}>
                      Checking camera...
                    </p>
                  </div>
                ) : cameraSupported === false ? (
                  <div className="flex flex-col items-center text-center">
                    <div className={cn(
                      "w-24 h-24 rounded-full flex items-center justify-center mb-4",
                      theme === 'dark' ? 'bg-zinc-800' : 'bg-gray-200'
                    )}>
                      <CameraOff className={cn(
                        "w-12 h-12",
                        theme === 'dark' ? 'text-zinc-500' : 'text-gray-400'
                      )} />
                    </div>
                    <p className={theme === 'dark' ? 'text-zinc-400' : 'text-gray-500'}>
                      Camera not available
                    </p>
                    {cameraError && (
                      <p className="text-xs text-red-400 max-w-xs mt-2">{cameraError}</p>
                    )}
                  </div>
                ) : (
                  <>
                    <button
                      onClick={startCamera}
                      data-testid="camera-scan-btn"
                      className="w-28 h-28 rounded-full bg-gradient-to-br from-cyan-500 to-emerald-500 flex items-center justify-center mb-4 shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 transition-all active:scale-95"
                    >
                      <Camera className="w-14 h-14 text-white" />
                    </button>
                    <p className={cn(
                      "font-semibold text-lg mb-1",
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>
                      Tap to Scan
                    </p>
                    <p className={theme === 'dark' ? 'text-zinc-400' : 'text-gray-500'}>
                      Point camera at barcode
                    </p>
                  </>
                )}
              </div>
            </GlassCardContent>
          </GlassCard>
        )}

        {/* Active Camera View */}
        {cameraActive && (
          <GlassCard className="mb-6" data-testid="camera-active-card">
            <GlassCardContent className="p-2">
              <div className="relative rounded-xl overflow-hidden bg-black aspect-[4/3]">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
                <canvas ref={canvasRef} className="hidden" />
                {/* Scan overlay */}
                <div className="absolute inset-0 pointer-events-none z-10">
                  <div className="absolute inset-4 border-2 border-cyan-400/50 rounded-lg" />
                  <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                    <div className="w-56 h-24 border-2 border-emerald-400 rounded-lg bg-emerald-400/5 flex items-center justify-center">
                      <ScanLine className="w-8 h-8 text-emerald-400 animate-pulse" />
                    </div>
                  </div>
                </div>
                <div className="absolute bottom-0 left-0 right-0 bg-black/70 py-2 px-4 z-10">
                  <p className="text-cyan-400 text-sm text-center">
                    {scanning ? 'Scanning...' : 'Position barcode in the frame'}
                  </p>
                </div>
              </div>
              <button
                onClick={stopCamera}
                data-testid="stop-camera-btn"
                className="w-full mt-3 py-3 rounded-xl bg-red-500/20 text-red-400 border border-red-500/30 font-medium flex items-center justify-center gap-2"
              >
                <CameraOff className="w-5 h-5" />
                Stop Scanning
              </button>
            </GlassCardContent>
          </GlassCard>
        )}

        {/* Manual Barcode Input */}
        <GlassCard data-testid="barcode-input-card">
          <GlassCardHeader>
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center",
                theme === 'dark' ? 'bg-cyan-500/20' : 'bg-cyan-100'
              )}>
                <ScanBarcode className="w-5 h-5 text-cyan-500" />
              </div>
              <GlassCardTitle>Enter Barcode</GlassCardTitle>
            </div>
          </GlassCardHeader>
          <GlassCardContent className="space-y-4">
            <div className="space-y-2">
              <Label className={theme === 'dark' ? 'text-zinc-400' : 'text-gray-600'}>
                Barcode / UPC
              </Label>
              <Input
                value={barcode}
                onChange={(e) => {
                  setBarcode(e.target.value.replace(/\D/g, ''));
                  setNotFound(false);
                }}
                onKeyDown={(e) => e.key === 'Enter' && handleManualLookup()}
                placeholder="Enter 8-14 digit barcode"
                data-testid="barcode-input"
                maxLength={14}
                className={cn(
                  "h-14 text-xl font-mono tracking-wider",
                  theme === 'dark' 
                    ? 'bg-black/50 border-white/10 text-white placeholder:text-zinc-600'
                    : 'bg-white border-gray-200 text-gray-900 placeholder:text-gray-400'
                )}
              />
            </div>

            <button
              onClick={handleManualLookup}
              disabled={loading || barcode.length < 8}
              data-testid="lookup-barcode-btn"
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-bold px-6 py-3.5 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <ScanBarcode className="w-5 h-5" />
                  Look Up Product
                </>
              )}
            </button>

            {/* Not Found Message */}
            {notFound && (
              <div className={cn(
                "flex items-center gap-3 p-4 rounded-xl",
                theme === 'dark' ? 'bg-red-500/10 border border-red-500/20' : 'bg-red-50 border border-red-200'
              )}>
                <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
                <div>
                  <p className={cn(
                    "font-medium",
                    theme === 'dark' ? 'text-red-400' : 'text-red-600'
                  )}>
                    Food not found
                  </p>
                  <p className={cn(
                    "text-sm mt-0.5",
                    theme === 'dark' ? 'text-red-400/70' : 'text-red-500/70'
                  )}>
                    This barcode is not in our database
                  </p>
                </div>
              </div>
            )}

            <p className={cn(
              "text-xs text-center",
              theme === 'dark' ? 'text-zinc-600' : 'text-gray-500'
            )}>
              Data from Open Food Facts database
            </p>
          </GlassCardContent>
        </GlassCard>
      </div>
    </Layout>
  );
};
