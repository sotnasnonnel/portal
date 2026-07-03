export type SurveyStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "URGENT_REVIEW"
  | "SCHEDULING"
  | "SCHEDULED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED";

export type Asset = {
  id: number;
  project_id: number | null;
  code: string;
  title: string;
  address: string | null;
  created_at: string;
};

export type Survey = {
  id: number;
  asset_id: number;
  requester: string | null;     // <-- novo
  name: string;                 // você pode manter, mas vamos usar como "título" fixo
  notes: string | null;
  estimated_duration_minutes: number;
  urgent: boolean;
  needed_date: string | null; // yyyy-mm-dd
  status: SurveyStatus;
  created_at: string;
  updated_at: string;
  request_text?: string | null;

};

export type AssetDashboard = {
  asset_id: number;
  code: string;
  title: string;
  address: string | null;
  qty_completed: number;
  qty_in_progress: number;
  qty_open: number;
  qty_cancelled: number;
};
