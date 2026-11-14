export type BatchStatus = 'pending' | 'in_transit' | 'completed' | 'disputed';

export interface Supplier {
  id: string;
  name: string;
  contact_person: string;
  phone: string;
  created_at: string;
}

export interface Batch {
  id: string;
  supplier_id: string;
  unit_quantity: number;
  unit_cost_price: number;
  unit_selling_price: number;
  fuel_subsidy_per_unit: number;
  total_capital: number;
  total_revenue: number;
  net_investor_credit: number;
  destination_route: string;
  vehicle_reference: string;
  driver_name: string;
  driver_phone: string;
  status: BatchStatus;
  dispatched_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface ManagerProfile {
  id: string;
  email: string;
  full_name: string;
  role: 'admin' | 'manager';
  supplier_id: string | null;
}

export interface WeeklySummary {
  week_start: string;
  completed_batches: number;
  gross_sales_value: number;
  net_credit_due: number;
}

export interface AdminSettlement {
  week_start: string;
  supplier_id: string;
  supplier_name: string;
  completed_batches: number;
  deployed_capital: number;
  gross_sales_value: number;
  fuel_allowance: number;
  net_investor_credit: number;
}
