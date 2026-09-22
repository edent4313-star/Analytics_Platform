import apiClient from './client';
import type { Dataset, DatasetField } from '@/types/dataset.types';

export const datasetsApi = {
  list: async (): Promise<Dataset[]> => {
    const { data } = await apiClient.get<Dataset[]>('/datasets');
    return data;
  },

  get: async (id: number): Promise<Dataset> => {
    const { data } = await apiClient.get<Dataset>(`/datasets/${id}`);
    return data;
  },

  getFields: async (id: number): Promise<DatasetField[]> => {
    const { data } = await apiClient.get<DatasetField[]>(`/datasets/${id}/fields`);
    return data;
  },
};
