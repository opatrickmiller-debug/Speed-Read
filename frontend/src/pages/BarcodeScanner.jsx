import { useState, useRef, useEffect } from 'react';
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
  CheckCircle2,
  X
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
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const getToken = () => localStorage.getItem('token');

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

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCameraActive(true);
      toast.info('Camera active. Position barcode in view.');
    } catch (err) {
      toast.error('Could not access camera');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  return (
    <Layout>
      <div className="p-6 md:p-8 max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="font-heading text-3xl md:text-4xl font-bold text-white">
            Barcode Scanner
          </h1>
          <p className="text-zinc-500 mt-2">
            Scan or enter product barcodes to quickly log packaged foods
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Scanner Input */}
          <GlassCard data-testid="barcode-input-card">
            <GlassCardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center">
                  <ScanBarcode className="w-5 h-5 text-cyan-400" />
                </div>
                <GlassCardTitle>Enter Barcode</GlassCardTitle>
              </div>
            </GlassCardHeader>
            <GlassCardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-zinc-400">Barcode / UPC</Label>
                <Input
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value.replace(/\D/g, ''))}
                  onKeyDown={(e) => e.key === 'Enter' && handleManualLookup()}
                  placeholder="Enter 8-14 digit barcode"
                  data-testid="barcode-input"
                  maxLength={14}
                  className="bg-black/50 border-white/10 text-white placeholder:text-zinc-600 h-14 text-xl font-mono tracking-wider"
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

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/10" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-zinc-900 px-2 text-zinc-500">or</span>
                </div>
              </div>

              <button
                onClick={cameraActive ? stopCamera : startCamera}
                data-testid="camera-btn"
                className={`w-full px-6 py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 font-medium ${
                  cameraActive 
                    ? 'bg-red-500/20 text-red-400 border border-red-500/30' 
                    : 'bg-white/5 text-white border border-white/10 hover:bg-white/10'
                }`}
              >
                <Camera className="w-5 h-5" />
                {cameraActive ? 'Stop Camera' : 'Use Camera'}
              </button>

              {cameraActive && (
                <div className="relative rounded-xl overflow-hidden bg-black aspect-video">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 border-2 border-cyan-400/50 m-8 rounded-lg" />
                  <p className="absolute bottom-4 left-0 right-0 text-center text-cyan-400 text-sm">
                    Position barcode in the frame
                  </p>
                </div>
              )}

              <p className="text-xs text-zinc-600 text-center">
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
                      <h3 className="text-lg font-semibold text-white">
                        {product.product_name || 'Unknown Product'}
                      </h3>
                      <p className="text-sm text-zinc-500">{product.brand || 'Unknown Brand'}</p>
                      <p className="text-xs text-zinc-600 mt-1 font-mono">{product.barcode}</p>
                    </div>
                  </div>

                  {/* Nutrition per 100g */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-xl bg-black/30 border border-white/5">
                      <p className="text-2xl font-semibold text-emerald-400">
                        {product.protein_per_100g?.toFixed(1) || 0}g
                      </p>
                      <p className="text-xs text-zinc-500">Protein</p>
                    </div>
                    <div className="p-3 rounded-xl bg-black/30 border border-white/5">
                      <p className="text-2xl font-semibold text-zinc-300">
                        {product.calories_per_100g?.toFixed(0) || 0}
                      </p>
                      <p className="text-xs text-zinc-500">Calories</p>
                    </div>
                    <div className="p-3 rounded-xl bg-black/30 border border-white/5">
                      <p className="text-2xl font-semibold text-zinc-300">
                        {product.fat_per_100g?.toFixed(1) || 0}g
                      </p>
                      <p className="text-xs text-zinc-500">Fat</p>
                    </div>
                    <div className="p-3 rounded-xl bg-black/30 border border-white/5">
                      <p className="text-2xl font-semibold text-zinc-300">
                        {product.carbs_per_100g?.toFixed(1) || 0}g
                      </p>
                      <p className="text-xs text-zinc-500">Carbs</p>
                    </div>
                  </div>

                  {/* Note about amino acids */}
                  <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                    <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-amber-400/80">
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
                  <ScanBarcode className="w-16 h-16 text-zinc-800 mx-auto mb-4" />
                  <p className="text-zinc-500">
                    Enter a barcode to see product information
                  </p>
                  <p className="text-xs text-zinc-600 mt-2">
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
        <DialogContent className="bg-zinc-900 border-white/10 text-white">
          <DialogHeader>
            <DialogTitle className="font-heading">Add to Food Log</DialogTitle>
          </DialogHeader>
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
