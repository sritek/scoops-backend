/**
 * Fee Service
 *
 * This module has been consolidated to use the advanced fee system.
 * Legacy functions (getFeePlans, createFeePlan, getPendingFees, assignFee, recordPayment)
 * have been removed in favor of:
 * - fee-components.service.ts - Fee component management
 * - batch-fee-structure.service.ts - Batch fee structure management
 * - student-fee-structure.service.ts - Student fee structure management
 * - installments.service.ts - Installment and payment management
 *
 * See the design document at .kiro/specs/fee-module-consolidation/design.md for details.
 */

// This file is intentionally minimal after the fee module consolidation.
// All fee-related functionality is now handled by the specialized services:
// - FeeComponent: fee-components.service.ts
// - BatchFeeStructure: batch-fee-structure.service.ts
// - StudentFeeStructure: student-fee-structure.service.ts
// - FeeInstallment & InstallmentPayment: installments.service.ts (in installments module)
// - Receipt: receipt.service.ts
