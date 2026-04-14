import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Language, 
  Stage, 
  UserPreferences, 
  WeatherData, 
  Sensitivity, 
  Archetype, 
  Silhouette 
} from './types';
import { getDressingSuggestions } from './geminiService';
import { 
  Cloud, 
  Sun, 
  CloudRain, 
  Wind, 
  MapPin, 
  ArrowRight, 
  ArrowLeft, 
  Share2, 
  Settings,
  ChevronRight,
  ChevronLeft
} from 'lucide-react';

// --- Constants & Helpers ---

const GRADIENTS = {
  dawn: 'linear-gradient(135deg, #E6E6FA 0%, #FFFFFF 100%)',
  day: 'linear-gradient(135deg, #FDFDFD 0%, #F5F5F5 100%)',
  dusk: 'linear-gradient(135deg, #FFF5E6 0%, #FAD0C4 100%)',
  evening: 'linear-gradient(135deg, #E0E5EC 0%, #C9D6FF 100%)',
  midnight: 'linear-gradient(135deg, #121214 0%, #1A1A1D 100%)',
  shadow: 'linear-gradient(135deg, #D1D1D1 0%, #D1D1D1 100%)',
};

const getBackgroundByTime = () => {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 8) return GRADIENTS.dawn;
  if (hour >= 8 && hour < 17) return GRADIENTS.day;
  if (hour >= 17 && hour < 19) return GRADIENTS.dusk;
  if (hour >= 19 && hour < 23) return GRADIENTS.evening;
  return GRADIENTS.midnight;
};

const TRANSLATIONS = {
  english: {
    intro: ["i am kait.", "before i curate your day,", "let’s sync with your senses."],
    begin: "BEGIN CALIBRATION",
    calibrationTitle: "calibration 01: archetype",
    calibrationQuestion: "in a 15°C breeze, what defines your comfort?",
    archetypes: {
      hoodie: "the lightness of a single layer",
      trench: "the structure of a classic coat",
      puffer: "the soft embrace of wool"
    },
    locationTitle: "to feel the wind and shadows around you,",
    locationSubtitle: "let me witness your horizon.",
    shareLocation: "SHARE YOUR COORDINATES",
    maybeLater: "maybe later",
    locationWarning: "are you sure? without your location, i cannot feel the real-time chill or the heat. our precision will fade into estimates.",
    syncNow: "SYNC NOW",
    proceedShadows: "proceed in the shadows",
    silhouetteTitle: "define your silhouette.",
    silhouettes: {
      masculine: "masculine",
      feminine: "feminine",
      neutral: "neutral"
    },
    dashboard: {
      recommended: "recommended attire",
      share: "SHARE OOTD",
      rainWarning: "rain expected in 2 hours.",
      uvWarning: "uv index high. recommendation adjusted."
    }
  },
  português: {
    intro: ["sou a kait.", "antes de desenhar o teu dia,", "vamos sentir o teu ritmo."],
    begin: "INICIAR",
    calibrationTitle: "calibração 01: arquétipo",
    calibrationQuestion: "numa brisa de 15°C, o que define o teu conforto?",
    archetypes: {
      hoodie: "a leveza de uma única camada",
      trench: "a estrutura de um casaco clássico",
      puffer: "o abraço suave da lã"
    },
    locationTitle: "para sentir o vento e as sombras ao teu redor,",
    locationSubtitle: "deixa-me testemunhar o teu horizonte.",
    shareLocation: "PARTILHAR COORDENADAS",
    maybeLater: "talvez mais tarde",
    locationWarning: "tens a certeza? sem a tua localização, não consigo sentir o frio ou o calor em tempo real. a nossa precisão tornar-se-á estimativa.",
    syncNow: "SINCRONIZAR AGORA",
    proceedShadows: "prosseguir nas sombras",
    silhouetteTitle: "define a tua silhueta.",
    silhouettes: {
      masculine: "masculino",
      feminine: "feminino",
      neutral: "neutro"
    },
    dashboard: {
      recommended: "traje recomendado",
      share: "PARTILHAR OOTD",
      rainWarning: "chuva esperada em 2 horas.",
      uvWarning: "índice uv alto. recomendação ajustada."
    }
  },
  svenska: {
    intro: ["jag är kait.", "innan jag formar din morgon,", "låt oss finna din inre temperatur."],
    begin: "BÖRJA",
    calibrationTitle: "kalibrering 01: arketyp",
    calibrationQuestion: "i en bris på 15°C, vad definierar din komfort?",
    archetypes: {
      hoodie: "lättheten i ett enda lager",
      trench: "strukturen i en klassisk kappa",
      puffer: "ullens mjuka famn"
    },
    locationTitle: "för att känna vinden och skuggorna omkring dig,",
    locationSubtitle: "låt mig bevittna din horisont.",
    shareLocation: "DELA DINA KOORDINATER",
    maybeLater: "kanske senare",
    locationWarning: "är du säker? utan din plats kan jag inte känna kylan eller värmen i realtid. vår precision kommer att blekna till uppskattningar.",
    syncNow: "SYNKRONISERA NU",
    proceedShadows: "fortsätt i skuggorna",
    silhouetteTitle: "definiera din siluett.",
    silhouettes: {
      masculine: "maskulin",
      feminine: "feminin",
      neutral: "neutral"
    },
    dashboard: {
      recommended: "rekommenderad klädsel",
      share: "DELA OOTD",
      rainWarning: "regn väntas om 2 timmar.",
      uvWarning: "högt uv-index. rekommendation justerad."
    }
  }
};

// --- Main Component ---

export default function App() {
  const [stage, setStage] = useState<Stage>('language');
  const [prefs, setPrefs] = useState<UserPreferences>({
    language: 'english',
    locationEnabled: false,
  });
  const [weather, setWeather] = useState<WeatherData>({
    temp: 15,
    condition: 'partly cloudy',
    uvIndex: 3,
    rainExpected: false,
  });
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showLocationWarning, setShowLocationWarning] = useState(false);

  const t = TRANSLATIONS[prefs.language];

  // Adaptive background
  const [bg, setBg] = useState(getBackgroundByTime());

  useEffect(() => {
    const interval = setInterval(() => {
      if (!prefs.locationEnabled && stage === 'dashboard') {
        setBg(GRADIENTS.shadow);
      } else {
        setBg(getBackgroundByTime());
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [prefs.locationEnabled, stage]);

  // Fetch suggestions when reaching dashboard
  useEffect(() => {
    if (stage === 'dashboard') {
      setLoading(true);
      getDressingSuggestions(prefs, weather).then(data => {
        setSuggestions(data);
        setLoading(false);
      });
    }
  }, [stage, prefs, weather]);

  const handleLocationRequest = () => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setPrefs(prev => ({
            ...prev,
            locationEnabled: true,
            location: {
              lat: position.coords.latitude,
              lon: position.coords.longitude,
              city: "London" // Mock city
            }
          }));
          setStage('silhouette');
        },
        () => {
          setShowLocationWarning(true);
        }
      );
    } else {
      setShowLocationWarning(true);
    }
  };

  // --- Sub-components (Stages) ---

  const LanguageStage = () => (
    <div className="flex flex-col items-center justify-center h-full space-y-8">
      {(['english', 'português', 'svenska'] as Language[]).map((lang) => (
        <motion.button
          key={lang}
          whileHover={{ scale: 1.05, opacity: 1 }}
          whileTap={{ scale: 0.95 }}
          className={`din-text text-2xl transition-opacity duration-500 ${prefs.language === lang ? 'opacity-100 font-medium' : 'opacity-40'}`}
          onClick={() => {
            setPrefs({ ...prefs, language: lang });
            setStage('intro');
          }}
        >
          {lang}
        </motion.button>
      ))}
    </div>
  );

  const IntroStage = () => (
    <div className="flex flex-col items-center justify-center h-full text-center px-8">
      <div className="space-y-4 mb-16">
        {t.intro.map((line, i) => (
          <motion.p
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.6, duration: 1 }}
            className="din-text text-xl"
          >
            {line}
          </motion.p>
        ))}
      </div>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2, duration: 1 }}
        className="line-1px mb-12"
      />
      <motion.button
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 2.8, duration: 0.8 }}
        className="ghost-button"
        onClick={() => setStage('calibration')}
      >
        {t.begin}
      </motion.button>
    </div>
  );

  const CalibrationStage = () => (
    <div className="flex flex-col items-center justify-center h-full text-center px-8">
      <motion.p className="din-text opacity-60 mb-2">{t.calibrationTitle}</motion.p>
      <motion.h2 className="din-text text-2xl mb-16">{t.calibrationQuestion}</motion.h2>
      
      <div className="flex flex-col space-y-6 w-full max-w-xs">
        {(['hoodie', 'trench', 'puffer'] as Archetype[]).map((arch) => (
          <motion.button
            key={arch}
            whileHover={{ scale: 1.02, backgroundColor: 'rgba(0,0,0,0.05)' }}
            className="border border-black/10 p-6 text-left transition-colors group"
            onClick={() => {
              setPrefs({ ...prefs, archetype: arch });
              setStage('location');
            }}
          >
            <p className="din-text text-sm opacity-60 mb-1">{arch}</p>
            <p className="din-text text-lg group-hover:font-medium transition-all">{t.archetypes[arch]}</p>
          </motion.button>
        ))}
      </div>
    </div>
  );

  const LocationStage = () => (
    <div className="flex flex-col items-center justify-center h-full text-center px-8">
      {!showLocationWarning ? (
        <>
          <motion.p className="din-text text-xl mb-2">{t.locationTitle}</motion.p>
          <motion.p className="din-text text-xl mb-16">{t.locationSubtitle}</motion.p>
          <button className="ghost-button mb-8" onClick={handleLocationRequest}>
            {t.shareLocation}
          </button>
          <button 
            className="din-text text-sm opacity-60 border-b border-black/20"
            onClick={() => setShowLocationWarning(true)}
          >
            {t.maybeLater}
          </button>
        </>
      ) : (
        <>
          <motion.p className="din-text text-lg mb-16 max-w-sm">
            {t.locationWarning}
          </motion.p>
          <button className="ghost-button mb-8" onClick={handleLocationRequest}>
            {t.syncNow}
          </button>
          <button 
            className="din-text text-sm opacity-60 border-b border-black/20"
            onClick={() => {
              setPrefs({ ...prefs, locationEnabled: false });
              setStage('silhouette');
            }}
          >
            {t.proceedShadows}
          </button>
        </>
      )}
    </div>
  );

  const SilhouetteStage = () => (
    <div className="flex flex-col items-center justify-center h-full text-center px-8">
      <motion.h2 className="din-text text-2xl mb-16">{t.silhouetteTitle}</motion.h2>
      
      <div className="flex flex-col space-y-8 w-full max-w-xs">
        {(['masculine', 'feminine', 'neutral'] as Silhouette[]).map((sil) => (
          <motion.button
            key={sil}
            className={`din-text text-xl transition-all duration-500 relative ${prefs.silhouette === sil ? 'font-bold opacity-100' : 'opacity-40'}`}
            onClick={() => {
              setPrefs({ ...prefs, silhouette: sil });
              setTimeout(() => setStage('dashboard'), 800);
            }}
          >
            {t.silhouettes[sil]}
            {prefs.silhouette === sil && (
              <motion.div 
                layoutId="underline"
                className="absolute -bottom-2 left-[-20%] right-[-20%] h-[1px] bg-black/40"
              />
            )}
          </motion.button>
        ))}
      </div>
      
      {!prefs.locationEnabled && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute bottom-12 left-0 right-0 text-center"
        >
          <button 
            className="din-text text-xs opacity-40 border-b border-black/20"
            onClick={() => setStage('location')}
          >
            silhouette defined. but your environment is still a mystery. [ sync now ]
          </button>
        </motion.div>
      )}
    </div>
  );

  const [shareFeedback, setShareFeedback] = useState(false);

  const handleShare = () => {
    setShareFeedback(true);
    setTimeout(() => setShareFeedback(false), 2000);
  };

  const [viewMode, setViewMode] = useState<'list' | 'visual'>('list');

  const DashboardStage = () => (
    <div className="flex flex-col h-full px-8 pt-16 pb-12 relative overflow-hidden">
      {/* Header */}
      <div className="flex justify-between items-start mb-12">
        <div className="space-y-1">
          <p className="din-text text-sm opacity-60">{new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric' }).toUpperCase()}</p>
          <p className="din-text text-sm opacity-60">{new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false })}</p>
          <p className="din-text text-sm opacity-60">{prefs.location?.city || 'UNKNOWN'}</p>
        </div>
        <div className="flex items-center space-x-4">
          <button 
            className={`din-caps text-[10px] transition-opacity ${viewMode === 'visual' ? 'opacity-100' : 'opacity-30'}`}
            onClick={() => setViewMode(viewMode === 'list' ? 'visual' : 'list')}
          >
            {viewMode === 'list' ? 'visual mode' : 'list mode'}
          </button>
          <button className="p-2 opacity-40 hover:opacity-100 transition-opacity">
            <Settings size={20} strokeWidth={1.5} />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col justify-center">
        <p className="din-text text-sm opacity-60 mb-6">{t.dashboard.recommended}</p>
        
        <AnimatePresence mode="wait">
          {viewMode === 'list' ? (
            <motion.div 
              key="list"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-12 mb-12 overflow-y-auto pr-2 max-h-[60vh]"
            >
              {loading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-24 bg-black/5 animate-pulse w-full" />
                  ))}
                </div>
              ) : (
                suggestions.map((item, i) => (
                  <motion.div 
                    key={i}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="group cursor-pointer flex items-center space-x-6"
                    onClick={() => window.open(item.affiliateLink, '_blank')}
                  >
                    <div className="relative w-24 h-32 flex-shrink-0 overflow-hidden bg-black/5">
                      <img 
                        src={`https://picsum.photos/seed/${item.imageKeywords.replace(/\s/g, '')}/200/300`} 
                        alt={item.name}
                        className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity duration-500"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-0 border border-black/5" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center mb-1">
                        <span className="din-text text-[10px] opacity-40 mr-3">0{i + 1}.</span>
                        <p className="din-text text-base group-hover:font-medium transition-all">
                          {item.name}
                        </p>
                      </div>
                      <p className="din-text text-xs opacity-40 leading-relaxed">{item.description}</p>
                      <div className="mt-2 flex items-center space-x-2 text-[10px] din-caps opacity-30 group-hover:opacity-60 transition-opacity">
                        <span className="border-b border-black/20">view on {item.affiliateLink.includes('amazon') ? 'amazon' : 'zalando'}</span>
                        <ArrowRight size={10} />
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
            </motion.div>
          ) : (
            <motion.div 
              key="visual"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex space-x-4 mb-12 overflow-x-auto pb-4 snap-x"
            >
              {suggestions.map((item, i) => (
                <motion.div 
                  key={i}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.1 }}
                  className="relative flex-shrink-0 w-64 h-96 group cursor-pointer snap-center"
                  onClick={() => window.open(item.affiliateLink, '_blank')}
                >
                  <img 
                    src={`https://picsum.photos/seed/${item.imageKeywords.replace(/\s/g, '')}/400/600`} 
                    alt={item.name}
                    className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity duration-700"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <div className="absolute bottom-6 left-6 right-6 text-white opacity-0 group-hover:opacity-100 transition-all duration-500 transform translate-y-2 group-hover:translate-y-0">
                    <p className="din-text text-sm font-medium mb-1">{item.name}</p>
                    <p className="din-text text-[10px] opacity-80">{item.description}</p>
                  </div>
                  <div className="absolute top-4 right-4 bg-white/10 backdrop-blur-md px-2 py-1 rounded-sm">
                    <p className="din-caps text-[8px] text-white">0{i + 1}</p>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex flex-col space-y-4">
          <button className="ghost-button w-fit" onClick={handleShare}>
            {t.dashboard.share}
          </button>
          <AnimatePresence>
            {shareFeedback && (
              <motion.p 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="din-text text-[10px] opacity-40"
              >
                selection saved. your algorithm is evolving.
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Footer HUD */}
      <div className="mt-auto pt-12">
        <div className="flex items-end justify-between mb-8">
          <div className="flex items-center space-x-4 opacity-60">
            <ChevronLeft size={20} strokeWidth={1} />
            <span className="din-text text-sm">CASUAL</span>
            <ChevronRight size={20} strokeWidth={1} />
          </div>
          <div className="text-right">
            <p className="din-text text-5xl font-light mb-1">{weather.temp}°c</p>
            <p className="din-text text-xs opacity-60 uppercase">{weather.condition}</p>
          </div>
        </div>
        
        <div className="line-1px w-full mb-6 opacity-10" />
        
        <div className="flex items-center space-x-2 text-xs opacity-40 din-text">
          <Wind size={14} strokeWidth={1.5} />
          <span>{t.dashboard.uvWarning}</span>
        </div>
      </div>
    </div>
  );

  return (
    <div 
      className="fixed inset-0 flex flex-col overflow-hidden animate-pulse-slow"
      style={{ background: bg }}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={stage}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="h-full w-full"
        >
          {stage === 'language' && <LanguageStage />}
          {stage === 'intro' && <IntroStage />}
          {stage === 'calibration' && <CalibrationStage />}
          {stage === 'location' && <LocationStage />}
          {stage === 'silhouette' && <SilhouetteStage />}
          {stage === 'dashboard' && <DashboardStage />}
        </motion.div>
      </AnimatePresence>

      {/* 1px String (Global) */}
      {stage !== 'dashboard' && (
        <motion.div 
          className="absolute bottom-[15%] left-0 right-0 pointer-events-none"
          animate={{ y: [0, 2, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        >
          <div className="line-1px" />
        </motion.div>
      )}
    </div>
  );
}
