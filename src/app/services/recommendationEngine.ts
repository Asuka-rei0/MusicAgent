import type { ChatMessageModel, TrackCard } from '../interfaces/IMusicView';

export interface AudioFeatures {
  energy: number;
  valence: number;
  tempo: number;
  acousticness: number;
  instrumentalness: number;
  danceability: number;
  genre: string[];
  mood: string[];
}

export interface TrackFeatures extends AudioFeatures {
  trackId: string;
  title: string;
  artist: string;
  coverUrl: string;
}

export interface UserFeedback {
  trackId: string;
  liked: boolean;
  skipped: boolean;
  playCount: number;
  totalPlayTimeMs: number;
}

export interface MoodProfile {
  name: string;
  weights: FeatureWeights;
  description: string;
}

export interface FeatureWeights {
  energy: number;
  valence: number;
  tempo: number;
  acousticness: number;
  instrumentalness: number;
  danceability: number;
  genreMatch: number;
  artistPenalty: number;
}

export interface RecommendationResult {
  tracks: TrackFeatures[];
  explanation: string;
  confidence: number;
}

const DEFAULT_WEIGHTS: FeatureWeights = {
  energy: 0.15,
  valence: 0.2,
  tempo: 0.1,
  acousticness: 0.15,
  instrumentalness: 0.1,
  danceability: 0.1,
  genreMatch: 0.15,
  artistPenalty: -0.05,
};

const MOOD_PROFILES: Record<string, MoodProfile> = {
  focus: {
    name: 'Focus',
    description: 'Low energy, instrumental, steady tempo',
    weights: {
      energy: 0.05,
      valence: 0.1,
      tempo: 0.05,
      acousticness: 0.2,
      instrumentalness: 0.35,
      danceability: 0.05,
      genreMatch: 0.15,
      artistPenalty: -0.05,
    },
  },
  'rainy-day': {
    name: 'Rainy Day',
    description: 'Low energy, melancholic, acoustic',
    weights: {
      energy: 0.05,
      valence: 0.25,
      tempo: 0.05,
      acousticness: 0.3,
      instrumentalness: 0.15,
      danceability: 0.05,
      genreMatch: 0.1,
      artistPenalty: -0.05,
    },
  },
  'jazz-night': {
    name: 'Jazz Night',
    description: 'Smooth jazz, low to medium energy',
    weights: {
      energy: 0.15,
      valence: 0.15,
      tempo: 0.1,
      acousticness: 0.2,
      instrumentalness: 0.2,
      danceability: 0.1,
      genreMatch: 0.25,
      artistPenalty: -0.05,
    },
  },
  'morning-coffee': {
    name: 'Morning Coffee',
    description: 'Upbeat, positive, gentle energy',
    weights: {
      energy: 0.2,
      valence: 0.25,
      tempo: 0.15,
      acousticness: 0.15,
      instrumentalness: 0.05,
      danceability: 0.1,
      genreMatch: 0.1,
      artistPenalty: -0.05,
    },
  },
  'chill-vibes': {
    name: 'Chill Vibes',
    description: 'Relaxed, positive, easy listening',
    weights: {
      energy: 0.1,
      valence: 0.2,
      tempo: 0.1,
      acousticness: 0.2,
      instrumentalness: 0.1,
      danceability: 0.15,
      genreMatch: 0.1,
      artistPenalty: -0.05,
    },
  },
  energize: {
    name: 'Energize',
    description: 'High energy, upbeat, fast tempo',
    weights: {
      energy: 0.3,
      valence: 0.2,
      tempo: 0.2,
      acousticness: 0.05,
      instrumentalness: 0.05,
      danceability: 0.2,
      genreMatch: 0.1,
      artistPenalty: -0.05,
    },
  },
};

const NLP_MOOD_MAPPINGS: Record<string, string[]> = {
  tired: ['low-energy', 'acoustic', 'instrumental', 'chill'],
  soothing: ['low-energy', 'acoustic', 'high-valence', 'instrumental'],
  sleepy: ['low-energy', 'acoustic', 'instrumental', 'slow-tempo'],
  relaxed: ['low-energy', 'high-valence', 'acoustic', 'chill'],
  happy: ['high-valence', 'medium-energy', 'upbeat'],
  sad: ['low-valence', 'low-energy', 'acoustic'],
  angry: ['high-energy', 'low-valence', 'aggressive'],
  focused: ['instrumental', 'low-energy', 'steady-tempo'],
  workout: ['high-energy', 'high-tempo', 'danceable'],
  party: ['high-energy', 'high-valence', 'danceable', 'upbeat'],
  romantic: ['low-tempo', 'high-valence', 'acoustic', 'vocal'],
  nostalgic: ['acoustic', 'medium-energy', 'vocal'],
};

function normalizeFeatures(features: AudioFeatures): AudioFeatures {
  return {
    energy: Math.max(0, Math.min(1, features.energy)),
    valence: Math.max(0, Math.min(1, features.valence)),
    tempo: Math.max(0, Math.min(1, features.tempo / 200)),
    acousticness: Math.max(0, Math.min(1, features.acousticness)),
    instrumentalness: Math.max(0, Math.min(1, features.instrumentalness)),
    danceability: Math.max(0, Math.min(1, features.danceability)),
    genre: features.genre || [],
    mood: features.mood || [],
  };
}

function computeSimilarity(
  track: TrackFeatures,
  target: AudioFeatures,
  weights: FeatureWeights
): number {
  const normalized = normalizeFeatures(track);
  const targetNorm = normalizeFeatures(target);

  let score = 0;
  let totalWeight = 0;

  const featureKeys: (keyof Omit<FeatureWeights, 'genreMatch' | 'artistPenalty'>)[] = [
    'energy',
    'valence',
    'tempo',
    'acousticness',
    'instrumentalness',
    'danceability',
  ];

  for (const key of featureKeys) {
    const weight = Math.abs(weights[key]);
    const diff = normalized[key] - targetNorm[key];
    const similarity = 1 - Math.abs(diff);
    score += similarity * weights[key];
    totalWeight += weight;
  }

  if (weights.genreMatch > 0 && target.genre.length > 0) {
    const genreOverlap = normalized.genre.filter((g) =>
      target.genre.some((tg) => tg.toLowerCase() === g.toLowerCase())
    ).length;
    const genreRatio =
      genreOverlap / Math.max(normalized.genre.length, target.genre.length);
    score += genreRatio * weights.genreMatch;
    totalWeight += weights.genreMatch;
  }

  return totalWeight > 0 ? score / totalWeight : 0;
}

function extractKeywordsFromPrompt(prompt: string): string[] {
  const lower = prompt.toLowerCase();
  const keywords: string[] = [];

  for (const [mood, tags] of Object.entries(NLP_MOOD_MAPPINGS)) {
    if (lower.includes(mood)) {
      keywords.push(...tags);
    }
  }

  const genreKeywords = [
    'jazz',
    'rock',
    'pop',
    'classical',
    'electronic',
    'hip-hop',
    'r&b',
    'country',
    'folk',
    'blues',
    'metal',
    'indie',
    'ambient',
    'lo-fi',
  ];
  for (const genre of genreKeywords) {
    if (lower.includes(genre)) {
      keywords.push(genre);
    }
  }

  return keywords.length > 0 ? keywords : ['chill', 'balanced'];
}

function buildTargetFeaturesFromKeywords(keywords: string[]): AudioFeatures {
  const target: AudioFeatures = {
    energy: 0.5,
    valence: 0.5,
    tempo: 120,
    acousticness: 0.5,
    instrumentalness: 0.3,
    danceability: 0.5,
    genre: [],
    mood: keywords,
  };

  for (const kw of keywords) {
    switch (kw) {
      case 'low-energy':
        target.energy = 0.2;
        break;
      case 'high-energy':
        target.energy = 0.8;
        break;
      case 'high-valence':
        target.valence = 0.8;
        break;
      case 'low-valence':
        target.valence = 0.2;
        break;
      case 'acoustic':
        target.acousticness = 0.8;
        break;
      case 'instrumental':
        target.instrumentalness = 0.9;
        break;
      case 'danceable':
        target.danceability = 0.8;
        break;
      case 'slow-tempo':
        target.tempo = 60;
        break;
      case 'fast-tempo':
        target.tempo = 160;
        break;
      case 'upbeat':
        target.valence = 0.8;
        target.energy = 0.7;
        break;
      case 'chill':
        target.energy = 0.3;
        target.valence = 0.6;
        break;
      default:
        if (!target.genre.includes(kw)) {
          target.genre.push(kw);
        }
    }
  }

  return target;
}

export class RecommendationEngine {
  private trackPool: TrackFeatures[] = [];
  private userFeedback: Map<string, UserFeedback> = new Map();
  private dynamicWeights: FeatureWeights = { ...DEFAULT_WEIGHTS };
  private skippedArtists: Set<string> = new Set();
  private likedGenres: Map<string, number> = new Map();

  constructor(initialTracks?: TrackFeatures[]) {
    if (initialTracks) {
      this.trackPool = initialTracks.map((t) => ({
        ...t,
        ...normalizeFeatures(t),
      }));
    }
  }

  setTrackPool(tracks: TrackFeatures[]): void {
    this.trackPool = tracks.map((t) => ({
      ...t,
      ...normalizeFeatures(t),
    }));
  }

  addTrack(track: TrackFeatures): void {
    this.trackPool.push({
      ...track,
      ...normalizeFeatures(track),
    });
  }

  recordFeedback(feedback: UserFeedback): void {
    this.userFeedback.set(feedback.trackId, feedback);

    const track = this.trackPool.find((t) => t.trackId === feedback.trackId);
    if (!track) return;

    if (feedback.skipped) {
      this.skippedArtists.add(track.artist);
    }

    if (feedback.liked && track.genre) {
      for (const g of track.genre) {
        this.likedGenres.set(g, (this.likedGenres.get(g) || 0) + 1);
      }
    }

    this.updateDynamicWeights();
  }

  private updateDynamicWeights(): void {
    const totalPlays = Array.from(this.userFeedback.values()).reduce(
      (sum, f) => sum + f.playCount,
      0
    );
    if (totalPlays < 5) return;

    const likedTracks = Array.from(this.userFeedback.values()).filter((f) => f.liked);
    const skippedTracks = Array.from(this.userFeedback.values()).filter((f) => f.skipped);

    if (likedTracks.length > 0) {
      const likedFeatures = likedTracks
        .map((f) => this.trackPool.find((t) => t.trackId === f.trackId))
        .filter((t): t is TrackFeatures => !!t);

      if (likedFeatures.length > 0) {
        const avgEnergy =
          likedFeatures.reduce((sum, t) => sum + t.energy, 0) / likedFeatures.length;
        const avgValence =
          likedFeatures.reduce((sum, t) => sum + t.valence, 0) / likedFeatures.length;

        this.dynamicWeights.energy = 0.1 + avgEnergy * 0.2;
        this.dynamicWeights.valence = 0.1 + avgValence * 0.2;
      }
    }

    if (skippedTracks.length > 0) {
      const skippedFeatures = skippedTracks
        .map((f) => this.trackPool.find((t) => t.trackId === f.trackId))
        .filter((t): t is TrackFeatures => !!t);

      if (skippedFeatures.length > 0) {
        const avgEnergy =
          skippedFeatures.reduce((sum, t) => sum + t.energy, 0) / skippedFeatures.length;
        this.dynamicWeights.energy -= avgEnergy * 0.05;
      }
    }

    const totalGenreLikes = Array.from(this.likedGenres.values()).reduce((a, b) => a + b, 0);
    if (totalGenreLikes > 0) {
      this.dynamicWeights.genreMatch = 0.1 + Math.min(0.2, totalGenreLikes * 0.02);
    }
  }

  recommendByMood(moodType: string, count: number = 20): RecommendationResult {
    const profile = MOOD_PROFILES[moodType.toLowerCase()];
    if (!profile) {
      return this.recommendByPrompt(moodType, count);
    }

    const targetFeatures: AudioFeatures = {
      energy: profile.weights.energy > 0.15 ? 0.7 : profile.weights.energy < 0.1 ? 0.3 : 0.5,
      valence: profile.weights.valence > 0.15 ? 0.7 : profile.weights.valence < 0.1 ? 0.3 : 0.5,
      tempo: profile.weights.tempo > 0.15 ? 140 : profile.weights.tempo < 0.1 ? 70 : 100,
      acousticness: profile.weights.acousticness > 0.2 ? 0.8 : 0.4,
      instrumentalness: profile.weights.instrumentalness > 0.2 ? 0.8 : 0.3,
      danceability: profile.weights.danceability > 0.15 ? 0.7 : 0.4,
      genre: [],
      mood: [moodType],
    };

    const scored = this.trackPool.map((track) => ({
      track,
      score: computeSimilarity(track, targetFeatures, {
        ...profile.weights,
        ...this.dynamicWeights,
      }),
    }));

    scored.sort((a, b) => b.score - a.score);

    const filtered = scored.filter(
      (s) => !this.skippedArtists.has(s.track.artist)
    );

    const selected = filtered.slice(0, count);

    return {
      tracks: selected.map((s) => s.track),
      explanation: `Based on ${profile.name} mood: ${profile.description}`,
      confidence: selected.length > 0 ? selected[0].score : 0,
    };
  }

  recommendByPrompt(prompt: string, count: number = 10): RecommendationResult {
    const keywords = extractKeywordsFromPrompt(prompt);
    const targetFeatures = buildTargetFeaturesFromKeywords(keywords);

    const combinedWeights = { ...DEFAULT_WEIGHTS, ...this.dynamicWeights };

    const scored = this.trackPool.map((track) => ({
      track,
      score: computeSimilarity(track, targetFeatures, combinedWeights),
    }));

    scored.sort((a, b) => b.score - a.score);

    const filtered = scored.filter(
      (s) => !this.skippedArtists.has(s.track.artist)
    );

    const selected = filtered.slice(0, count);

    const explanation = this.generateExplanation(keywords, selected[0]?.track);

    return {
      tracks: selected.map((s) => s.track),
      explanation,
      confidence: selected.length > 0 ? selected[0].score : 0,
    };
  }

  private generateExplanation(keywords: string[], topTrack?: TrackFeatures): string {
    if (!topTrack) {
      return 'Here are some recommendations for you.';
    }

    const moodDesc = keywords.slice(0, 3).join(', ');
    return `Based on your request for "${moodDesc}" vibes, I recommend "${topTrack.title}" by ${topTrack.artist}. ${this.describeTrack(topTrack)}`;
  }

  private describeTrack(track: TrackFeatures): string {
    const parts: string[] = [];
    if (track.energy < 0.3) parts.push('gentle and calming');
    else if (track.energy > 0.7) parts.push('energetic and dynamic');
    else parts.push('well-balanced');

    if (track.instrumentalness > 0.7) parts.push('with rich instrumental layers');
    if (track.acousticness > 0.6) parts.push('featuring acoustic elements');

    return `It's ${parts.join(', ')}.`;
  }

  getColdStartRecommendations(preferredGenres: string[], count: number = 20): RecommendationResult {
    const targetFeatures: AudioFeatures = {
      energy: 0.5,
      valence: 0.6,
      tempo: 100,
      acousticness: 0.5,
      instrumentalness: 0.3,
      danceability: 0.5,
      genre: preferredGenres,
      mood: ['balanced'],
    };

    const weights: FeatureWeights = {
      ...DEFAULT_WEIGHTS,
      genreMatch: 0.35,
    };

    const scored = this.trackPool.map((track) => ({
      track,
      score: computeSimilarity(track, targetFeatures, weights),
    }));

    scored.sort((a, b) => b.score - a.score);

    const selected = scored.slice(0, count);

    return {
      tracks: selected.map((s) => s.track),
      explanation: `Starting with popular ${preferredGenres.join(', ')} tracks to learn your taste.`,
      confidence: selected.length > 0 ? selected[0].score : 0,
    };
  }

  toChatMessage(result: RecommendationResult, prompt: string): ChatMessageModel {
    const topTrack = result.tracks[0];
    const card: TrackCard | undefined = topTrack
      ? {
          title: topTrack.title,
          artist: topTrack.artist,
          coverUrl: topTrack.coverUrl,
          description: result.explanation,
        }
      : undefined;

    return {
      id: Date.now().toString(),
      role: 'assistant',
      content: result.explanation,
      timestamp: new Date().toISOString(),
      card,
    };
  }
}

export const recommendationEngine = new RecommendationEngine();
