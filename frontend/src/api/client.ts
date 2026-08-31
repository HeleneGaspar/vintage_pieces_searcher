import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

export interface Piece {
  id: string;
  brand: string;
  image_filename: string;
  category: string | null;
  material: string | null;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  result_count: number;
  unseen_count: number;
}

export interface SearchResult {
  id: string;
  piece_id: string;
  vinted_item_id: string;
  title: string | null;
  price: number | null;
  currency: string | null;
  image_url: string | null;
  item_url: string;
  similarity_score: number | null;
  brand: string | null;
  size: string | null;
  is_favorited: boolean;
  is_seen: boolean;
  fetched_at: string;
}

export interface PieceWithResults extends Piece {
  results: SearchResult[];
}

export interface SearchStatus {
  status: string;
  message: string;
}

export interface NotificationGroup {
  piece_id: string;
  brand: string;
  image_filename: string;
  unseen_count: number;
}

export interface NotificationsOut {
  total_unseen: number;
  groups: NotificationGroup[];
}

export const getPieces = () => api.get<Piece[]>('/pieces').then((r) => r.data);

export const getFeed = () => api.get<PieceWithResults[]>('/pieces/feed').then((r) => r.data);

export const getFavorites = () => api.get<PieceWithResults[]>('/pieces/favorites').then((r) => r.data);

export const getPiece = (id: string) =>
  api.get<PieceWithResults>(`/pieces/${id}`).then((r) => r.data);

export const createPiece = (data: FormData) =>
  api.post<Piece>('/pieces', data).then((r) => r.data);

export const updatePiece = (id: string, data: Record<string, unknown>) =>
  api.put<Piece>(`/pieces/${id}`, data).then((r) => r.data);

export const updatePieceImage = (id: string, file: File) => {
  const fd = new FormData();
  fd.append('image', file);
  return api.put<Piece>(`/pieces/${id}/image`, fd).then((r) => r.data);
};

export const deletePiece = (id: string) => api.delete(`/pieces/${id}`);

export const searchPiece = (id: string) =>
  api.post<SearchStatus>(`/pieces/${id}/search`).then((r) => r.data);

export const searchAll = () =>
  api.post<SearchStatus>('/search-all').then((r) => r.data);

export const toggleFavorite = (pieceId: string, resultId: string) =>
  api.patch<SearchResult>(`/pieces/${pieceId}/results/${resultId}/favorite`).then((r) => r.data);

export const markResultsSeen = (pieceId: string) =>
  api.post<SearchStatus>(`/pieces/${pieceId}/results/mark-seen`).then((r) => r.data);

export const getNotifications = () =>
  api.get<NotificationsOut>('/notifications').then((r) => r.data);

export const vintedLogin = () =>
  api.post<SearchStatus>('/vinted-login', null, { timeout: 150000 }).then((r) => r.data);

export const vintedLoginStatus = () =>
  api.get<SearchStatus>('/vinted-login/status').then((r) => r.data);
