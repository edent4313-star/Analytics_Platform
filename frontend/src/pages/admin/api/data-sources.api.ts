import apiClient from '../../../api/client';

export interface DataSource {
  id: number;
  name: string;
  source_type: string;
  description?: string;
  host?: string;
  port?: number;
  database_name?: string;
  service_name?: string;
  schema_name?: string;
  api_url?: string;
  file_path?: string;
  is_active: boolean;
  created_at: string;
  username?: string;
}

export const dataSourcesApi = {
  list: async (): Promise<DataSource[]> => {
    const { data } = await apiClient.get<DataSource[]>('/data-sources');
    return data;
  },

  get: async (id: number): Promise<DataSource> => {
    const { data } = await apiClient.get<DataSource>(`/data-sources/${id}`);
    return data;
  },

  create: async (source: Omit<DataSource, 'id' | 'created_at' | 'username'>): Promise<DataSource> => {
    const { data } = await apiClient.post<DataSource>('/data-sources', source);
    return data;
  },

  update: async (id: number, source: Omit<DataSource, 'id' | 'created_at' | 'username'>): Promise<DataSource> => {
    const { data } = await apiClient.put<DataSource>(`/data-sources/${id}`, source);
    return data;
  },

  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/data-sources/${id}`);
  },

  testConnection: async (id: number): Promise<{ success: boolean; message: string }> => {
    const { data } = await apiClient.post<{ success: boolean; message: string }>(`/data-sources/${id}/test`);
    return data;
  },

  getSchema: async (id: number, schema: string = 'public'): Promise<{ objects: any[] }> => {
    const { data } = await apiClient.get<{ objects: any[] }>(`/data-sources/${id}/schema`, { params: { schema } });
    return data;
  },

  getFields: async (id: number, schema: string = 'public', objectName: string = ''): Promise<{ fields: any[] }> => {
    const { data } = await apiClient.get<{ fields: any[] }>(`/data-sources/${id}/fields`, {
      params: { schema, object_name: objectName },
    });
    return data;
  },

  uploadExcel: async (file: File, name?: string): Promise<{ id: number; name: string; source_type: string; file_path: string; sheet_names: string[]; message: string }> => {
    const formData = new FormData();
    formData.append('file', file);
    if (name) formData.append('name', name);

    const { data } = await apiClient.post<{ id: number; name: string; source_type: string; file_path: string; sheet_names: string[]; message: string }>('/data-sources/upload-excel', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },
};
