export type PrintJobStatus =
  | 'pending_upload'
  | 'uploaded'
  | 'cost_estimated'
  | 'awaiting_payment'
  | 'awaiting_approval'
  | 'approved'
  | 'printing'
  | 'completed'
  | 'rejected'
  | 'failed';

export interface Filament {
  id: string;
  name: string;
  material: string;
  color: string;
  available: boolean;
}

export interface Printer {
  id: string;
  name: string;
  model?: string;
  status: 'idle' | 'printing' | 'maintenance' | 'offline';
}

export interface PrintJob {
  id: string;
  user_id: string;
  filename: string;
  file_path?: string;
  filament_id?: string;
  printer_id?: string;
  status: PrintJobStatus;
  estimated_grams?: number;
  estimated_duration_minutes?: number;
  estimated_cost?: number;
  review_note?: string;
  print_started_at?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
  filament?: Filament;
  printer?: Printer;
}

export const STATUS_COLORS: Record<PrintJobStatus, string> = {
  pending_upload: '#94a3b8',
  uploaded: '#60a5fa',
  cost_estimated: '#f59e0b',
  awaiting_payment: '#f97316',
  awaiting_approval: '#a78bfa',
  approved: '#34d399',
  printing: '#3b82f6',
  completed: '#22c55e',
  rejected: '#ef4444',
  failed: '#ef4444',
};

export const STATUS_LABELS: Record<PrintJobStatus, string> = {
  pending_upload: 'Pending Upload',
  uploaded: 'Processing',
  cost_estimated: 'Cost Ready',
  awaiting_payment: 'Awaiting Payment',
  awaiting_approval: 'Under Review',
  approved: 'Approved',
  printing: 'Printing',
  completed: 'Completed',
  rejected: 'Rejected',
  failed: 'Failed',
};

// Ordered happy-path steps for the stepper
export const STATUS_STEPS: PrintJobStatus[] = [
  'pending_upload',
  'uploaded',
  'cost_estimated',
  'awaiting_payment',
  'awaiting_approval',
  'approved',
  'printing',
  'completed',
];
