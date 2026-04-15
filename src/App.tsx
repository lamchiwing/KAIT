import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Cloud, Sun, CloudRain, Wind, Settings, ArrowRight, ChevronRight, ChevronLeft 
} from 'lucide-react';

// --- Constants ---
const GRADIENTS = {
  dawn: 'linear-gradient(135deg, #E6E6FA 0%, #FFFFFF 100%)',
  day: 'linear-gradient(135deg, #FDFDFD 0%, #F5F5F5 100%)',
  dusk: 'linear-gradient(135deg, #FFF5E6 0%, #FAD0C4 100%)',
  evening: 'linear-gradient(135deg, #E0E5EC 0%, #C9D6FF 100%)',
  midnight: 'linear-gradient(135deg, #121214 0%, #1A1A1D 100%)',
};

const TRANSLATIONS: any = {
  english: {
    intro: ["i am kait.", "let's sync with your senses.", "choose your destination."],
    begin: "BEGIN CALIBRATION",
    searchPlaceholder: "Search style (e.g. Linen, Leather)",
    dashboard: { recommended: "curated for you", share: "SYNC OUTLOOK" }
  },
  // ... 可擴充其他語言
};

export default function App() {
  const [stage, setStage] = useState('language');
  const [prefs, setPrefs] = useState({ language: 'english', locationEnabled: false, archetype: '' });
  const [weather, setWeather] = useState({ temp: '--', condition: 'calculating...' });
  const [products, setProducts] = useState([]);
  const [outlook, setOutlook] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // 1. 獲取地理位置與天氣搜尋
  const handleStart = async () => {
    setLoading(true);
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const { latitude, longitude } = pos.coords;
      // 呼叫 Cloudflare Function 模式 A: Search
      const res = await fetch(`/api/advisor?mode=search&lat=${latitude}&lon=${longitude}&q=${searchQuery || 'minimalist'}`);
      const data = await res.json();
      setWeather(data.weather);
      setProducts(data.products);
      setStage('selection');
      setLoading(false);
    });
  };

  // 2. 選擇單品後進行 AI 配對
  const handleSelectItem = async (item: any) => {
    setLoading(true);
    const res = await fetch(`/api/advisor?mode=recommend&item=${encodeURIComponent(JSON.stringify(item))}`);
    const data = await res.json();
    setOutlook(data.outlook);
    setStage('outlook');
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden transition-all duration-1000" style={{ background: GRADIENTS.day }}>
      <AnimatePresence mode="wait">
        
        {/* Stage: Language & Search */}
        {stage === 'language' && (
          <motion.div key="lang" className="h-full flex flex-col items-center justify-center p-8 space-y-8">
            <h1 className="din-text text-3xl opacity-80">KAIT</h1>
            <input 
              className="bg-transparent border-b border-black/20 p-2 text-center din-text w-64 focus:outline-none"
              placeholder={TRANSLATIONS.english.searchPlaceholder}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <button className="ghost-button" onClick={handleStart}>
              {loading ? "SYNCING..." : "START CALIBRATION"}
            </button>
          </motion.div>
        )}

        {/* Stage: User Selection (Amazon / Zalando Mix) */}
        {stage === 'selection' && (
          <motion.div key="select" className="h-full p-8 flex flex-col">
            <p className="din-text text-sm opacity-50 mb-8 uppercase tracking-widest">Step 01: Pick your core piece</p>
            <div className="flex-1 overflow-y-auto space-y-8">
              {products.map((item: any, i) => (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
                  key={i} className="flex items-center space-x-6 group cursor-pointer"
                  onClick={() => handleSelectItem(item)}
                >
                  <img src={item.image} className="w-24 h-32 object-cover grayscale group-hover:grayscale-0 transition-all" />
                  <div>
                    <p className="din-text text-[10px] opacity-40">{item.source}</p>
                    <p className="din-text text-lg">{item.name}</p>
                    <p className="din-text text-sm opacity-60">{item.price}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Stage: Final Outlook (AI Driven) */}
        {stage === 'outlook' && outlook && (
          <motion.div key="outlook" className="h-full p-8 flex flex-col justify-center items-center text-center">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="space-y-6 max-w-md">
              <p className="din-caps text-[12px] tracking-[0.3em] opacity-40">The Final Outlook</p>
              <h2 className="din-text text-4xl font-light italic">{outlook.title}</h2>
              <div className="line-1px w-12 mx-auto" />
              <p className="din-text text-sm leading-relaxed opacity-70">{outlook.description}</p>
              
              <div className="pt-8 space-y-2">
                {outlook.style_tips.map((tip: string, i: number) => (
                  <p key={i} className="din-text text-xs opacity-50">• {tip}</p>
                ))}
              </div>

              <button 
                className="ghost-button mt-12"
                onClick={() => window.open(outlook.selectedLink, '_blank')}
              >
                PROCEED TO CHECKOUT
              </button>
            </motion.div>
          </motion.div>
        )}

      </AnimatePresence>

      {/* Persistent Weather HUD */}
      {stage !== 'language' && (
        <div className="absolute bottom-8 left-8 right-8 flex justify-between items-end pointer-events-none">
          <div className="opacity-40 din-text text-xs">
            {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
          <div className="text-right">
            <p className="din-text text-4xl font-light">{(weather as any).temp}°C</p>
            <p className="din-text text-[10px] opacity-50 uppercase tracking-tighter">{(weather as any).condition}</p>
          </div>
        </div>
      )}
    </div>
  );
}
