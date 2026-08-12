export interface Track {
  id: string;
  youtubeId: string;
  title: string;
  artist: string;
  movie?: string;
  duration: string;
  durationSeconds: number;
  thumbnail: string;
  description?: string;
}

export interface Shayari {
  id: number;
  hindiText: string;
  englishSub?: string;
  meaning?: string;
  category: 'romantic' | 'attitude' | 'patriotic' | 'life' | 'humor';
}
