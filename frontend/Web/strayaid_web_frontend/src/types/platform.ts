export interface Organization {
  id: number;
  name: string;
  description: string;
  image?: string | null;
  latitude: number;
  longitude: number;
  address: string;
  city?: string;
  capacity?: number;
  radius?: number;
  phone_number: string;
  contact_email: string;
  bank_name?: string;
  bank_account_title?: string;
  bank_account_number?: string;
  tax_id?: string;
  payment_notes?: string;
  is_verified?: boolean;
  supply_goal_pkr?: number | null;
  is_available?: boolean;
  user?: number;
  user_email?: string;
  user_username?: string;
}

export interface DonationInfo {
  bank: string;
  account_name: string;
  account_number: string;
}

export interface AdoptionInfo {
  message: string;
  phone: string;
  email: string;
}

export interface Report {
  id: number;
  description: string;
  latitude: number;
  longitude: number;
  image: string;
  created_at: string;
  user_email?: string;
  user?: number;
  severity?: Severity;
  ai_animal_confidence?: number | null;
  ai_animal_label?: string;
  ai_box?: number[] | null;
}

export type Severity = "low" | "medium" | "high" | "critical";
export type CaseStatus = "reported" | "assigned" | "in_progress" | "rescued" | "adoption" | "closed";

export interface Case {
  id: number;
  description: string;
  latitude: number;
  longitude: number;
  status: string;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  organization: Organization | null;
  distance_km?: number | null;
  reports: Report[];
  reference?: string;
  status_label?: string;
  title?: string;
  species?: string;
  area?: string;
  severity?: Severity;
  confidence_score?: number | null;
  possibly_invalid?: boolean;
  reported_by?: number;
  assigned_to?: number | null;
  update_count?: number;
  ai_feedback_count?: number;
}

export interface Animal {
  id: number;
  name: string;
  species?: string;
  breed: string;
  gender?: string;
  age?: number | null;
  color?: string;
  microchip_id?: string;
  description: string;
  medical_info: string;
  donation_info: DonationInfo | null;
  adoption_info: AdoptionInfo | null;
  status: string;
  image: string | null;
  case: number;
  case_id: number;
  organization: Organization;
  created_at: string;
  health?: string;
  vaccinated?: boolean;
  photos?: string[];
  sponsor_count?: number;
  sponsor_goal?: number;
  application_count?: number;
  funding_goal_pkr?: number;
  raised_pkr?: number;
  sponsor_initials?: string[];
  ai_verified?: boolean;
  area?: string;
}

export type PostCategory = "medical" | "adoption" | "sponsorship" | "foster" | "";

export interface Post {
  id: number;
  title: string;
  content: string;
  category?: PostCategory;
  image: string | null;
  created_at: string;
  updated_at?: string;
  animal: Animal;
  organization: Organization;
  like_count?: number;
  comment_count?: number;
  liked_by_me?: boolean;
  saved_by_me?: boolean;
  share_count?: number;
}

export interface DashboardData {
  organization: Organization;
  summary: {
    total_cases: number;
    active_cases: number;
    rescued_cases: number;
    adoption_cases: number;
    animals_count: number;
    posts_count: number;
  };
  recent_cases: Case[];
  nearby_cases: Case[];
}
