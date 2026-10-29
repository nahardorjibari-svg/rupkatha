/**
 * Application Constants and Configuration
 * GarmentsERP - Knit & Woven Garments Factory Management System
 */

export const APP_CONFIG = {
  name: 'GarmentsERP',
  tagline: 'Manage your entire garments factory in one place',
  taglineBangla: 'আপনার সম্পূর্ণ গার্মেন্টস কারখানা এক জায়গায় পরিচালনা করুন',
  subheadline: 'Knit and Woven Unit Management',
  subheadlineBangla: 'নিট এবং উভেন ইউনিট ম্যানেজমেন্ট',
  copyright: '© 2026 GarmentsERP. All rights reserved.',
  copyrightBangla: '© ২০২৬ গার্মেন্টস ইআরপি। সর্বস্বত্ব সংরক্ষিত।',
  version: '1.0.0',
};

export const FACTORY_FEATURES = [
  {
    id: 'merchandising',
    title: 'Merchandising and Orders',
    banglaTitle: 'মার্চেন্ডাইজিং ও অর্ডার ট্র্যাকিং',
    description: 'Buyer inquiries, cost sheets, master tech-packs, BOM, time & action (T&A) calendars.',
    icon: 'Layers',
  },
  {
    id: 'production',
    title: 'Production and Cutting-Sewing',
    banglaTitle: 'প্রোডাকশন, কাটিং এবং সুইং',
    description: 'Cad marker planning, cutting lots, sewing line loading, hourly output & defect tracking.',
    icon: 'Scissors',
  },
  {
    id: 'store',
    title: 'Store and Inventory',
    banglaTitle: 'স্টোর ও ইনভেন্টরি ম্যানেজমেন্ট',
    description: 'Yarn, fabric roll barcode mapping, trims MRR, lot allocation & stock balancing.',
    icon: 'Package',
  },
  {
    id: 'commercial',
    title: 'Commercial and Accounts',
    banglaTitle: 'কমার্শিয়াল ও একাউন্টস',
    description: 'Back-to-back L/C management, export docs, costing variance & factory payroll.',
    icon: 'BadgeDollarSign',
  },
];

export type UserRole =
  | 'admin'
  | 'merchandiser'
  | 'production_manager'
  | 'store_keeper'
  | 'accounts'
  | 'hr'
  | 'commercial'
  | 'qc'
  | 'manager'
  | 'operator'
  | 'user';

export type FactoryUnit = 'all' | 'knit' | 'woven' | 'both';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  unit: FactoryUnit;
  is_active: boolean;
  permissions?: Record<string, boolean>;
  last_login?: string | null;
  employee_id?: string | null;
  designation?: string | null;
  joining_date?: string | null;
  department?: string | null;
  mobile?: string | null;
}

export const ROLE_LABELS: Record<UserRole, { en: string; bn: string }> = {
  admin: { en: 'System Administrator', bn: 'সিস্টেম অ্যাডমিনিস্ট্রেটর' },
  merchandiser: { en: 'Senior Merchandiser', bn: 'সিনিয়র মার্চেন্ডাইজার' },
  production_manager: { en: 'Production Manager', bn: 'প্রোডাকশন ম্যানেজার' },
  store_keeper: { en: 'Store In-Charge', bn: 'স্টোর ইন-চার্জ' },
  accounts: { en: 'Accounts Officer', bn: 'অ্যাকাউন্টস অফিসার' },
  hr: { en: 'HR & Compliance', bn: 'এইচআর ও কমপ্লায়েন্স' },
  commercial: { en: 'Commercial Manager', bn: 'কমার্শিয়াল ম্যানেজার' },
  qc: { en: 'Quality Assurance Head', bn: 'কিউএ হেড' },
  manager: { en: 'Manager', bn: 'ম্যানেজার' },
  operator: { en: 'Operator', bn: 'অপারেটর' },
  user: { en: 'General User', bn: 'ইউজার' },
};

export const UNIT_LABELS: Record<FactoryUnit, { en: string; bn: string }> = {
  all: { en: 'All Units (Composite)', bn: 'সকল ইউনিট (কম্পোজিট)' },
  knit: { en: 'Knit Division', bn: 'নিট ডিভিশন' },
  woven: { en: 'Woven Division', bn: 'উভেন ডিভিশন' },
  both: { en: 'Both Knit & Woven', bn: 'উভয় ইউনিট' },
};
