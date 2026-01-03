
export interface User {
  id: string;
  username: string;
  avatar: string;
  isLoggedIn: boolean;
  hasAgreedToDisclaimer: boolean;
  points: number;
}

export interface Comment {
  id: string;
  userId: string;
  username: string;
  avatar: string;
  text: string;
  createdAt: string;
}

export interface Video {
  id: string;
  userId: string;
  username: string;
  title: string;
  description: string;
  videoUrl: string;
  thumbnailUrl: string;
  trips: number;
  comments: Comment[];
  createdAt: string;
  hasVoted?: boolean;
}

export type ViewType = 'feed' | 'leaderboard' | 'profile' | 'upload';
