export type ProjectStatus = 'planning' | 'active' | 'on_hold' | 'completed' | 'cancelled'
export type BlockStatus   = 'not_started' | 'in_progress' | 'completed' | 'on_hold'
export type RequestStatus = 'draft' | 'pending' | 'otp_sent' | 'approved' | 'rejected' | 'fulfilled' | 'cancelled'
export type RequestPriority = 'low' | 'standard' | 'high' | 'urgent'
export type WeeklyBillStatus = 'draft' | 'submitted' | 'approved' | 'invoiced'
export type ActivityType = 'work_log' | 'expense' | 'inspection' | 'milestone' | 'issue' | 'note'

export interface Project {
  id: number
  name: string
  code: string
  description: string | null
  status: ProjectStatus
  state: string | null
  district: string | null
  zone: string | null
  address: string | null
  contract_value: number | null
  target_completion_date: string | null
  overall_progress: number
  tags: string[]
}

export interface ProjectPlan {
  id: number
  project_id: number
  plan_code: string
  name: string
  description: string | null
  is_active: boolean
  revision: number
  blocks: Block[]
}

export interface Block {
  id: number
  plan_id: number
  block_code: string
  name: string
  description: string | null
  status: BlockStatus
  start_date: string | null
  end_date: string | null
  planned_quantity: number | null
  actual_quantity: number | null
  unit_of_measure: string | null
  progress: number
  estimated_cost: number | null
  actual_cost: number | null
}

export interface RequestItem {
  id: number
  material_id: number | null
  material_name: string
  requested_qty: number
  approved_qty: number | null
  issued_qty: number | null
  unit_of_measure: string
  notes: string | null
}

export interface MaterialRequest {
  id: number
  project_id: number
  block_id: number | null
  requested_by_id: number | null
  status: RequestStatus
  priority: RequestPriority
  title: string
  notes: string | null
  required_by: string | null
  stack_position: number
  approved_by_id: number | null
  approved_at: string | null
  rejection_reason: string | null
  items: RequestItem[]
}

export interface StockEntry {
  id: number
  material_id: number
  project_id: number
  block_id: number | null
  location_label: string | null
  quantity: number
  reserved_qty: number
  available_qty: number
  batch_number: string | null
  expiry_date: string | null
}

export interface DailyActivity {
  id: number
  block_id: number
  logged_by_id: number | null
  activity_date: string
  activity_type: ActivityType
  title: string
  description: string | null
  hours_worked: number | null
  quantity: number | null
  amount: number | null
  is_billable: boolean
  attachments: string[]
}

export interface WeeklyBill {
  id: number
  block_id: number
  week_start_date: string
  week_end_date: string
  bill_number: string
  status: WeeklyBillStatus
  labour_cost: number
  material_cost: number
  overhead_cost: number
  total_cost: number
  progress_this_week: number
  cumulative_progress: number
  line_items: Record<string, unknown>[]
  notes: string | null
}
