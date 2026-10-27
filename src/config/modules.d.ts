export interface ModuleItem {
  id: string;
  name: string;
  nameBangla: string;
  path?: string;
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

export interface PermissionCategory {
  category: string;
  categoryBangla: string;
  keys: string[];
}

export interface RolePreset {
  name: string;
  permissions: Record<string, boolean>;
}

export declare const ERP_MODULES: ModuleGroup[];
export declare const PERMISSION_CATEGORIES: PermissionCategory[];
export declare const ROLE_PRESETS: Record<string, RolePreset>;
export default ERP_MODULES;
