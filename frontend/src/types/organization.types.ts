export interface Region {
  id: number;
  code: string;
  name: string;
}

export interface District {
  id: number;
  code: string;
  name: string;
  region_id: number;
}

export interface Branch {
  id: number;
  code: string;
  name: string;
  district_id: number;
  region_id: number;
}
