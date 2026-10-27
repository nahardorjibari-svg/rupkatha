# Rupkatha Apparels Ltd. - Knit and Woven Garments ERP

Professional Enterprise Resource Planning (ERP) web application tailored for **Rupkatha Apparels Ltd.** (Knit & Woven Garments Manufacturer & Exporter, Hemayetpur, Dhaka, Bangladesh).

## Tech Stack
- **Frontend**: React + Vite + TypeScript + Tailwind CSS
- **Routing**: React Router (HashRouter optimized for GitHub Pages static hosting)
- **Database & Auth**: Supabase (@supabase/supabase-js) with Row Level Security (RLS) & RPC functions
- **UI Components & Icons**: Lucide React, Framer Motion, React Hot Toast
- **Design System**: Light / Dark glass theme with dual plant support (Knit & Woven units) and Hind Siliguri + Inter typography.

---

## Sewing Module & Per-Hour Lock Model
The **Sewing Hourly Production Report** (`/sewing/report`) implements a granular **Per-Hour Lock Model**:
1. **Per-Hour Submission**: Each hour column (01 to 10) can be independently submitted and locked (`sewing_hour_locks`).
2. **Role-Based Permissions**: Non-admin users cannot edit or overwrite submitted/locked hours. Admins can edit locked hours (logged as *After-submit edits*) or reopen hours.
3. **Audit & Edit History**: Detailed audit change log tracking draft edits vs. after-submit edits with per-hour submit timelines and exports.

---

## Automated GitHub Pages Deployment (GitHub Actions)
This repository includes a pre-configured GitHub Actions workflow at `.github/workflows/deploy.yml`. 
To publish your app live on GitHub Pages:
1. Push your repository code to GitHub (`main` or `master` branch).
2. Go to your GitHub Repository **Settings** > **Pages**.
3. Under **Build and deployment**, set **Source** to **GitHub Actions**.
4. Once the GitHub Actions workflow finishes building, your live URL will be displayed in your repository's Pages settings!

---

## Company Configuration
- **Company**: Rupkatha Apparels Ltd.
- **Corporate Office & Factory**: Raj place, Rishipara, Padma mor, Hemayetpur, Dhaka, Bangladesh
- **Contact**: nurislam@rupkathaapparels.com | +8801795094961
- **Powered By**: Md Johurul Islam, IT Officer
