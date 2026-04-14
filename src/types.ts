export type Language = 'english' | 'português' | 'svenska';

export type Stage = 
  | 'language' 
  | 'intro' 
  | 'calibration' 
  | 'location' 
  | 'silhouette' 
  | 'dashboard';

export type Sensitivity = 'chilly' | 'bracing' | 'mild';

export type Archetype = 'hoodie' | 'trench' | 'puffer';

export type Silhouette = 'masculine' | 'feminine' | 'neutral';

export interface UserPreferences {
  language: Language;
  sensitivity?: Sensitivity;
  archetype?: Archetype;
  locationEnabled: boolean;
  silhouette?: Silhouette;
  location?: {
    lat: number;
    lon: number;
    city?: string;
  };
}

export interface WeatherData {
  temp: number;
  condition: string;
  uvIndex: number;
  rainExpected: boolean;
}
