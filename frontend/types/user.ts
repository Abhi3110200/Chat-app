export interface User {
  id: string;
  name: string;
  email?: string;
  avatar?: string;
  isOnline?: boolean;
  lastSeen?: string;
}
