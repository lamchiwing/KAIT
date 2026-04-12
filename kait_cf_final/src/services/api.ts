export interface EnvironmentalContext {
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

export interface PhysiologyContext {
  lifeStage: string;
  sleepQuality: number;
  menstrualCycle?: boolean;
  cycleDay?: number;
}

export interface KAITRecommendation {
  look_summary: string;
  outfit: string[];
  feels_like: string;
  advice: string;
  products: Array<{ type: string; query: string; link: string }>;
  lookbook_prompt: string;
}

export interface RecommendationResponse {
  recommendation: KAITRecommendation;
  context: EnvironmentalContext;
  cache: {
    weather: string;
    air: string;
  };
}

interface RecommendationRequest {
  location: { lat: number; lng: number };
  userProfile: { gender: string; thermalBenchmark: string; stylePreference?: string };
  physiology: PhysiologyContext;
}

export async function getKAITRecommendation(
  location: { lat: number; lng: number },
  userProfile: { gender: string; thermalBenchmark: string; stylePreference?: string },
  physiology: PhysiologyContext,
): Promise<RecommendationResponse> {
  const response = await fetch('/api/recommend', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ location, userProfile, physiology } satisfies RecommendationRequest),
  });

  const raw = await response.text();
  let data: unknown = null;

  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    throw new Error(`Invalid response from recommendation API (${response.status}).`);
  }

  if (!response.ok) {
    const message =
      typeof data === 'object' && data && 'error' in data && typeof (data as { error?: unknown }).error === 'string'
        ? (data as { error: string }).error
        : `Recommendation request failed (${response.status}).`;
    throw new Error(message);
  }

  if (!isRecommendationResponse(data)) {
    throw new Error('Recommendation API returned an unexpected payload.');
  }

  return data;
}

function isEnvironmentalContext(data: unknown): data is EnvironmentalContext {
  if (!data || typeof data !== 'object') return false;
  const value = data as Record<string, unknown>;
  return !!(value.location && value.atmospheric && value.optical && value.biochemical && value.geovisual);
}

function isKAITRecommendation(data: unknown): data is KAITRecommendation {
  if (!data || typeof data !== 'object') return false;
  const value = data as Record<string, unknown>;
  return (
    typeof value.look_summary === 'string' &&
    Array.isArray(value.outfit) &&
    value.outfit.every((item) => typeof item === 'string') &&
    typeof value.feels_like === 'string' &&
    typeof value.advice === 'string' &&
    Array.isArray(value.products) &&
    value.products.every(
      (item) =>
        item &&
        typeof item === 'object' &&
        typeof (item as Record<string, unknown>).type === 'string' &&
        typeof (item as Record<string, unknown>).query === 'string' &&
        typeof (item as Record<string, unknown>).link === 'string',
    ) &&
    typeof value.lookbook_prompt === 'string'
  );
}

function isRecommendationResponse(data: unknown): data is RecommendationResponse {
  if (!data || typeof data !== 'object') return false;
  const value = data as Record<string, unknown>;
  return (
    isKAITRecommendation(value.recommendation) &&
    isEnvironmentalContext(value.context) &&
    !!value.cache &&
    typeof (value.cache as Record<string, unknown>).weather === 'string' &&
    typeof (value.cache as Record<string, unknown>).air === 'string'
  );
}
