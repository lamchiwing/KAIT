import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Wind, ArrowRight } from 'lucide-react';

const TRANSLATIONS: any = {
  english: {
    intro: "i am kait.",
    searchPlaceholder: "What are you looking for?",
    steps: ["Step 01: Pick a piece", "Step 02: AI Curation"],
    loading: "Syncing with horizons..."
  },
  svenska: {
    intro: "jag är kait.",
    searchPlaceholder: "Vad letar du efter?",
    steps: ["Steg 01: Välj ett plagg", "Steg 02: AI-kuratering"],
    loading: "Synkroniserar..."
  }
};

export default function App() {
  const [lang, setLang] = useState('english');
  const [stage, setStage] = useState('language');
  const [query, setQuery] = useState('');
  const [products, setProducts] = useState([]);
  const [weather, setWeather] = useState<any>(null);
  const [outlook, setOutlook] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const t = TRANSLATIONS[lang];

  // 搜尋商品
  const handleSearch = () => {
    setLoading(true);
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const res = await fetch(`/api/advisor?mode=search&q=${query}&lang=${lang}&lat=${pos.coords.latitude}&lon=${pos.coords.longitude}`);
      const data = await res.json();
      setProducts(data.products);
      setWeather(data.weather);
      setStage('selection');
      setLoading(false);
    });
  };

  // AI 推薦
  const handleSelect = async (item: any) => {
    setLoading(true);
    const res = await fetch(`/api/advisor?mode=recommend&item=${encodeURIComponent(JSON.stringify(item))}&lang=${lang}`);
    const data = await res.json();
    setOutlook(data.outlook);
    setStage('outlook');
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-[#F5F5F5] flex flex-col font-light">
      <AnimatePresence mode="wait">
        
        {/* 語言與搜尋 */}
        {stage === 'language' && (
          <motion.div key="l" className="h-full flex flex-col items-center justify-center p-8 space-y-12">
            <div className="flex space-x-4">
              {['english', 'svenska'].map(l => (
                <button key={l} onClick={() => setLang(l)} className={`din-text ${lang === l ? 'opacity-100' : 'opacity-30'}`}>{l}</button>
              ))}
            </div>
            <h1 className="text-4xl tracking-[0.2em]">{t.intro}</h1>
            <div className="relative w-64">
              <input 
                className="w-full bg-transparent border-b border-black/20 pb-2 focus:outline-none text-center"
                placeholder={t.searchPlaceholder}
                onChange={(e) => setQuery(e.target.value)}
              />
              <button onClick={handleSearch} className="absolute right-0 bottom-2"><Search size={18}/></button>
            </div>
          </motion.div>
        )}

        {/* 挑選商品 */}
        {stage === 'selection' && (
          <motion.div key="s" className="h-full p-8 overflow-y-auto">
            <p className="text-[10px] opacity-40 uppercase tracking-widest mb-12">{t.steps[0]}</p>
            <div className="grid grid-cols-1 gap-12">
              {products.map((p: any, i) => (
                <div key={i} onClick={() => handleSelect(p)} className="flex space-x-6 cursor-pointer group">
                  <img src={p.image} className="w-24 h-32 object-cover grayscale group-hover:grayscale-0 transition-all" />
                  <div className="flex flex-col justify-center">
                    <p className="text-[10px] opacity-40">{p.source}</p>
                    <p className="text-lg">{p.name}</p>
                    <p className="text-sm opacity-60">{p.price}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* AI Outlook */}
        {stage === 'outlook' && outlook && (
          <motion.div key="o" className="h-full p-8 flex flex-col items-center justify-center text-center space-y-8">
            <p className="text-[10px] opacity-40 uppercase tracking-widest">{t.steps[1]}</p>
            <h2 className="text-4xl italic font-serif">{outlook.title}</h2>
            <p className="max-w-xs text-sm leading-relaxed opacity-70">{outlook.description}</p>
            <button 
              onClick={() => window.open(outlook.selectedLink, '_blank')}
              className="px-8 py-3 border border-black/20 hover:bg-black hover:text-white transition-all text-sm"
            >
              PURCHASE CORE PIECE
            </button>
            <button onClick={() => setStage('language')} className="text-xs opacity-30 underline">Start Over</button>
          </motion.div>
        )}

      </AnimatePresence>

      {/* Loading Overlay */}
      {loading && (
        <div className="fixed inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-50">
          <p className="din-text animate-pulse">{t.loading}</p>
        </div>
      )}
    </div>
  );
}
