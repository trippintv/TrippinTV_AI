
export interface User {
  id: string;
  username: string;
  avatar: string;
  bio?: string;
  isAdmin: boolean;
  hasAgreedToDisclaimer: boolean;
  points: number;
}

export interface Comment {
  id: string;
  userId: string;
  username: string;
  avatar: string;
  text: string;
  videoId?: string | null;
  postId?: string | null;
  parentId?: string | null;
  createdAt: string;
}

export interface Post {
  id: string;
  userId: string;
  username: string;
  title?: string | null;
  text: string;
  category?: string | null;
  comments: Comment[];
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

export interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  text: string;
  createdAt: string;
}

export interface Chat {
  id: string;
  participants: [string, string];
  messages: Message[];
}

export interface FriendRequest {
  id: string;
  senderId: string;
  receiverId: string;
  status: string;
  sender?: User;
  receiver?: User;
}

export interface FriendsData {
  friends: User[];
  incoming: FriendRequest[];
  outgoing: FriendRequest[];
}

export type ReactionType = 'fire' | 'laugh' | 'skull' | 'heart' | 'eyes';

export interface ReactionSummary {
  fire: number;
  laugh: number;
  skull: number;
  heart: number;
  eyes: number;
}

export interface Notification {
  id: string;
  recipientId: string;
  actorId?: string | null;
  type: string;
  entityId?: string | null;
  text: string;
  read: boolean;
  createdAt: string;
}

export interface PublicProfile {
  user: User;
  videos: Video[];
  followerCount: number;
  followingCount: number;
}

export type ViewType = 'feed' | 'leaderboard' | 'profile' | 'upload' | 'chat' | 'friends' | 'notifications' | 'user' | 'posts';

export interface ViewState {
  view: ViewType;
  userId?: string;
  videoId?: string;
}
