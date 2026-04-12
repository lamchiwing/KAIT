import React, { useEffect, useState } from 'react';
import { auth, db } from './lib/firebase';
import { signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User } from 'firebase/auth';
import { addDoc, collection, doc, getDoc, setDoc } from 'firebase/firestore';
import { getKAITRecommendation, type EnvironmentalContext, type KAITRecommendation } from './services/api';
import { AlertTriangle, LogOut, MapPin, Thermometer, Wind, Droplets, Sun, Shield, Zap } from 'lucide-react';

interface UserProfileDoc {
  gender?: string;
  thermalBenchmark?: string;
}

const thermalOptions = [
  { label: 'T-shirt & Shorts', value: 'T-shirt & Shorts', desc: 'I usually feel warm.' },
  { label: 'Long Sleeve Tee', value: 'Long Sleeve Tee', desc: 'I need only a light layer.' },
  { label: 'Light Jacket / Hoodie', value: 'Light Jacket / Hoodie', desc: 'This is my normal baseline.' },
  { label: 'Sweater / Coat', value: 'Sweater / Coat', desc: 'I usually feel cold easily.' },
];

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [userLoading, setUserLoading] = useState(false);
  const [gender, setGender] = useState<string | null>(null);
  const [thermalBenchmark, setThermalBenchmark] = useState<string | null>(null);
  const [envContext, setEnvContext] = useState<EnvironmentalContext | null>(null);
  const [recommendation, setRecommendation] = useState<KAITRecommendation | null>(null);
  const [cacheInfo, setCacheInfo] = useState<{ weather: string; air: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [feedbackSaved, setFeedbackSaved] = useState<string | null>(null);
  const physiology = {
    lifeStage: 'adult',
    sleepQuality: 80,
    menstrualCycle: false,
    cycleDay: 1,
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      setFeedbackSaved(null);
      if (!u) {
        setGender(null);
        setThermalBenchmark(null);
        setLoading(false);
        return;
      }

      try {
        const snapshot = await getDoc(doc(db, 'users', u.uid));
        if (snapshot.exists()) {
          const data = snapshot.data() as UserProfileDoc;
          setGender(data.gender ?? null);
          setThermalBenchmark(data.thermalBenchmark ?? null);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (user && gender && thermalBenchmark) {
      void runAnalysis();
    }
  }, [user, gender, thermalBenchmark]);

  async function runAnalysis() {
    if (!gender || !thermalBenchmark) return;
    setUserLoading(true);
    setError(null);
    try {
      const position = await getCurrentPosition();
      const result = await getKAITRecommendation(
        { lat: position.coords.latitude, lng: position.coords.longitude },
        { gender, thermalBenchmark },
        physiology,
      );

      setEnvContext(result.context);
      setRecommendation(result.recommendation);
      setCacheInfo(result.cache);

      if (auth.currentUser) {
        const uid = auth.currentUser.uid;
        await setDoc(
          doc(db, 'users', uid),
          {
            uid,
            email: auth.currentUser.email || '',
            gender,
            thermalBenchmark,
            updatedAt: new Date().toISOString(),
          },
          { merge: true },
        );

        await addDoc(collection(db, `users/${uid}/logs`), {
          uid,
          timestamp: new Date().toISOString(),
          ...result.context,
        });
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unable to analyze environment.';
      setError(message);
    } finally {
      setUserLoading(false);
    }
  }

  async function saveGender(value: string) {
    if (!user) return;
    setGender(value);
    await setDoc(
      doc(db, 'users', user.uid),
      {
        uid: user.uid,
        email: user.email || '',
        gender: value,
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    );
  }

  async function saveThermalBenchmark(value: string) {
    if (!user) return;
    setThermalBenchmark(value);
    await setDoc(
      doc(db, 'users', user.uid),
      {
        thermalBenchmark: value,
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    );
  }

  async function handleFeedback(feedback: 'Too Cold' | 'Comfortable' | 'Too Hot') {
    if (!user || !recommendation || !envContext) return;
    await addDoc(collection(db, `users/${user.uid}/feedback`), {
      timestamp: new Date().toISOString(),
      recommendation: recommendation.look_summary,
      feedback,
      env: envContext,
    });
    setFeedbackSaved(feedback);
  }

  async function login() {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  }

  async function logout() {
    await auth.signOut();
  }

  if (loading) {
    return <Centered message="KAIT initializing..." />;
  }

  if (!user) {
    return (
      <Shell>
        <Centered message="KAIT Decision Engine">
          <p className="mt-4 max-w-xl text-center text-white/60">
            Environment-aware clothing and comfort decisions powered by Cloudflare, live weather, AQI, and Gemini.
          </p>
          <button onClick={login} className="mt-8 rounded-full bg-white px-6 py-3 font-semibold text-black">
            Sign in with Google
          </button>
        </Centered>
      </Shell>
    );
  }

  if (!gender) {
    return (
      <Shell onLogout={logout} userName={user.displayName || user.email || 'User'}>
        <Centered message="Select identity">
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            {['Male', 'Female', 'Non-binary'].map((option) => (
              <button
                key={option}
                onClick={() => void saveGender(option)}
                className="rounded-2xl border border-white/10 bg-white/5 px-6 py-4 hover:bg-white/10"
              >
                {option}
              </button>
            ))}
          </div>
        </Centered>
      </Shell>
    );
  }

  if (!thermalBenchmark) {
    return (
      <Shell onLogout={logout} userName={user.displayName || user.email || 'User'}>
        <Centered message="Calibrate your thermal baseline">
          <p className="mt-4 max-w-xl text-center text-white/60">
            What would you normally wear at 15°C? This helps KAIT personalize recommendations.
          </p>
          <div className="mt-8 grid max-w-3xl gap-4 md:grid-cols-2">
            {thermalOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => void saveThermalBenchmark(option.value)}
                className="rounded-3xl border border-white/10 bg-white/5 p-5 text-left hover:bg-white/10"
              >
                <div className="font-semibold">{option.label}</div>
                <div className="mt-1 text-sm text-white/50">{option.desc}</div>
              </button>
            ))}
          </div>
        </Centered>
      </Shell>
    );
  }

  return (
    <Shell onLogout={logout} userName={user.displayName || user.email || 'User'}>
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 pb-10 pt-24">
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-white/10 bg-white/5 p-6">
          <div>
            <div className="text-3xl font-bold tracking-tight">Live contextual recommendation</div>
            <div className="mt-2 text-white/60">Weather + AQI are fetched server-side on Cloudflare and cached.</div>
          </div>
          <button
            onClick={() => void runAnalysis()}
            disabled={userLoading}
            className="rounded-full bg-white px-5 py-3 font-semibold text-black disabled:opacity-60"
          >
            {userLoading ? 'Analyzing...' : 'Refresh now'}
          </button>
        </div>

        {error ? (
          <div className="rounded-3xl border border-red-500/30 bg-red-500/10 p-5 text-red-200">
            <div className="flex items-center gap-2 font-semibold"><AlertTriangle className="h-5 w-5" /> Error</div>
            <div className="mt-2 text-sm">{error}</div>
          </div>
        ) : null}

        {envContext ? (
          <div className="grid gap-4 md:grid-cols-4">
            <MetricCard icon={<MapPin className="h-5 w-5" />} label="Location" value={envContext.location.city || 'Current location'} sub={`${envContext.location.lat.toFixed(2)}, ${envContext.location.lng.toFixed(2)}`} />
            <MetricCard icon={<Thermometer className="h-5 w-5" />} label="Temperature" value={`${envContext.atmospheric.temp}°C`} sub={`Pressure ${envContext.atmospheric.pressure} hPa`} />
            <MetricCard icon={<Wind className="h-5 w-5" />} label="Wind" value={`${envContext.atmospheric.windSpeed || 0} km/h`} sub={`Humidity ${envContext.atmospheric.humidity}%`} />
            <MetricCard icon={<Sun className="h-5 w-5" />} label="UV / AQI" value={`UV ${envContext.optical.uvIndex}`} sub={`AQI ${envContext.biochemical.aqi}`} />
          </div>
        ) : null}

        {cacheInfo ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/60">
            Cache status — weather: <span className="text-white">{cacheInfo.weather}</span>, air: <span className="text-white">{cacheInfo.air}</span>
          </div>
        ) : null}

        {recommendation ? (
          <div className="grid gap-6 md:grid-cols-[1.3fr_0.7fr]">
            <section className="rounded-[28px] border border-white/10 bg-white/5 p-6">
              <div className="flex items-center gap-2 text-sm uppercase tracking-[0.2em] text-white/40">
                <Zap className="h-4 w-4" /> KAIT output
              </div>
              <h1 className="mt-4 text-3xl font-bold tracking-tight">{recommendation.look_summary}</h1>
              <p className="mt-3 text-white/70">{recommendation.advice}</p>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="flex items-center gap-2 font-semibold"><Shield className="h-4 w-4" /> Outfit</div>
                  <ul className="mt-3 space-y-2 text-white/75">
                    {recommendation.outfit.map((item) => (
                      <li key={item}>• {item}</li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="flex items-center gap-2 font-semibold"><Droplets className="h-4 w-4" /> Feel</div>
                  <div className="mt-3 text-lg capitalize text-white">{recommendation.feels_like}</div>
                  <div className="mt-4 text-sm text-white/50">Thermal baseline: {thermalBenchmark}</div>
                  <div className="text-sm text-white/50">Gender profile: {gender}</div>
                </div>
              </div>

              <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="font-semibold">Lookbook prompt</div>
                <p className="mt-2 text-sm text-white/60">{recommendation.lookbook_prompt}</p>
              </div>
            </section>

            <aside className="space-y-6">
              <div className="rounded-[28px] border border-white/10 bg-white/5 p-6">
                <div className="font-semibold">Suggested products</div>
                <div className="mt-4 space-y-3">
                  {recommendation.products.map((product) => (
                    <a
                      key={`${product.type}-${product.query}`}
                      href={product.link}
                      target="_blank"
                      rel="noreferrer"
                      className="block rounded-2xl border border-white/10 bg-black/20 p-4 hover:bg-black/30"
                    >
                      <div className="font-medium">{product.type}</div>
                      <div className="mt-1 text-sm text-white/50">{product.query}</div>
                    </a>
                  ))}
                </div>
              </div>

              <div className="rounded-[28px] border border-white/10 bg-white/5 p-6">
                <div className="font-semibold">Feedback</div>
                <div className="mt-4 flex flex-wrap gap-3">
                  {(['Too Cold', 'Comfortable', 'Too Hot'] as const).map((item) => (
                    <button
                      key={item}
                      onClick={() => void handleFeedback(item)}
                      className="rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm hover:bg-black/30"
                    >
                      {item}
                    </button>
                  ))}
                </div>
                {feedbackSaved ? <div className="mt-3 text-sm text-emerald-300">Saved: {feedbackSaved}</div> : null}
              </div>
            </aside>
          </div>
        ) : userLoading ? <Centered message="Analyzing live weather and AQI..." /> : null}
      </div>
    </Shell>
  );
}

function Shell({ children, onLogout, userName }: { children: React.ReactNode; onLogout?: () => void; userName?: string }) {
  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white">
      <header className="fixed top-0 z-20 w-full border-b border-white/5 bg-[#0A0A0A]/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600">
              <Zap className="h-4 w-4" />
            </div>
            <div className="font-mono text-xl font-bold tracking-tighter">KAIT</div>
          </div>
          {onLogout ? (
            <div className="flex items-center gap-3">
              <div className="hidden text-right md:block">
                <div className="text-xs uppercase tracking-[0.2em] text-white/40">Active session</div>
                <div className="text-sm">{userName}</div>
              </div>
              <button onClick={onLogout} className="rounded-full p-2 hover:bg-white/5" aria-label="Sign out">
                <LogOut className="h-5 w-5 text-white/65" />
              </button>
            </div>
          ) : null}
        </div>
      </header>
      {children}
    </div>
  );
}

function Centered({ message, children }: { message: string; children?: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <div className="text-4xl font-bold tracking-tight md:text-6xl">{message}</div>
      {children}
    </div>
  );
}

function MetricCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub: string }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
      <div className="flex items-center gap-2 text-sm uppercase tracking-[0.15em] text-white/45">{icon}{label}</div>
      <div className="mt-3 text-2xl font-semibold">{value}</div>
      <div className="mt-2 text-sm text-white/50">{sub}</div>
    </div>
  );
}

function getCurrentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported in this browser.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, (error) => {
      reject(new Error(error.message || 'Unable to access location.'));
    }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 });
  });
}
