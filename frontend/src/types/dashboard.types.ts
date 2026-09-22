export type DashboardStatus = 'DRAFT' | 'PREVIEW' | 'SUBMITTED' | 'APPROVED' | 'PUBLISHED' | 'ARCHIVED';

export type WidgetType =
  | 'KPI'
  | 'LINE_CHART'
  | 'BAR_CHART'
  | 'H_BAR_CHART'
  | 'PIE_CHART'
  | 'DONUT_CHART'
  | 'AREA_CHART'
  | 'SCATTER_CHART'
  | 'TABLE'
  | 'TEXT'
  | 'IMAGE'
  | 'FILTER'
  | 'DATE_FILTER'
  | 'DIVIDER';

export interface Dashboard {
  id: number;
  code: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DashboardVersion {
  id: number;
  dashboard_id: number;
  version_number: number;
  status: DashboardStatus;
  layout_config: GridLayout[] | null;
  submitted_by: number | null;
  submitted_at: string | null;
  approved_by: number | null;
  approved_at: string | null;
  published_at: string | null;
  rejection_reason: string | null;
  widgets: DashboardWidget[];
  filters: DashboardFilter[];
}

export interface GridLayout {
  i: string;   // widget id as string
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface DashboardWidget {
  id: number;
  version_id: number;
  widget_type: WidgetType;
  title: string | null;
  position_x: number;
  position_y: number;
  width: number;
  height: number;
  config_json: WidgetConfig | null;
  dataset_id: number | null;
  sort_order: number;
}

export interface WidgetConfig {
  // KPI config
  field?: string;
  aggregation?: 'COUNT' | 'COUNT_DISTINCT' | 'SUM' | 'AVG' | 'MIN' | 'MAX';
  comparison_period?: string;
  number_format?: 'number' | 'currency' | 'percent';
  decimal_precision?: number;
  unit?: string;
  show_trend?: boolean;

  // Chart config
  chart_type?: string;
  dimension?: string;
  metric?: string;
  sort_by?: string;
  sort_order?: 'ASC' | 'DESC';
  top_n?: number;
  show_legend?: boolean;
  x_axis_label?: string;
  y_axis_label?: string;

  // Table config
  columns?: TableColumn[];
  enable_search?: boolean;
  enable_sort?: boolean;
  enable_export?: boolean;
  page_size?: number;

  // Text/Image config
  content?: string;
  image_url?: string;

  // Filter config
  filter_type?: string;
  target_widgets?: number[];
  [key: string]: unknown;
}

export interface TableColumn {
  field: string;
  display_name: string;
  width?: number;
  sortable?: boolean;
  filterable?: boolean;
}

export interface DashboardFilter {
  id: number;
  version_id: number;
  filter_type: string;
  field_name: string | null;
  display_name: string;
  is_global: boolean;
  default_value: string | null;
  sort_order: number;
}

/** Runtime filter state — what the user has currently selected */
export interface ActiveFilters {
  region_id?: number | null;
  district_id?: number | null;
  branch_id?: number | null;
  date_from?: string | null;
  date_to?: string | null;
  [key: string]: unknown;
}
