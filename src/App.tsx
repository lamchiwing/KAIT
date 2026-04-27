import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Wind, ShoppingBag, ArrowLeft } from 'lucide-react';

const TRANSLATIONS: any = {
  english: { intro: "i am kait.", search: "Search style...", loading: "Syncing..." },
  svenska: { intro: "jag är kait.", search: "Sök stil...", loading: "Synkroniserar..." },
  português: { intro: "sou a kait.", search: "Buscar estilo...", loading: "Sincronizando..." }
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

  const startJourney = () => {
    setLoading(true);
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const { latitude, longitude } = pos.coords;
      const res = await fetch(`/api/advisor?mode=search&q=${query || 'minimalist'}&lang=${lang}&lat=${latitude}&lon=${longitude}`);
      const data = await res.json();
      setProducts(data.products);
      setWeather(data.weather);
      setStage('selection');
      setLoading(false);
    });
  };

  const getAIRecommendation = async (item: any) => {
    setLoading(true);
    const res = await fetch(`/api/advisor?mode=recommend&item=${encodeURIComponent(JSON.stringify(item))}&lang=${lang}`);
    const data = await res.json();
    setOutlook(data.outlook);
    setStage('outlook');
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-[#121212] text-white/90 font-light overflow-hidden">
      <AnimatePresence mode="wait">
        
        {/* Stage 1: Language & Search */}
        {stage === 'language' && (
          <motion.div key="lang" className="h-full flex flex-col items-center justify-center p-8 space-y-12">
            <div className="flex space-x-6 opacity-50 text-sm">
              {['english', 'português', 'svenska'].map(l => (
                <button key={l} onClick={() => setLang(l)} className={lang === l ? 'text-white font-medium' : ''}>{l}</button>
              ))}
            </div>
            <h1 className="text-5xl tracking-[0.3em] font-extralight uppercase">{t.intro}</h1>
            <div className="relative border-b border-white/20 pb-2 w-64">
              <input 
                className="bg-transparent w-full focus:outline-none text-center placeholder:text-white/20"
                placeholder={t.search}
                onChange={(e) => setQuery(e.target.value)}
              />
              <button onClick={startJourney} className="absolute right-0 top-0"><Search size={18} /></button>
            </div>
          </motion.div>
        )}

        {/* Stage 2: Product Selection */}
        {stage === 'selection' && (
          <motion.div key="select" className="h-full p-8 flex flex-col">
            <div className="flex justify-between items-center mb-12 opacity-40 text-[10px] tracking-widest">
              <button onClick={() => setStage('language')}><ArrowLeft size={16}/></button>
              <span>01 / SELECTION</span>
            </div>
            <div className="flex-1 space-y-10 overflow-y-auto pr-4">
              {products.map((p: any, i) => (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
                  key={i} onClick={() => getAIRecommendation(p)}
                  className="flex items-center space-x-6 group cursor-pointer"
                >
                  <img src={p.image} className="w-20 h-28 object-cover opacity-60 group-hover:opacity-100 transition-all" />
                  <div>
                    <p className="text-[9px] opacity-30 mb-1 uppercase tracking-tighter">{p.source}</p>
                    <p className="text-lg group-hover:italic transition-all">{p.name}</p>
                    <p className="text-xs opacity-50">{p.price}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Stage 3: AI Outlook */}
        {stage === 'outlook' && outlook && (
          <motion.div key="out" className="h-full p-8 flex flex-col items-center justify-center text-center">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="space-y-8">
              <p className="text-[10px] opacity-30 tracking-[0.5em] uppercase">The Vision</p>
              <h2 className="text-4xl italic font-serif leading-tight text-white">{outlook.title}</h2>
              <div className="w-12 h-[1px] bg-white/20 mx-auto" />
              <div className="space-y-4">
                {outlook.tips.map((tip: string, i: number) => (
                  <p key={i} className="text-sm opacity-60 font-light">{tip}</p>
                ))}
              </div>
              <button 
                onClick={() => window.open(outlook.url, '_blank')}
                className="mt-8 px-10 py-3 border border-white/20 hover:bg-white hover:text-black transition-all text-xs tracking-widest uppercase"
              >
                Acquire Piece
              </button>
            </motion.div>
          </motion.div>
        )}

      </AnimatePresence>

      {/* Weather HUD */}
      {stage !== 'language' && weather && (
        <div className="absolute bottom-8 right-8 text-right">
          <p className="text-5xl font-extralight tracking-tighter">{Math.round(weather.main.temp)}°</p>
          <p className="text-[10px] opacity-40 uppercase tracking-widest">{weather.weather[0].description}</p>
        </div>
      )}

      {/* Loading Overlay */}
      {loading && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center">
          <p className="text-[10px] tracking-[0.5em] animate-pulse uppercase">{t.loading}</p>
        </div>
      )}
    </div>
  );
}
