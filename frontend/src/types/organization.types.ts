export interface Region { id: number; code: string; name: string; status: string; }
export interface District { id: number; code: string; name: string; region_id: number; status: string; }
export interface Branch { id: number; code: string; name: string; district_id: number; region_id: number; status: string; }
