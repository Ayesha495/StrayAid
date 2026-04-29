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
}

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
}

export interface Animal {
  id: number;
  name: string;
  breed: string;
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
}

export interface Post {
  id: number;
  title: string;
  content: string;
  image: string | null;
  created_at: string;
  animal: Animal;
  organization: Organization;
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
