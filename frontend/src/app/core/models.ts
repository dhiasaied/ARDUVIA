export type Locale = 'en' | 'fr' | 'es' | 'ar';

export interface LessonSummary {
  slug: string;
  position: number;
  category: string;
  title: string;
  subtitle: string;
}

export interface Feature { icon: string; html: string; }
export interface PinRow { color: string; pin: string; to: string; role: string; }
export interface Spec { label: string; value: string; }
export interface PartInfo { id: string; name: string; desc: string; }
export interface TagInfo { part: string; label: string; }
export interface Callout { part: string; title: string; text: string; }
export interface Challenge { title: string; goal: string; hint: string; }

export interface LessonDetail extends LessonSummary {
  locale: Locale;
  heading: string;
  lede: string;
  hint: string | null;
  code: string;
  features: Feature[];
  pinoutSub: string;
  pinout: PinRow[];
  steps: string[];
  specs: Spec[];
  parts: PartInfo[];
  tags: TagInfo[];
  callouts: Callout[];
  challenge: Challenge | null;
}

export interface Settings {
  labels: boolean;
  flow: boolean;
  grid: boolean;
  autoRotate: boolean;
  sound: boolean;
  reducedMotion: boolean;
}

export interface ProgressSnapshot {
  completed: string[];
  count: number;
  total: number;
}

export interface LearnerProfile {
  token: string;
  locale: Locale;
  settings: Settings;
  progress: ProgressSnapshot;
}

export const DEFAULT_SETTINGS: Settings = {
  labels: true,
  flow: true,
  grid: true,
  autoRotate: false,
  sound: true,
  reducedMotion: false,
};
