import { Injectable } from '@nestjs/common';
import { PayRunRepository } from '../repositories/PayRunRepository';
import { PayRunLineRepository } from '../repositories/PayRunLineRepository';

export interface AnnualSummary {
  year: number;
  totalGross: number;
  totalNet: number;
  totalEmployerContributions: number;
  totalEmployeeDeductions: number;
  totalIncomeTax: number;
  payRunCount: number;
  employeeCount: number;
  perEmployee: { employeeId: string; totalGross: number; totalNet: number }[];
}

@Injectable()
export class PayrollReportService {
  constructor(
    private readonly payRunRepo: PayRunRepository,
    private readonly payRunLineRepo: PayRunLineRepository,
  ) {}

  async getAnnualSummary(businessId: string, year: number): Promise<AnnualSummary> {
    const from = `${year}-01`;
    const to = `${year}-12`;
    const { items: payRuns } = await this.payRunRepo.listByBusiness(businessId, from, to, 500);

    const payRunsInYear = payRuns.filter((pr) => {
      const y = parseInt(pr.periodMonth.slice(0, 4), 10);
      return y === year;
    });

    const employeeTotals = new Map<string, { gross: number; net: number }>();

    let totalGross = 0;
    let totalNet = 0;
    let totalEmployerContrib = 0;
    let totalEmployeeDeductions = 0;
    let totalIr = 0;

    for (const pr of payRunsInYear) {
      totalGross += pr.totalGross;
      totalNet += pr.totalNet;
      totalEmployerContrib += pr.totalEmployerContributions;
      totalEmployeeDeductions += pr.totalEmployeeDeductions;
      totalIr += pr.totalIncomeTax;

      const lines = await this.payRunLineRepo.listByPayRun(businessId, pr.id);
      for (const line of lines) {
        const existing = employeeTotals.get(line.employeeId) ?? { gross: 0, net: 0 };
        existing.gross += line.grossSalary;
        existing.net += line.netPay;
        employeeTotals.set(line.employeeId, existing);
      }
    }

    const perEmployee = Array.from(employeeTotals.entries()).map(([employeeId, t]) => ({
      employeeId,
      totalGross: t.gross,
      totalNet: t.net,
    }));

    return {
      year,
      totalGross,
      totalNet,
      totalEmployerContributions: totalEmployerContrib,
      totalEmployeeDeductions,
      totalIncomeTax: totalIr,
      payRunCount: payRunsInYear.length,
      employeeCount: employeeTotals.size,
      perEmployee,
    };
  }
}
