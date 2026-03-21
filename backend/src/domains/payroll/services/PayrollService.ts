import { Injectable, Inject, Optional } from '@nestjs/common';
import { EmployeeRepository } from '../repositories/EmployeeRepository';
import { PayRunRepository } from '../repositories/PayRunRepository';
import { PayRunLineRepository } from '../repositories/PayRunLineRepository';
import { PayrollTaxEngineManager } from '../providers/PayrollTaxEngineManager';
import { BusinessRepository } from '@/domains/business/BusinessRepository';
import { LedgerService } from '@/domains/ledger/services/LedgerService';
import { PaymentsClient } from '@/domains/payments/services/PaymentsClient';
import { IAuditLogger } from '@/domains/audit/interfaces/IAuditLogger';
import { AUDIT_LOGGER } from '@/domains/audit/AuditModule';
import { NotFoundError, ValidationError } from '@/shared/errors/DomainError';
import type { Employee, CreateEmployeeInput, UpdateEmployeeInput } from '../models/Employee';
import type { PayRun } from '../models/PayRun';
import type { PayRunLine } from '../models/PayRunLine';
import { v4 as uuidv4 } from 'uuid';

export interface PayPayRunResult {
  payRun: PayRun;
  failedLines: PayRunLine[];
}

@Injectable()
export class PayrollService {
  constructor(
    private readonly employeeRepo: EmployeeRepository,
    private readonly payRunRepo: PayRunRepository,
    private readonly payRunLineRepo: PayRunLineRepository,
    private readonly taxEngineManager: PayrollTaxEngineManager,
    private readonly businessRepo: BusinessRepository,
    private readonly ledgerService: LedgerService,
    private readonly paymentsClient: PaymentsClient,
    @Optional() @Inject(AUDIT_LOGGER) private readonly auditLogger?: IAuditLogger,
  ) {}

  async createEmployee(input: CreateEmployeeInput, userId?: string): Promise<Employee> {
    if (!input.businessId?.trim()) throw new ValidationError('businessId is required');
    if (!input.name?.trim()) throw new ValidationError('name is required');
    if (input.grossSalary < 0) throw new ValidationError('grossSalary must be >= 0');
    const employee = await this.employeeRepo.create(input);
    if (this.auditLogger && userId) {
      this.auditLogger.log({
        entityType: 'payroll.employee',
        entityId: employee.id,
        businessId: employee.businessId,
        action: 'payroll.employee.create',
        userId,
      }).catch(() => {});
    }
    return employee;
  }

  async updateEmployee(businessId: string, id: string, input: UpdateEmployeeInput): Promise<Employee> {
    const existing = await this.employeeRepo.findById(businessId, id);
    if (!existing) throw new NotFoundError('Employee', id);
    const updated = { ...existing, ...input };
    return this.employeeRepo.update(updated);
  }

  async getEmployee(businessId: string, id: string): Promise<Employee | null> {
    return this.employeeRepo.findById(businessId, id);
  }

  async listEmployees(businessId: string, status?: 'active' | 'inactive'): Promise<Employee[]> {
    return this.employeeRepo.listByBusiness(businessId, status);
  }

  async createPayRun(businessId: string, periodMonth: string, userId?: string): Promise<PayRun> {
    const business = await this.businessRepo.getById(businessId);
    if (!business) throw new NotFoundError('Business', businessId);

    const existing = await this.payRunRepo.findByPeriod(businessId, periodMonth);
    if (existing) throw new ValidationError(`Pay run already exists for ${periodMonth}`);

    const employees = await this.employeeRepo.listByBusiness(businessId, 'active');
    if (employees.length === 0) throw new ValidationError('No active employees');

    const currency = business.currency ?? 'XOF';
    const countryCode = business.countryCode ?? 'BJ';
    const engine = this.taxEngineManager.getEngine(countryCode);

    const now = new Date().toISOString();
    const payRunId = uuidv4();
    const payRun: PayRun = {
      id: payRunId,
      businessId,
      periodMonth,
      status: 'draft',
      totalGross: 0,
      totalNet: 0,
      totalEmployerContributions: 0,
      totalEmployeeDeductions: 0,
      totalIncomeTax: 0,
      currency,
      createdAt: now,
    };

    const lineItems: Record<string, unknown>[] = [];
    let totalGross = 0;
    let totalNet = 0;
    let totalEmployerContrib = 0;
    let totalEmployeeDeductions = 0;
    let totalIr = 0;

    for (const emp of employees) {
      const calc = engine.calculate(emp, emp.grossSalary, currency);
      const line: PayRunLine = {
        id: uuidv4(),
        payRunId,
        businessId,
        employeeId: emp.id,
        grossSalary: calc.grossSalary,
        employeeContributions: calc.employeeContributions,
        employerContributions: calc.employerContributions,
        incomeTax: calc.incomeTax,
        deductionsBreakdown: calc.deductionsBreakdown,
        netPay: calc.netPay,
        paymentStatus: 'pending',
        createdAt: now,
      };
      lineItems.push(this.payRunLineRepo.buildDynamoItem(line));
      totalGross += calc.grossSalary;
      totalNet += calc.netPay;
      totalEmployerContrib += calc.employerContributions;
      totalEmployeeDeductions += calc.employeeContributions + calc.incomeTax;
      totalIr += calc.incomeTax;
    }

    payRun.totalGross = totalGross;
    payRun.totalNet = totalNet;
    payRun.totalEmployerContributions = totalEmployerContrib;
    payRun.totalEmployeeDeductions = totalEmployeeDeductions;
    payRun.totalIncomeTax = totalIr;

    await this.payRunRepo.createWithLines(payRun, lineItems);

    if (this.auditLogger && userId) {
      this.auditLogger.log({
        entityType: 'payroll.pay_run',
        entityId: payRun.id,
        businessId,
        action: 'payroll.pay_run.create',
        userId,
        metadata: { periodMonth },
      }).catch(() => {});
    }

    return payRun;
  }

  async finalizePayRun(businessId: string, payRunId: string, userId?: string): Promise<PayRun> {
    const payRun = await this.payRunRepo.findById(businessId, payRunId);
    if (!payRun) throw new NotFoundError('PayRun', payRunId);
    if (payRun.status !== 'draft') throw new ValidationError(`Pay run is not draft (status: ${payRun.status})`);

    const lines = await this.payRunLineRepo.listByPayRun(businessId, payRunId);
    const date = `${payRun.periodMonth}-15`;
    const ledgerEntryIds: string[] = [];

    const salEntry = await this.ledgerService.createEntry(
      {
        businessId,
        type: 'expense',
        amount: payRun.totalNet,
        currency: payRun.currency,
        description: `Salaires ${payRun.periodMonth}`,
        category: 'Salaries',
        date,
        skipLimitCheck: true,
      },
      undefined,
    );
    ledgerEntryIds.push(salEntry.id);

    if (payRun.totalEmployerContributions > 0) {
      const contribEntry = await this.ledgerService.createEntry(
        {
          businessId,
          type: 'expense',
          amount: payRun.totalEmployerContributions,
          currency: payRun.currency,
          description: `Cotisations patronales ${payRun.periodMonth}`,
          category: 'Salaries_Employer_Contributions',
          date,
          skipLimitCheck: true,
        },
        undefined,
      );
      ledgerEntryIds.push(contribEntry.id);
    }

    payRun.status = 'finalized';
    payRun.finalizedAt = new Date().toISOString();
    payRun.ledgerEntryIds = ledgerEntryIds;
    await this.payRunRepo.update(payRun);

    if (this.auditLogger && userId) {
      this.auditLogger.log({
        entityType: 'payroll.pay_run',
        entityId: payRunId,
        businessId,
        action: 'payroll.pay_run.finalize',
        userId,
      }).catch(() => {});
    }

    return payRun;
  }

  async payPayRun(businessId: string, payRunId: string, userId?: string): Promise<PayPayRunResult> {
    const payRun = await this.payRunRepo.findById(businessId, payRunId);
    if (!payRun) throw new NotFoundError('PayRun', payRunId);
    if (payRun.status !== 'finalized') throw new ValidationError(`Pay run must be finalized (status: ${payRun.status})`);

    const business = await this.businessRepo.getById(businessId);
    const country = business?.countryCode ?? 'BJ';

    const lines = await this.payRunLineRepo.listByPayRun(businessId, payRunId);
    const employees = await Promise.all(
      lines.map((l) => this.employeeRepo.findById(businessId, l.employeeId)),
    );

    const failedLines: PayRunLine[] = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const emp = employees[i];
      const phone = emp?.momoPhone ?? emp?.phone;
      if (!phone || line.netPay <= 0) continue;

      const result = await this.paymentsClient.disburse({
        phone,
        amount: line.netPay,
        currency: payRun.currency,
        externalId: `payroll-${payRunId}-${line.employeeId}`,
        referenceId: payRunId,
        country,
      });
      if (result.success) {
        await this.payRunLineRepo.updatePaymentStatus(businessId, payRunId, line.employeeId, 'paid');
      } else {
        await this.payRunLineRepo.updatePaymentStatus(businessId, payRunId, line.employeeId, 'failed');
        failedLines.push({ ...line, paymentStatus: 'failed' });
      }
    }

    if (failedLines.length === 0) {
      payRun.status = 'paid';
      payRun.paidAt = new Date().toISOString();
      await this.payRunRepo.update(payRun);
      if (this.auditLogger && userId) {
        this.auditLogger.log({
          entityType: 'payroll.pay_run',
          entityId: payRunId,
          businessId,
          action: 'payroll.pay_run.pay',
          userId,
        }).catch(() => {});
      }
    }

    return { payRun, failedLines };
  }

  async getPayRun(businessId: string, payRunId: string): Promise<PayRun | null> {
    return this.payRunRepo.findById(businessId, payRunId);
  }

  async listPayRuns(businessId: string, from?: string, to?: string): Promise<PayRun[]> {
    const { items } = await this.payRunRepo.listByBusiness(businessId, from, to);
    return items;
  }

  async listPayRunLines(businessId: string, payRunId: string): Promise<PayRunLine[]> {
    return this.payRunLineRepo.listByPayRun(businessId, payRunId);
  }
}
