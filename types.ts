
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

export type ViewType = 'feed' | 'leaderboard' | 'profile' | 'upload' | 'chat' | 'friends';
