/**
 * System Modules Configuration & Permissions
 * Rupkatha Apparels Ltd. (src/config/modules.ts)
 */

export interface ModuleItem {
  id: string;
  name: string;
  nameBangla: string;
  path: string;
  icon: string;
  badge?: string | null;
  description: string;
  status: 'active' | 'coming_soon';
  isTickable?: boolean;
  isAdminOnly?: boolean;
  children?: ModuleItem[];
}

export interface ModuleGroup {
  group: string;
  groupBangla: string;
  items: ModuleItem[];
}

export const ERP_MODULES: ModuleGroup[] = [
  // 1. Core Administrative Modules (Active)
  {
    group: 'Main',
    groupBangla: 'মূল মেন্যু',
    items: [
      {
        id: 'dashboard',
        name: 'Dashboard',
        nameBangla: 'ড্যাশবোর্ড',
        path: '/admin',
        icon: 'LayoutDashboard',
        badge: null,
        description: 'System overview, active users, and quick KPIs',
        status: 'active',
        isTickable: false,
      },
      {
        id: 'users',
        name: 'Users & Permissions',
        nameBangla: 'ইউজার ও এক্সেস',
        path: '/admin/users',
        icon: 'Users',
        badge: null,
        description: 'Manage staff profiles, departmental roles, and access status',
        status: 'active',
        isAdminOnly: true,
      },
      {
        id: 'settings',
        name: 'Settings',
        nameBangla: 'সিস্টেম সেটিংস',
        path: '/admin/settings',
        icon: 'Sliders',
        badge: null,
        description: 'Company logo, brand naming, and ERP defaults',
        status: 'active',
        isAdminOnly: true,
      },
    ],
  },

  // 2. Planning & Production
  {
    group: 'Planning & Production',
    groupBangla: 'পরিকল্পনা ও উৎপাদন',
    items: [
      {
        id: 'merchandising',
        name: 'Line Plan',
        nameBangla: 'লাইন পরিকল্পনা',
        path: '/planning/lineplan',
        icon: 'CalendarDays',
        badge: null,
        description: '30-day rolling line plan and daily production tracking',
        status: 'active',
        isTickable: true,
      },
    ],
  },

  // 3. Apparel Production & Commercial Modules (Coming Soon / Permission-governed)
  {
    group: 'Garments Production Suite',
    groupBangla: 'গার্মেন্টস প্রোডাকশন স্যুট',
    items: [
      {
        id: 'sampling',
        name: 'Sampling',
        nameBangla: 'স্যাম্পলিং',
        path: '/admin/sampling',
        icon: 'Sparkles',
        badge: 'Soon',
        description: 'Proto, fit, size set, salesman, and pre-production sample approvals',
        status: 'coming_soon',
        isTickable: true,
      },
      {
        id: 'fabric_yarn',
        name: 'Fabric and Yarn',
        nameBangla: 'ফেব্রিক ও সুতা',
        path: '/admin/fabric-yarn',
        icon: 'Shirt',
        badge: 'Soon',
        description: 'Yarn requisition, knitting programs, dyeing lots, and GSM quality lab testing',
        status: 'coming_soon',
        isTickable: true,
      },
      {
        id: 'cutting',
        name: 'Cutting',
        nameBangla: 'কাটিং বিভাগ',
        path: '/admin/cutting',
        icon: 'Scissors',
        badge: 'Soon',
        description: 'CAD marker planning, lay sheet recording, bundle ticket tagging, and cut output',
        status: 'coming_soon',
        isTickable: true,
      },
      {
        id: 'sewing',
        name: 'Sewing Production',
        nameBangla: 'সুইং প্রোডাকশন',
        path: '/sewing/report',
        icon: 'Cog',
        badge: null,
        description: 'Hourly production reports, live dashboard, and export register',
        status: 'active',
        isTickable: true,
        children: [
          {
            id: 'sewing_report_entry',
            name: 'Hourly Production Report',
            nameBangla: 'ঘণ্টাভিত্তিক প্রোডাকশন রিপোর্ট',
            path: '/sewing/report',
            icon: 'FileText',
            description: 'Excel-like hourly production entry register',
            status: 'active',
          },
          {
            id: 'sewing_dashboard',
            name: 'Dashboard',
            nameBangla: 'ড্যাশবোর্ড',
            path: '/sewing/dashboard',
            icon: 'LayoutDashboard',
            description: 'Live hourly Q.C.P board and KPIs',
            status: 'active',
          },
          {
            id: 'sewing_reports',
            name: 'Reports and Export',
            nameBangla: 'রিপোর্ট ও এক্সপোর্ট',
            path: '/sewing/reports',
            icon: 'FileSpreadsheet',
            description: 'Excel and PDF download and print view',
            status: 'active',
          },
        ],
      },
      {
        id: 'line_dashboard',
        name: 'Line Dashboard',
        nameBangla: 'লাইন ড্যাশবোর্ড',
        path: '/linedash/all',
        icon: 'Tv',
        badge: null,
        description: 'Live enterprise TV production boards for Lines 1 to 4',
        status: 'active',
        isTickable: false,
        children: [
          {
            id: 'linedash_all',
            name: 'All Lines',
            nameBangla: 'সব লাইন',
            path: '/linedash/all',
            icon: 'Tv',
            description: '2x2 factory TV overview of Lines 1 to 4',
            status: 'active',
          },
          {
            id: 'linedash_1',
            name: 'Line 1',
            nameBangla: 'লাইন ০১',
            path: '/linedash/1',
            icon: 'Tv',
            description: 'Live TV production board for Line 01',
            status: 'active',
          },
          {
            id: 'linedash_2',
            name: 'Line 2',
            nameBangla: 'লাইন ০২',
            path: '/linedash/2',
            icon: 'Tv',
            description: 'Live TV production board for Line 02',
            status: 'active',
          },
          {
            id: 'linedash_3',
            name: 'Line 3',
            nameBangla: 'লাইন ০৩',
            path: '/linedash/3',
            icon: 'Tv',
            description: 'Live TV production board for Line 03',
            status: 'active',
          },
          {
            id: 'linedash_4',
            name: 'Line 4',
            nameBangla: 'লাইন ০৪',
            path: '/linedash/4',
            icon: 'Tv',
            description: 'Live TV production board for Line 04',
            status: 'active',
          },
        ],
      },
      {
        id: 'washing_print_emb',
        name: 'Washing/Print/Emb',
        nameBangla: 'ওয়াশিং, প্রিন্ট ও এমব্রয়ডারি',
        path: '/admin/washing',
        icon: 'Palette',
        badge: 'Soon',
        description: 'Washing recipes, screen printing panels, embroidery lot tracking, and returns',
        status: 'coming_soon',
        isTickable: true,
      },
      // Finishing is now merged into Sewing, but we can keep it as a placeholder if requested
      // {
      //   id: 'finishing',
      //   name: 'Finishing',
      //   nameBangla: 'ফিনিশিং ও প্যাকিং',
      //   path: '/admin/finishing',
      //   icon: 'PackageCheck',
      //   badge: 'Soon',
      //   description: 'Ironing, folding, polying, carton packing lists, and carton CBM calculation',
      //   status: 'coming_soon',
      //   isTickable: true,
      // },
      {
        id: 'store_inventory',
        name: 'Store and Inventory',
        nameBangla: 'স্টোর ও ইনভেন্টরি',
        path: '/store/dashboard',
        icon: 'Warehouse',
        badge: null,
        description: 'Yarn, grey fabric, trims, accessories MRR, bin cards, and stock balance',
        status: 'active',
        isTickable: true,
        children: [
          {
            id: 'store_dashboard',
            name: 'Overview',
            nameBangla: 'ওভারভিউ',
            path: '/store/dashboard',
            icon: 'LayoutDashboard',
            description: 'Store KPIs, stock health, and monthly inventory movement',
            status: 'active',
          },
          {
            id: 'store_items',
            name: 'Products',
            nameBangla: 'পণ্য',
            path: '/store/items',
            icon: 'PackageCheck',
            description: 'Item master directory, categories, UOMs, and stock levels',
            status: 'active',
          },
          {
            id: 'store_grn',
            name: 'Stock In (GRN)',
            nameBangla: 'স্টক ইন',
            path: '/store/grn',
            icon: 'FileText',
            description: 'Goods Received Notes, supplier receipts, and approval workflow',
            status: 'active',
          },
          {
            id: 'store_issue',
            name: 'Stock Out',
            nameBangla: 'স্টক আউট',
            path: '/store/issue',
            icon: 'FileText',
            description: 'Material issue & requisition dispatches',
            status: 'active',
          },
          {
            id: 'store_transfer',
            name: 'Transfers',
            nameBangla: 'স্থানান্তর',
            path: '/store/transfer',
            icon: 'FileText',
            description: 'Inter-unit and bin stock transfers',
            status: 'active',
          },
          {
            id: 'store_adjustment',
            name: 'Adjustments',
            nameBangla: 'সমন্বয়',
            path: '/store/adjustment',
            icon: 'FileText',
            description: 'Physical audit and stock adjustments',
            status: 'active',
          },
          {
            id: 'store_ledger',
            name: 'Stock Ledger',
            nameBangla: 'খতিয়ান',
            path: '/store/ledger',
            icon: 'FileSpreadsheet',
            description: 'Complete item movement and stock transaction ledger',
            status: 'active',
          },
          {
            id: 'store_reports',
            name: 'Reports',
            nameBangla: 'রিপোর্ট',
            path: '/store/reports',
            icon: 'FileSpreadsheet',
            description: 'Valuation, aging, and consumption reports',
            status: 'active',
          },
        ],
      },
      {
        id: 'qc',
        name: 'Quality (QC)',
        nameBangla: 'কোয়ালিটি কন্ট্রোল (কিউসি)',
        path: '/admin/qc',
        icon: 'ShieldCheck',
        badge: 'Soon',
        description: 'Inline inspections, end-line audits, AQL 2.5 final buyer pre-shipment inspection',
        status: 'coming_soon',
        isTickable: true,
      },
      {
        id: 'commercial',
        name: 'Commercial (LC, Export)',
        nameBangla: 'কমার্শিয়াল ও এক্সপোর্ট',
        path: '/admin/commercial',
        icon: 'BadgeDollarSign',
        badge: 'Soon',
        description: 'Master export L/C, back-to-back import L/C, shipping bill, and customs clearance',
        status: 'coming_soon',
        isTickable: true,
      },
      {
        id: 'accounts',
        name: 'Accounts',
        nameBangla: 'হিসাব বিভাগ',
        path: '/admin/accounts',
        icon: 'Calculator',
        badge: 'Soon',
        description: 'Factory cash ledger, vendor bills, order profit margin, and cost variance analysis',
        status: 'coming_soon',
        isTickable: true,
      },
      {
        id: 'attendance',
        name: 'Attendance',
        nameBangla: 'হাজিরা',
        path: '/attendance',
        icon: 'Clock',
        badge: null,
        description: 'Daily mobile selfie & GPS check-in/out attendance punch',
        status: 'active',
        isTickable: true,
      },
      {
        id: 'hr_payroll',
        name: 'HR and Payroll',
        nameBangla: 'এইচআর ও বেতন',
        path: '/hr/staff',
        icon: 'Contact',
        badge: null,
        description: 'Staff directory, service length, and monthly attendance reports',
        status: 'active',
        isTickable: true,
        children: [
          {
            id: 'staff_info',
            name: 'Staff Info',
            nameBangla: 'স্টাফ তথ্য',
            path: '/hr/staff',
            icon: 'Users',
            description: 'Employee profiles, ID cards, designations and service length',
            status: 'active',
          },
          {
            id: 'monthly_attendance',
            name: 'Monthly Attendance Report',
            nameBangla: 'মাসিক হাজিরা রিপোর্ট',
            path: '/hr/attendance',
            icon: 'FileSpreadsheet',
            description: 'Monthly factory attendance registry, hours, and export',
            status: 'active',
          },
        ],
      },
    ],
  },
];

export const PERMISSION_CATEGORIES = [
  {
    category: 'Planning & Production',
    categoryBangla: 'পরিকল্পনা ও উৎপাদন',
    keys: ['merchandising', 'sampling'],
  },
  {
    category: 'Production',
    categoryBangla: 'প্রোডাকশন বিভাগ',
    keys: ['fabric_yarn', 'cutting', 'sewing', 'washing_print_emb'],
  },
  {
    category: 'Store and Quality',
    categoryBangla: 'স্টোর ও কোয়ালিটি',
    keys: ['store_inventory', 'qc'],
  },
  {
    category: 'Commercial and Accounts',
    categoryBangla: 'কমার্শিয়াল ও অ্যাকাউন্টস',
    keys: ['commercial', 'accounts'],
  },
  {
    category: 'HR and Attendance',
    categoryBangla: 'এইচআর ও হাজিরা',
    keys: ['attendance', 'hr_payroll'],
  },
];

export const ROLE_PRESETS: Record<string, { name: string; permissions: Record<string, boolean> }> = {
  merchandiser: {
    name: 'Merchandiser Preset',
    permissions: { merchandising: true, sampling: true, commercial: true },
  },
  production_manager: {
    name: 'Production Manager Preset',
    permissions: { fabric_yarn: true, cutting: true, sewing: true, washing_print_emb: true, qc: true },
  },
  store_keeper: {
    name: 'Store Keeper Preset',
    permissions: { store_inventory: true, fabric_yarn: true },
  },
  accounts: {
    name: 'Accounts & Commercial Preset',
    permissions: { accounts: true, commercial: true },
  },
  hr: {
    name: 'HR & Payroll Preset',
    permissions: { attendance: true, hr_payroll: true },
  },
  full: {
    name: 'Full Access Preset',
    permissions: {
      attendance: true,
      hr_payroll: true,
      merchandising: true,
      sampling: true,
      fabric_yarn: true,
      cutting: true,
      sewing: true,
      washing_print_emb: true,
      store_inventory: true,
      qc: true,
      commercial: true,
      accounts: true,
    },
  },
  none: {
    name: 'Clear All',
    permissions: {},
  },
};

export default ERP_MODULES;
