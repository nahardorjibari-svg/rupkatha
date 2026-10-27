export interface CustomerServiceInfo {
  email: string;
  phone: string;
  displayPhone: string;
}

export interface CompanyConfig {
  name: string;
  shortName: string;
  tagline: string;
  taglineBangla: string;
  customerService: CustomerServiceInfo;
  corporateOffice: string;
  factory: string;
  footerText: string;
}

export declare const COMPANY_CONFIG: CompanyConfig;
export default COMPANY_CONFIG;
