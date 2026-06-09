export type MeasurementStandard = "POMI" | "NRM2" | "NRM1" | "Custom";
export type ProjectStatus =
  | "setup"
  | "documents_uploaded"
  | "processing"
  | "ready_for_generation"
  | "ready_for_review"
  | "exported";
export type ProjectRole = "owner" | "editor" | "reviewer";
export type ReviewStatus =
  | "draft"
  | "needs_review"
  | "approved"
  | "rejected"
  | "revised";
export type JobStatus = "queued" | "running" | "completed" | "failed";
export type QueryStatus = "open" | "answered" | "closed";
export type UnitCode = string;

export type AppUser = {
  id: string;
  clerk_user_id: string;
  email: string;
  name: string | null;
};

export type ProjectRow = {
  id: string;
  name: string;
  client_name: string;
  project_type: string;
  scope: string;
  measurement_standard: MeasurementStandard;
  status: ProjectStatus;
  confidence_threshold: number;
  deleted_at?: string | null;
  created_at: string;
  updated_at: string;
  role?: ProjectRole;
  file_count?: number;
  item_count?: number;
};

export type GenerationStatus =
  | "draft"
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "exported";

export type BoqGenerationRow = {
  id: string;
  project_id: string;
  label: string;
  measurement_standard: MeasurementStandard;
  template_id: string | null;
  status: GenerationStatus;
  quality_mode: "economy" | "balanced" | "premium";
  source_file_ids: string[];
  item_count: number;
  query_count: number;
  assumption_count: number;
  estimated_cost_usd: string | number;
  created_by: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AgentLogStatus =
  | "waiting"
  | "running"
  | "completed"
  | "skipped"
  | "failed";

export type BoqGenerationAgentLogRow = {
  id: string;
  generation_id: string;
  project_id: string;
  agent_id: string;
  agent_label: string;
  scope: string | null;
  section_code: string | null;
  status: AgentLogStatus;
  progress: number;
  status_text: string | null;
  model_name: string | null;
  items_count: number;
  queries_count: number;
  assumptions_count: number;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type BoqGenerationExportRow = {
  id: string;
  generation_id: string;
  project_id: string;
  file_name: string;
  storage_url: string | null;
  format: string;
  item_count: number;
  created_by: string | null;
  created_at: string;
};

export type AppKnowledgeStatus = "active" | "approved" | "disabled";

export type AppKnowledgeRow = {
  id: string;
  agent_id: string;
  scope: string;
  measurement_standard: string | null;
  section_code: string | null;
  upload_id: string | null;
  source_file_name: string | null;
  description_patterns: string | null;
  item_wording_patterns: string | null;
  trade_section_structure: string | null;
  heading_structure: string | null;
  numbering_style: string | null;
  unit_usage_patterns: string | null;
  measurement_standard_usage: string | null;
  scope_description_patterns: string | null;
  inclusions: string | null;
  exclusions: string | null;
  summary_structure: string | null;
  collection_structure: string | null;
  cover_page_style: string | null;
  excel_formatting_style: string | null;
  column_structure: string | null;
  client_company_style: string | null;
  sample_items: Array<{
    item_no?: string;
    description?: string;
    unit?: string;
    section?: string;
  }>;
  detected_units: string[];
  raw_analysis: Record<string, unknown>;
  confidence_score: number;
  status: AppKnowledgeStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type PreviousBoqUploadRow = {
  id: string;
  origin_project_id: string | null;
  file_id: string | null;
  uploaded_by: string | null;
  file_name: string;
  storage_url: string | null;
  measurement_standard: string | null;
  status: "uploaded" | "analyzing" | "analyzed" | "failed";
  created_at: string;
  updated_at: string;
};

export type ProjectFileRow = {
  id: string;
  project_id: string;
  uploaded_by: string | null;
  file_name: string;
  file_type: string;
  mime_type: string | null;
  size_bytes: number;
  storage_url: string;
  document_type: string | null;
  scope: string | null;
  classification_confidence: number | null;
  status: string;
  created_at: string;
};

export type BoqTemplateProfileRow = {
  id: string;
  name: string;
  description: string | null;
  header_aliases: Record<string, string[]>;
  detection_rules: Record<string, unknown>;
  column_mapping: Record<string, unknown>;
  item_style_notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type BoqTemplateRow = {
  id: string;
  project_id: string;
  file_id: string | null;
  profile_id: string | null;
  template_name: string | null;
  template_kind: string;
  sheet_name: string | null;
  header_row: number | null;
  description_column: string | null;
  unit_column: string | null;
  quantity_column: string | null;
  rate_column: string | null;
  amount_column: string | null;
  numbering_style: string | null;
  parsed_structure: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type BoqKnowledgeRow = {
  id: string;
  project_id: string;
  file_id: string | null;
  source_file_name: string | null;
  measurement_standard: string | null;
  description_patterns: string | null;
  item_wording_patterns: string | null;
  trade_section_structure: string | null;
  heading_structure: string | null;
  numbering_style: string | null;
  unit_usage_patterns: string | null;
  measurement_standard_usage: string | null;
  inclusions: string | null;
  exclusions: string | null;
  formatting_style: string | null;
  summary_structure: string | null;
  sample_items: Array<{
    item_no?: string;
    description?: string;
    unit?: string;
    section?: string;
  }>;
  detected_units: string[];
  raw_analysis: Record<string, unknown>;
  status: "pending" | "analyzing" | "analyzed" | "failed";
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

export type BoqRuleRow = {
  id: string;
  measurement_standard: MeasurementStandard;
  section_code: string | null;
  scope: string;
  trade: string;
  item_type: string;
  unit: UnitCode;
  description_rule: string;
  inclusions: string | null;
  exclusions: string | null;
  verified_by_qs: boolean;
  created_at: string;
  updated_at: string;
};

export type BoqItemRow = {
  id: string;
  project_id: string;
  item_no: string | null;
  section: string;
  trade: string;
  item_type: string;
  description: string;
  unit: UnitCode;
  quantity: null;
  rate: null;
  amount: null;
  source_reference: string | null;
  confidence_score: number;
  review_status: ReviewStatus;
  ai_generated: boolean;
  duplicate_group: string | null;
  created_at: string;
  updated_at: string;
};

export type BoqQueryRow = {
  id: string;
  project_id: string;
  boq_item_id: string | null;
  issue: string;
  clarification_needed: string;
  source_reference: string | null;
  status: QueryStatus;
  created_at: string;
  updated_at: string;
};

export type BoqAssumptionRow = {
  id: string;
  project_id: string;
  boq_item_id: string | null;
  assumption: string;
  source_reference: string | null;
  created_at: string;
};

export type AgentJobRow = {
  id: string;
  project_id: string;
  job_type: string;
  status: JobStatus;
  progress: number;
  current_step: string | null;
  message: string | null;
  estimated_cost_usd: string | null;
  created_at: string;
  updated_at: string;
};
