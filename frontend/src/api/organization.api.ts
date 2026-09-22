import apiClient from './client';
import type { Region, District, Branch } from '@/types/organization.types';

export const organizationApi = {
  // Scoped (filtered by user's own scope)
  getRegions: () => apiClient.get<Region[]>('/regions').then(r => r.data),
  getDistricts: (regionId: number) => apiClient.get<District[]>(`/regions/${regionId}/districts`).then(r => r.data),
  getBranches: (districtId: number) => apiClient.get<Branch[]>(`/districts/${districtId}/branches`).then(r => r.data),

  // Admin (unfiltered)
  getAllRegions: () => apiClient.get<Region[]>('/regions/all').then(r => r.data),
  getAllDistricts: (regionId?: number) => apiClient.get<District[]>('/districts/all', { params: { region_id: regionId } }).then(r => r.data),
  getAllBranches: (districtId?: number, regionId?: number) => apiClient.get<Branch[]>('/branches/all', { params: { district_id: districtId, region_id: regionId } }).then(r => r.data),

  createRegion: (data: { code: string; name: string }) => apiClient.post<Region>('/regions', data).then(r => r.data),
  updateRegion: (id: number, data: { code: string; name: string; status: string }) => apiClient.put<Region>(`/regions/${id}`, data).then(r => r.data),

  createDistrict: (data: { code: string; name: string; region_id: number }) => apiClient.post<District>('/districts', data).then(r => r.data),
  updateDistrict: (id: number, data: { code: string; name: string; region_id: number; status: string }) => apiClient.put<District>(`/districts/${id}`, data).then(r => r.data),

  createBranch: (data: { code: string; name: string; region_id: number; district_id: number }) => apiClient.post<Branch>('/branches', data).then(r => r.data),
  updateBranch: (id: number, data: { code: string; name: string; region_id: number; district_id: number; status: string }) => apiClient.put<Branch>(`/branches/${id}`, data).then(r => r.data),
};
