export type EmployeeStatus = 'active' | 'inactive';

export interface Employee {
  id: string;
  businessId: string;
  name: string;
  email?: string;
  phone?: string;
  momoPhone?: string;
  grossSalary: number;
  currency: string;
  countryCode: string;
  cnssNumber?: string;
  employmentStartDate: string;
  status: EmployeeStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEmployeeInput {
  businessId: string;
  name: string;
  email?: string;
  phone?: string;
  momoPhone?: string;
  grossSalary: number;
  currency: string;
  countryCode: string;
  cnssNumber?: string;
  employmentStartDate: string;
}

export interface UpdateEmployeeInput {
  name?: string;
  email?: string;
  phone?: string;
  momoPhone?: string;
  grossSalary?: number;
  currency?: string;
  countryCode?: string;
  cnssNumber?: string;
  employmentStartDate?: string;
  status?: EmployeeStatus;
}
