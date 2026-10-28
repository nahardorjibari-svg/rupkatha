/**
 * Global Company and ERP Branding Configuration
 * Rupkatha Apparels Ltd. (src/config/company.ts)
 */

export interface CompanyConfig {
  name: string;
  shortName: string;
  tagline: string;
  taglineBangla: string;
  logoUrl?: string | null;
  primaryColor: string;
  secondaryColor: string;
  customerService: {
    email: string;
    phone: string;
    displayPhone: string;
    whatsapp: string;
  };
  corporateOffice: string;
  factory: string;
  footerText: string;
}

export const COMPANY_CONFIG: CompanyConfig = {
  name: 'Rupkatha Apparels Ltd.',
  shortName: 'Rupkatha',
  tagline: 'Leading the future of sustainable garments production',
  taglineBangla: 'টেকসই গার্মেন্টস উৎপাদনের ভবিষ্যৎ',
  logoUrl: null,
  primaryColor: '#0F8B8D',
  secondaryColor: '#2BA5B5',
  customerService: {
    email: 'info@rupkathaapparels.com',
    phone: '+8801795094961',
    displayPhone: '+880 1795 094961',
    whatsapp: '+8801795094961',
  },
  corporateOffice: 'Raj place, Rishipara, Padma mor, Hemayetpur, Dhaka, Bangladesh.',
  factory: 'Hemayetpur, Savar, Dhaka, Bangladesh.',
  footerText: '© 2026 Rupkatha Apparels Ltd. All rights reserved.',
};

export default COMPANY_CONFIG;
