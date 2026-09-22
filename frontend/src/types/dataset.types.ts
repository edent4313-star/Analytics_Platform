export type DatasetStatus = 'DRAFT' | 'ACTIVE' | 'INACTIVE';
export type FieldDataType = 'TEXT' | 'NUMERIC' | 'DATE' | 'DATETIME' | 'BOOLEAN' | 'ID' | 'CATEGORY';
export type FieldCategory = 'DIMENSION' | 'METRIC' | 'DATE' | 'IDENTIFIER' | 'STATUS' | 'OTHER';
export type Aggregation = 'COUNT' | 'COUNT_DISTINCT' | 'SUM' | 'AVG' | 'MIN' | 'MAX';

export interface Dataset {
  id: number;
  name: string;
  description: string | null;
  status: DatasetStatus;
  source_id: number;
  schema_name: string | null;
  object_name: string;
  region_column: string | null;
  district_column: string | null;
  branch_column: string | null;
  created_at: string;
  updated_at: string;
}

export interface DatasetField {
  id: number;
  dataset_id: number;
  field_name: string;
  display_name: string;
  data_type: FieldDataType;
  field_category: FieldCategory;
  is_filterable: boolean;
  is_aggregatable: boolean;
  allowed_aggregations: string | null;
  sort_order: number;
}
