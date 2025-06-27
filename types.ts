export interface Building {
  id: string;
  name: string;
  floorCount: number;
  latitude: number;
  longitude: number;
  address: string;
  imageUrl?: string;
  floorIds?: string[];
}

export interface Floor {
  id: string;
  number: number;
  roomIds: string[];
  buildingId: string;
  imageUrl?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  permissions: string[];
}

export interface Friend {
  id: string;
  name: string;
  latitude?: number;
  longitude?: number;
  color?: string;
  profilePictureUrl?: string;
  lastSeen?: Date;
  isOnline?: boolean;
}

export interface Room {
  id: string;
  number: string;
  name: string;
  buildingId: string;
  floorId: string;
  capacity: number;
  features: string[];
  isBookable: boolean;
  accessible: boolean;
  tags: string[];
  latitude: number;
  longitude: number;
  imageUrl?: string;
  description?: string;
  lastUpdated?: Date;
  reservations?: string[];
}

export interface SearchFilters {
  query?: string;
  nearLocation?: Location;
  maxDistance?: number;
  onlyAccessible?: boolean;
  tags?: string[];
}

export type SortOrder = 'nearest' | 'alphabetical' | 'recently-added';

export interface ApiResponse<T> {
  data?: T;
  error?: {
    message: string; 
    code: string;
  };
}

declare module "*.po" {
  import type { Messages } from "@lingui/core";
  export const messages: Messages;
}