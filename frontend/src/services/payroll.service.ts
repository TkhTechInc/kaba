import { api } from "@/lib/api-client";

const withToken = (token: string | null) => ({ token: token ?? undefined });

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
  status: "active" | "inactive";
  createdAt: string;
  updatedAt: string;
}

export interface PayRun {
  id: string;
  businessId: string;
  periodMonth: string;
  status: "draft" | "finalized" | "paid";
  totalGross: number;
  totalNet: number;
  totalEmployerContributions: number;
  totalEmployeeDeductions: number;
  totalIncomeTax: number;
  currency: string;
  finalizedAt?: string;
  paidAt?: string;
  createdAt: string;
}

export interface PayRunLine {
  id: string;
  employeeId: string;
  grossSalary: number;
  employeeContributions: number;
  employerContributions: number;
  incomeTax: number;
  netPay: number;
}

export interface CreateEmployeeInput {
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
  status?: "active" | "inactive";
}

export function createPayrollApi(token: string | null) {
  const opts = withToken(token);

  return {
    async listEmployees(businessId: string, status?: "active" | "inactive") {
      const params = new URLSearchParams({ businessId });
      if (status) params.set("status", status);
      return api.get<Employee[]>(
        `/api/v1/payroll/employees?${params}`,
        opts
      );
    },
    async getEmployee(businessId: string, id: string) {
      return api.get<Employee | null>(
        `/api/v1/payroll/employees/${id}?businessId=${businessId}`,
        opts
      );
    },
    async createEmployee(businessId: string, input: CreateEmployeeInput) {
      return api.post<Employee>(
        `/api/v1/payroll/employees?businessId=${businessId}`,
        input,
        opts
      );
    },
    async updateEmployee(businessId: string, id: string, input: UpdateEmployeeInput) {
      return api.patch<Employee>(
        `/api/v1/payroll/employees/${id}?businessId=${businessId}`,
        input,
        opts
      );
    },
    async listPayRuns(businessId: string, from?: string, to?: string) {
      const params = new URLSearchParams({ businessId });
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      return api.get<PayRun[]>(
        `/api/v1/payroll/pay-runs?${params}`,
        opts
      );
    },
    async getPayRun(businessId: string, id: string) {
      return api.get<PayRun | null>(
        `/api/v1/payroll/pay-runs/${id}?businessId=${businessId}`,
        opts
      );
    },
    async createPayRun(businessId: string, periodMonth: string) {
      return api.post<PayRun>(
        `/api/v1/payroll/pay-runs?businessId=${businessId}`,
        { periodMonth },
        opts
      );
    },
    async finalizePayRun(businessId: string, id: string) {
      return api.post<PayRun>(
        `/api/v1/payroll/pay-runs/${id}/finalize?businessId=${businessId}`,
        {},
        opts
      );
    },
    async payPayRun(businessId: string, id: string) {
      return api.post<PayRun>(
        `/api/v1/payroll/pay-runs/${id}/pay?businessId=${businessId}`,
        {},
        opts
      );
    },
    async listPayRunLines(businessId: string, payRunId: string) {
      return api.get<PayRunLine[]>(
        `/api/v1/payroll/pay-runs/${payRunId}/lines?businessId=${businessId}`,
        opts
      );
    },
    async getAnnualSummary(businessId: string, year: number) {
      return api.get<{ year: number; totalGross: number; totalNet: number; payRunCount: number; employeeCount: number }>(
        `/api/v1/payroll/annual-summary?businessId=${businessId}&year=${year}`,
        opts
      );
    },
  };
}
