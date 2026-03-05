import { useState, useRef, useEffect, useCallback } from 'react';
import Quagga from '@ericblade/quagga2';
import { Layout } from '../components/Layout';
import { GlassCard, GlassCardContent, GlassCardHeader, GlassCardTitle } from '../components/GlassCard';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { 
  ScanBarcode, 
  Camera, 
  Loader2, 
  Package,
  Plus,
  AlertTriangle,
  CameraOff,
  ScanLine
} from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export const BarcodeScanner = () => {
  const [barcode, setBarcode] = useState('');
  const [loading, setLoading] = useState(false);
  const [product, setProduct] = useState(null);
  const [logDialogOpen, setLogDialogOpen] = useState(false);
  const [servings, setServings] = useState(1);
  const [servingSize, setServingSize] = useState(100);
  const [mealType, setMealType] = useState('snack');
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraSupported, setCameraSupported] = useState(null); // null = checking
  const [scanning, setScanning] = useState(false);
  const [useQuagga, setUseQuagga] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const videoRef = useRef(null);
  const scannerRef = useRef(null);
  const streamRef = useRef(null);
  const scanIntervalRef = useRef(null);

  const getToken = () => localStorage.getItem('token');

  // Check camera support on mount - more robust detection
  useEffect(() => {
    const checkCameraSupport = async () => {
      try {
        // Check if mediaDevices API is available
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          setCameraSupported(false);
          setCameraError('Camera API not available');
          return;
        }

        // On mobile, assume camera is available (permissions will be requested when needed)
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        
        if (isMobile) {
          setCameraSupported(true);
          // Check if BarcodeDetector is available
          if (!('BarcodeDetector' in window)) {
            setUseQuagga(true);
          }
          return;
        }
        
        // On desktop, try to enumerate devices
        const devices = await navigator.mediaDevices.enumerateDevices();
        const hasCamera = devices.some(device => device.kind === 'videoinput');
        setCameraSupported(hasCamera);
        
        if (!hasCamera) {
          setCameraError('No camera detected');
        }
        
        // Check if BarcodeDetector is available
        if (!('BarcodeDetector' in window)) {
          setUseQuagga(true);
        }
      } catch (err) {
        console.error('Camera check error:', err);
        // Don't immediately disable - let user try anyway on mobile
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        setCameraSupported(isMobile);
        if (!isMobile) {
          setCameraError('Could not detect camera');
        }
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
    setProduct(null);

    try {
      const res = await fetch(`${API_URL}/api/barcode/${code}`, {
        headers: {
          'Authorization': `Bearer ${getToken()}`,
        },
      });

      if (res.status === 404) {
        toast.error('Product not found in database');
        return;
      }

      if (!res.ok) {
        throw new Error('Lookup failed');
      }

      const data = await res.json();
      setProduct(data);
      toast.success('Product found!');
      
      // Stop camera after successful scan
      if (cameraActive) {
        stopCamera();
      }
    } catch (err) {
      toast.error('Failed to look up barcode');
    } finally {
      setLoading(false);
    }
  };

  const handleManualLookup = () => {
    lookupBarcode(barcode);
  };

  const handleAddToLog = async () => {
    if (!product) return;

    try {
      const res = await fetch(
        `${API_URL}/api/barcode/log?barcode=${product.barcode}&servings=${servings}&serving_size=${servingSize}&meal_type=${mealType}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${getToken()}`,
          },
        }
      );

      if (!res.ok) throw new Error('Failed to log');

      toast.success('Added to food log!');
      setLogDialogOpen(false);
      setProduct(null);
      setBarcode('');
      setServings(1);
      setServingSize(100);
    } catch (err) {
      toast.error('Failed to add to log');
    }
  };

  const scanBarcode = useCallback(async () => {
    if (!videoRef.current || scanning) return;
    
    // Only use native BarcodeDetector if available
    if (!useQuagga && 'BarcodeDetector' in window) {
      setScanning(true);
      try {
        const barcodeDetector = new window.BarcodeDetector({
          formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39']
        });
        
        const barcodes = await barcodeDetector.detect(videoRef.current);
        
        if (barcodes.length > 0) {
          const detectedCode = barcodes[0].rawValue;
          setBarcode(detectedCode);
          toast.success(`Barcode detected: ${detectedCode}`);
          lookupBarcode(detectedCode);
        }
      } catch (err) {
        // Silently fail - normal when no barcode in view
      } finally {
        setScanning(false);
      }
    }
  }, [scanning, useQuagga]);

  const startCamera = async () => {
    setCameraError(null);
    
    if (useQuagga) {
      // Use Quagga2 for scanning
      try {
        // First request camera permission
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' }
        });
        // Stop the test stream
        stream.getTracks().forEach(track => track.stop());
        
        await Quagga.init({
          inputStream: {
            name: 'Live',
            type: 'LiveStream',
            target: scannerRef.current,
            constraints: {
              width: { min: 320, ideal: 640, max: 1280 },
              height: { min: 240, ideal: 480, max: 720 },
              facingMode: 'environment'
            }
          },
          decoder: {
            readers: [
              'ean_reader',
              'ean_8_reader',
              'upc_reader',
              'upc_e_reader',
              'code_128_reader'
            ]
          },
          locate: true,
          locator: {
            patchSize: 'medium',
            halfSample: true
          }
        });

        Quagga.onDetected((result) => {
          const code = result.codeResult.code;
          if (code && code.length >= 8) {
            Quagga.stop();
            setCameraActive(false);
            setBarcode(code);
            toast.success(`Barcode detected: ${code}`);
            lookupBarcode(code);
          }
        });

        Quagga.start();
        setCameraActive(true);
        toast.info('Camera active. Position barcode in view.');
      } catch (err) {
        console.error('Camera error:', err);
        const errorMsg = err.name === 'NotAllowedError' 
          ? 'Camera permission denied. Please allow camera access in your browser settings.'
          : err.name === 'NotFoundError'
          ? 'No camera found on this device.'
          : 'Could not access camera. Please check permissions.';
        setCameraError(errorMsg);
        toast.error(errorMsg);
      }
    } else {
      // Use native BarcodeDetector
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: 1280, height: 720 }
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setCameraActive(true);
        toast.info('Camera active. Position barcode in view.');
        
        // Start scanning interval
        scanIntervalRef.current = setInterval(scanBarcode, 500);
      } catch (err) {
        console.error('Camera error:', err);
        const errorMsg = err.name === 'NotAllowedError' 
          ? 'Camera permission denied. Please allow camera access.'
          : err.name === 'NotFoundError'
          ? 'No camera found on this device.'
          : 'Could not access camera. Please check permissions.';
        setCameraError(errorMsg);
        toast.error(errorMsg);
      }
    }
  };

  const stopCamera = () => {
    if (useQuagga) {
      try {
        Quagga.stop();
      } catch (err) {
        // Ignore errors when stopping
      }
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    setCameraActive(false);
  };

  useEffect(() => {
    return () => {
      if (useQuagga) {
        try {
          Quagga.stop();
        } catch (err) {
          // Ignore
        }
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (scanIntervalRef.current) {
        clearInterval(scanIntervalRef.current);
      }
    };
  }, [useQuagga]);

  return (
    <Layout>
      <div className="p-4 md:p-8 max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="font-heading text-2xl md:text-4xl font-bold text-foreground dark:text-white">
            Barcode Scanner
          </h1>
          <p className="text-muted-foreground dark:text-zinc-500 mt-1 text-sm">
            Scan or enter product barcodes to quickly log packaged foods
          </p>
        </div>

        {/* Camera Scanner Section - Primary Action */}
        {!cameraActive && (
          <GlassCard className="mb-6" data-testid="camera-scanner-card">
            <GlassCardContent className="py-8">
              {/* Big Camera Button */}
              <div className="flex flex-col items-center">
                {cameraSupported === null ? (
                  // Loading state
                  <div className="flex flex-col items-center">
                    <div className="w-24 h-24 rounded-full bg-cyan-500/10 flex items-center justify-center mb-4">
                      <Loader2 className="w-12 h-12 text-cyan-400 animate-spin" />
                    </div>
                    <p className="text-muted-foreground dark:text-zinc-400">Checking camera...</p>
                  </div>
                ) : cameraSupported === false ? (
                  // Camera not supported
                  <div className="flex flex-col items-center text-center">
                    <div className="w-24 h-24 rounded-full bg-zinc-800/50 flex items-center justify-center mb-4">
                      <CameraOff className="w-12 h-12 text-zinc-500" />
                    </div>
                    <p className="text-muted-foreground dark:text-zinc-400 mb-2">Camera not available</p>
                    {cameraError && (
                      <p className="text-xs text-red-400 max-w-xs">{cameraError}</p>
                    )}
                    <p className="text-xs text-muted-foreground dark:text-zinc-500 mt-2">
                      Enter the barcode manually below
                    </p>
                  </div>
                ) : (
                  // Camera supported - show scan button
                  <>
                    <button
                      onClick={startCamera}
                      data-testid="camera-scan-btn"
                      className="w-28 h-28 rounded-full bg-gradient-to-br from-cyan-500 to-emerald-500 flex items-center justify-center mb-4 shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 transition-all active:scale-95"
                    >
                      <Camera className="w-14 h-14 text-white" />
                    </button>
                    <p className="text-foreground dark:text-white font-semibold text-lg mb-1">
                      Tap to Scan
                    </p>
                    <p className="text-muted-foreground dark:text-zinc-400 text-sm">
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
                {useQuagga ? (
                  <div 
                    ref={scannerRef} 
                    id="scanner-container"
                    className="w-full h-full absolute inset-0"
                    style={{ 
                      position: 'relative',
                      overflow: 'hidden'
                    }}
                  />
                ) : (
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                )}
                {/* Scan frame overlay */}
                <div className="absolute inset-0 pointer-events-none z-10">
                  <div className="absolute inset-4 border-2 border-cyan-400/50 rounded-lg" />
                  <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                    <div className="w-56 h-24 border-2 border-emerald-400 rounded-lg bg-emerald-400/5 flex items-center justify-center">
                      <ScanLine className="w-8 h-8 text-emerald-400 animate-pulse" />
                    </div>
                  </div>
                </div>
                {/* Status bar */}
                <div className="absolute bottom-0 left-0 right-0 bg-black/70 py-2 px-4 z-10">
                  <p className="text-cyan-400 text-sm text-center">
                    {scanning ? 'Scanning...' : 'Position barcode in the frame'}
                  </p>
                </div>
              </div>
              {/* Stop button */}
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Manual Barcode Input */}
          <GlassCard data-testid="barcode-input-card">
            <GlassCardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center">
                  <ScanBarcode className="w-5 h-5 text-cyan-400" />
                </div>
                <GlassCardTitle>Enter Barcode Manually</GlassCardTitle>
              </div>
            </GlassCardHeader>
            <GlassCardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-muted-foreground dark:text-zinc-400">Barcode / UPC</Label>
                <Input
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value.replace(/\D/g, ''))}
                  onKeyDown={(e) => e.key === 'Enter' && handleManualLookup()}
                  placeholder="Enter 8-14 digit barcode"
                  data-testid="barcode-input"
                  maxLength={14}
                  className="bg-black/50 border-white/10 text-foreground dark:text-white placeholder:text-zinc-600 h-14 text-xl font-mono tracking-wider"
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

              <p className="text-xs text-muted-foreground dark:text-zinc-600 text-center">
                Data from Open Food Facts database
              </p>
            </GlassCardContent>
          </GlassCard>

          {/* Product Result */}
          <GlassCard data-testid="product-result-card">
            <GlassCardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-violet-500/20 flex items-center justify-center">
                  <Package className="w-5 h-5 text-violet-400" />
                </div>
                <GlassCardTitle>Product Info</GlassCardTitle>
              </div>
            </GlassCardHeader>
            <GlassCardContent>
              {product ? (
                <div className="space-y-6">
                  {/* Product Image & Name */}
                  <div className="flex gap-4">
                    {product.image_url && (
                      <img
                        src={product.image_url}
                        alt={product.product_name}
                        className="w-24 h-24 rounded-xl object-cover bg-zinc-800"
                      />
                    )}
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-foreground dark:text-white">
                        {product.product_name || 'Unknown Product'}
                      </h3>
                      <p className="text-sm text-muted-foreground dark:text-zinc-500">{product.brand || 'Unknown Brand'}</p>
                      <p className="text-xs text-muted-foreground dark:text-zinc-600 mt-1 font-mono">{product.barcode}</p>
                    </div>
                  </div>

                  {/* Nutrition per 100g */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-xl bg-black/30 dark:bg-black/30 bg-emerald-50 border border-emerald-200 dark:border-white/5">
                      <p className="text-2xl font-semibold text-emerald-600 dark:text-emerald-400">
                        {product.protein_per_100g?.toFixed(1) || 0}g
                      </p>
                      <p className="text-xs text-muted-foreground dark:text-zinc-500">Protein</p>
                    </div>
                    <div className="p-3 rounded-xl bg-gray-50 dark:bg-black/30 border border-gray-200 dark:border-white/5">
                      <p className="text-2xl font-semibold text-foreground dark:text-zinc-300">
                        {product.calories_per_100g?.toFixed(0) || 0}
                      </p>
                      <p className="text-xs text-muted-foreground dark:text-zinc-500">Calories</p>
                    </div>
                    <div className="p-3 rounded-xl bg-gray-50 dark:bg-black/30 border border-gray-200 dark:border-white/5">
                      <p className="text-2xl font-semibold text-foreground dark:text-zinc-300">
                        {product.fat_per_100g?.toFixed(1) || 0}g
                      </p>
                      <p className="text-xs text-muted-foreground dark:text-zinc-500">Fat</p>
                    </div>
                    <div className="p-3 rounded-xl bg-gray-50 dark:bg-black/30 border border-gray-200 dark:border-white/5">
                      <p className="text-2xl font-semibold text-foreground dark:text-zinc-300">
                        {product.carbs_per_100g?.toFixed(1) || 0}g
                      </p>
                      <p className="text-xs text-muted-foreground dark:text-zinc-500">Carbs</p>
                    </div>
                  </div>

                  {/* Note about amino acids */}
                  <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                    <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-amber-600 dark:text-amber-400/80">
                      Amino acid data not available for packaged products. Use USDA search for detailed amino acid profiles.
                    </p>
                  </div>

                  <button
                    onClick={() => setLogDialogOpen(true)}
                    data-testid="add-barcode-to-log-btn"
                    className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-bold px-6 py-3.5 rounded-xl transition-all flex items-center justify-center gap-2"
                  >
                    <Plus className="w-5 h-5" />
                    Add to Food Log
                  </button>
                </div>
              ) : (
                <div className="py-16 text-center">
                  <ScanBarcode className="w-16 h-16 text-muted-foreground/30 dark:text-zinc-800 mx-auto mb-4" />
                  <p className="text-muted-foreground dark:text-zinc-500">
                    Enter a barcode to see product information
                  </p>
                  <p className="text-xs text-muted-foreground dark:text-zinc-600 mt-2">
                    Supports UPC-A, EAN-13, and other formats
                  </p>
                </div>
              )}
            </GlassCardContent>
          </GlassCard>
        </div>
      </div>

      {/* Add to Log Dialog */}
      <Dialog open={logDialogOpen} onOpenChange={setLogDialogOpen}>
        <DialogContent className="bg-zinc-900 border-white/10 text-white" aria-describedby="add-to-log-description">
          <DialogHeader>
            <DialogTitle className="font-heading">Add to Food Log</DialogTitle>
          </DialogHeader>
          <p id="add-to-log-description" className="sr-only">
            Configure serving size and add this product to your food log
          </p>
          <div className="space-y-6 pt-4">
            <div>
              <p className="text-white font-medium">{product?.product_name || 'Product'}</p>
              <p className="text-sm text-zinc-500 mt-1">
                {product?.protein_per_100g?.toFixed(1) || 0}g protein per 100g
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-zinc-400">Serving size (grams)</Label>
              <Input
                type="number"
                value={servingSize}
                onChange={(e) => setServingSize(parseFloat(e.target.value) || 100)}
                min={1}
                data-testid="serving-size-input"
                className="bg-black/50 border-white/10 text-white h-12"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-zinc-400">Number of servings</Label>
              <Input
                type="number"
                value={servings}
                onChange={(e) => setServings(parseFloat(e.target.value) || 1)}
                min={0.25}
                step={0.25}
                data-testid="barcode-servings-input"
                className="bg-black/50 border-white/10 text-white h-12"
              />
              <p className="text-sm text-emerald-400">
                Total: {((product?.protein_per_100g || 0) * (servingSize / 100) * servings).toFixed(1)}g protein
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-zinc-400">Meal type</Label>
              <Select value={mealType} onValueChange={setMealType}>
                <SelectTrigger data-testid="barcode-meal-type" className="bg-black/50 border-white/10 text-white h-12">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-white/10">
                  <SelectItem value="breakfast">Breakfast</SelectItem>
                  <SelectItem value="lunch">Lunch</SelectItem>
                  <SelectItem value="dinner">Dinner</SelectItem>
                  <SelectItem value="snack">Snack</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <button
              onClick={handleAddToLog}
              data-testid="confirm-barcode-log-btn"
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-bold px-8 py-3.5 rounded-full transition-all"
            >
              Add to Log
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
};
