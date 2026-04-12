interface Env {
  GEMINI_API_KEY: string;
}

interface LocationInput {
  lat: number;
  lng: number;
}

interface PhysiologyContext {
  lifeStage: string;
  sleepQuality: number;
  menstrualCycle?: boolean;
  cycleDay?: number;
}

interface UserProfile {
  gender: string;
  thermalBenchmark: string;
  stylePreference?: string;
}

interface RecommendationRequest {
  location: LocationInput;
  userProfile: UserProfile;
  physiology: PhysiologyContext;
}

interface EnvironmentalContext {
  location: {
    lat: number;
    lng: number;
    city?: string;
  };
  atmospheric: {
    temp: number;
    humidity: number;
    pressure: number;
    windSpeed?: number;
    weatherCode?: number;
  };
  optical: {
    uvIndex: number;
    daylightHours: number;
  };
  biochemical: {
    aqi: number;
    waterHardness?: string;
  };
  geovisual: {
    terrain: string;
    dominantColors: string[];
  };
}

interface KAITRecommendation {
  look_summary: string;
  outfit: string[];
  feels_like: string;
  advice: string;
  products: Array<{ type: string; query: string; link: string }>;
  lookbook_prompt: string;
}

export const onRequestOptions: PagesFunction<Env> = async () => cors(new Response(null, { status: 204 }));

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  try {
    if (!ctx.env.GEMINI_API_KEY) {
      return json({ error: 'Missing GEMINI_API_KEY secret in Cloudflare Pages.' }, 500);
    }

    const payload = (await ctx.request.json()) as Partial<RecommendationRequest>;
    if (!isValidPayload(payload)) {
      return json({ error: 'Invalid recommendation request payload.' }, 400);
    }

    const [weatherResult, airResult] = await Promise.all([
      getWeatherContext(payload.location, ctx.request),
      getAirQualityContext(payload.location, ctx.request),
    ]);

    const mergedContext: EnvironmentalContext = {
      location: {
        lat: payload.location.lat,
        lng: payload.location.lng,
        city: weatherResult.city || 'Current Location',
      },
      atmospheric: weatherResult.atmospheric,
      optical: weatherResult.optical,
      biochemical: {
        ...airResult.biochemical,
        waterHardness: 'Unknown',
      },
      geovisual: inferGeoVisual(payload.location),
    };

    const prompt = buildPrompt(mergedContext, payload.userProfile, payload.physiology);
    const geminiResp = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': ctx.env.GEMINI_API_KEY,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.6,
          },
        }),
      },
    );

    const geminiJson = (await geminiResp.json()) as any;
    if (!geminiResp.ok) {
      return json({ error: geminiJson?.error?.message || 'Gemini request failed.' }, geminiResp.status);
    }

    const text = geminiJson?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text || typeof text !== 'string') {
      return json({ error: 'Gemini returned an empty response.' }, 502);
    }

    let recommendation: unknown;
    try {
      recommendation = JSON.parse(text);
    } catch {
      return json({ error: 'Gemini returned invalid JSON.' }, 502);
    }

    if (!isRecommendation(recommendation)) {
      return json({ error: 'Gemini response did not match expected format.' }, 502);
    }

    return json(
      {
        recommendation,
        context: mergedContext,
        cache: {
          weather: weatherResult.cache,
          air: airResult.cache,
        },
      },
      200,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected server error.';
    return json({ error: message }, 500);
  }
};

async function getWeatherContext(location: LocationInput, request: Request) {
  const weatherUrl = new URL('https://api.open-meteo.com/v1/forecast');
  weatherUrl.searchParams.set('latitude', String(location.lat));
  weatherUrl.searchParams.set('longitude', String(location.lng));
  weatherUrl.searchParams.set(
    'current',
    'temperature_2m,relative_humidity_2m,surface_pressure,wind_speed_10m,weather_code,is_day',
  );
  weatherUrl.searchParams.set('daily', 'uv_index_max,sunrise,sunset');
  weatherUrl.searchParams.set('timezone', 'auto');

  const reverseUrl = new URL('https://geocoding-api.open-meteo.com/v1/reverse');
  reverseUrl.searchParams.set('latitude', String(location.lat));
  reverseUrl.searchParams.set('longitude', String(location.lng));
  reverseUrl.searchParams.set('language', 'en');

  const [weatherResp, reverseResp] = await Promise.all([
    cachedFetch(weatherUrl.toString(), request, 30 * 60),
    cachedFetch(reverseUrl.toString(), request, 24 * 60 * 60),
  ]);

  const weatherJson = (await weatherResp.response.json()) as any;
  const reverseJson = (await reverseResp.response.json()) as any;

  const current = weatherJson?.current;
  const daily = weatherJson?.daily;
  const sunrise = daily?.sunrise?.[0] ? new Date(daily.sunrise[0]) : null;
  const sunset = daily?.sunset?.[0] ? new Date(daily.sunset[0]) : null;
  const daylightHours = sunrise && sunset ? Math.max(0, (sunset.getTime() - sunrise.getTime()) / 36e5) : 12;

  return {
    atmospheric: {
      temp: numberOr(current?.temperature_2m, 22),
      humidity: numberOr(current?.relative_humidity_2m, 65),
      pressure: numberOr(current?.surface_pressure, 1012),
      windSpeed: numberOr(current?.wind_speed_10m, 10),
      weatherCode: numberOr(current?.weather_code, 0),
    },
    optical: {
      uvIndex: numberOr(daily?.uv_index_max?.[0], 4),
      daylightHours,
    },
    city: reverseJson?.results?.[0]?.name || undefined,
    cache: weatherResp.cache,
  };
}

async function getAirQualityContext(location: LocationInput, request: Request) {
  const airUrl = new URL('https://air-quality-api.open-meteo.com/v1/air-quality');
  airUrl.searchParams.set('latitude', String(location.lat));
  airUrl.searchParams.set('longitude', String(location.lng));
  airUrl.searchParams.set('current', 'us_aqi');
  airUrl.searchParams.set('timezone', 'auto');

  const airResp = await cachedFetch(airUrl.toString(), request, 30 * 60);
  const airJson = (await airResp.response.json()) as any;

  return {
    biochemical: {
      aqi: numberOr(airJson?.current?.us_aqi, 42),
    },
    cache: airResp.cache,
  };
}

async function cachedFetch(url: string, request: Request, ttlSeconds: number) {
  const cache = caches.default;
  const cacheKey = new Request(url, { method: 'GET', headers: request.headers });
  const cached = await cache.match(cacheKey);
  if (cached) {
    return { response: cached, cache: 'HIT' as const };
  }

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'KAIT/1.0',
    },
    cf: {
      cacheTtl: ttlSeconds,
      cacheEverything: true,
    },
  });

  if (response.ok) {
    const responseToCache = new Response(response.body, response);
    responseToCache.headers.set('Cache-Control', `public, max-age=${ttlSeconds}`);
    await cache.put(cacheKey, responseToCache.clone());
    return { response: responseToCache, cache: 'MISS' as const };
  }

  return { response, cache: 'BYPASS' as const };
}

function inferGeoVisual(location: LocationInput) {
  const absLat = Math.abs(location.lat);
  let terrain = 'Urban';
  if (absLat > 50) terrain = 'Northern / temperate urban';
  if (absLat < 24) terrain = 'Subtropical / coastal urban';

  return {
    terrain,
    dominantColors: ['#2C3E50', '#E0E0E0', '#3498DB'],
  };
}

function buildPrompt(context: EnvironmentalContext, userProfile: UserProfile, physiology: PhysiologyContext): string {
  return `As KAIT, an AI-driven Contextual Decision Engine, analyze the environment and user profile to provide a specific look and action advice.

CRITICAL:
1. Focus on decision outsourcing. Do not just show data.
2. Respond in the primary language of the location: ${context.location.city || 'Current Location'}.
3. Use the user's thermal benchmark as a calibration anchor.
4. Return JSON only. No markdown.

USER THERMAL CONSTITUTION:
- At 15°C, this user typically wears: ${userProfile.thermalBenchmark}.

INPUT DATA:
- Weather: ${context.atmospheric.temp}°C, Pressure: ${context.atmospheric.pressure}hPa, Humidity: ${context.atmospheric.humidity}%, Wind: ${context.atmospheric.windSpeed || 0} km/h, UV: ${context.optical.uvIndex}
- Air quality: AQI ${context.biochemical.aqi}
- Terrain: ${context.geovisual.terrain}, Dominant colors: ${context.geovisual.dominantColors.join(', ')}
- User: Gender: ${userProfile.gender}, Style: ${userProfile.stylePreference || 'Minimalist'}
- Physiology: ${physiology.lifeStage}, Sleep: ${physiology.sleepQuality}/100, Cycle active: ${physiology.menstrualCycle ? 'yes' : 'no'}, Cycle day: ${physiology.cycleDay || 0}

OUTPUT JSON FORMAT:
{
  "look_summary": "One sentence summary",
  "outfit": ["item 1", "item 2", "item 3"],
  "feels_like": "cold/comfortable/hot",
  "advice": "Specific action advice",
  "products": [
    { "type": "item type", "query": "search query", "link": "shopping search link" }
  ],
  "lookbook_prompt": "Image-generation prompt for this look"
}`;
}

function numberOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function cors(response: Response): Response {
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
  return response;
}

function json(data: unknown, status = 200): Response {
  return cors(
    new Response(JSON.stringify(data), {
      status,
      headers: {
        'Content-Type': 'application/json',
      },
    }),
  );
}

function isValidPayload(payload: Partial<RecommendationRequest>): payload is RecommendationRequest {
  return !!(
    payload?.location &&
    typeof payload.location.lat === 'number' &&
    typeof payload.location.lng === 'number' &&
    payload?.userProfile &&
    typeof payload.userProfile.gender === 'string' &&
    typeof payload.userProfile.thermalBenchmark === 'string' &&
    payload?.physiology
  );
}

function isRecommendation(data: unknown): data is KAITRecommendation {
  if (!data || typeof data !== 'object') return false;
  const value = data as Record<string, unknown>;
  return (
    typeof value.look_summary === 'string' &&
    Array.isArray(value.outfit) &&
    typeof value.feels_like === 'string' &&
    typeof value.advice === 'string' &&
    Array.isArray(value.products) &&
    typeof value.lookbook_prompt === 'string'
  );
}
