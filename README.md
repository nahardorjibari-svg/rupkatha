# Rupkatha Apparels Ltd. - Knit and Woven Garments ERP

Professional Enterprise Resource Planning (ERP) web application tailored for **Rupkatha Apparels Ltd.** (Knit & Woven Garments Manufacturer & Exporter, Hemayetpur, Dhaka, Bangladesh).

## Tech Stack
- **Frontend**: React + Vite + TypeScript + Tailwind CSS
- **Routing**: React Router (HashRouter optimized for GitHub Pages static hosting)
- **Database & Auth**: Supabase (@supabase/supabase-js) with Row Level Security (RLS) & RPC functions
- **UI Components & Icons**: Lucide React, Framer Motion, React Hot Toast, Recharts
- **Design System**: Light / Dark theme with dual plant support (Knit & Woven units) and Hind Siliguri + Inter typography.

---

## Sewing Module: Per-Part Targets & Shortage Tracking
The **Sewing Hourly Production Report** (`/sewing/report`) includes production tracking and target analytics across all four part rows: **Back**, **Front**, **Out Put**, and **A.S.M**:

1. **Per-Part Targets (Hour & Total Targets)**:
   - Separate Hour Target (`back_hour_target`, `front_hour_target`, `output_hour_target`, `asm_hour_target`) and Total Target (`hour_target x working_hours`) for Back, Front, Out Put, and A.S.M rows.
   - Configurable **Working Hours** selector (1 to 10 hours, default 8).
   - "Apply Back Target to All" helper button copies Back hour target to Front, Out Put, and A.S.M (with confirmation).

2. **Real-time Color Coding**:
   - **Hour cells vs Hour Target**: Below target = RED (`#FEE2E2` with diff badge, e.g. `-20`), Equal = GREEN (`#DCFCE7` with `✓`), Above target = YELLOW (`#FEF9C3` with `+N`). Uncolored when target is blank.
   - **Cumulative (Σ) zone**: Running cumulative sum under each hour cell compared dynamically with cumulative target (`hour target x elapsed working hours`) with color coding for Back, Front, Out Put, and A.S.M.
   - **Total Column**: Shows sum of entered hourly values, compared with Total Target (`-N` or `+N`).

3. **Dual Short / Excess & Remaining Tracking Rows (Under Each Line Table)**:
   - **HOUR SHORT / EXCESS (প্রতি ঘণ্টা)**: The primary, bold group placed first. For each hour with entered data: `hour actual - hour target` (e.g. target 80, actual 70 -> `-10` in Red; actual 80 -> `0` in Green; actual 90 -> `+10` in Yellow). Blank hours remain uncounted. Each cell has an informative tooltip (`Hour XX: target YY, actual ZZ, short/excess WW`). Total column = SUM of all entered hours' differences (e.g. `-55`) with missing hours indicator (`x hours not entered`).
   - **RUNNING SHORT / EXCESS (জমা)**: The secondary group in smaller, muted typography displaying cumulative actual minus cumulative target.
   - **REMAINING TARGET (বাকি লক্ষ্য)**: Sub-rows for Back, Front, Out Put, and A.S.M calculating Total Target minus cumulative actual (never below 0).

4. **Line Summary Badges & Per-Hour Shortage Metrics**:
   - Line Header displays **Total MP** and **Total Output**, with live summary chips: `Target X | Actual Y | Ach Z% | Short S pcs (P%)` in Red/Green/Yellow for Out Put and A.S.M.
   - Per-hour sum is used for "Short Qty" across line chips, Management Summary, Executive Dashboard ("Short qty by line"), Reports grid, Excel export, and PDF export. Total actual / total target achievement percentage is shown alongside.

5. **Top Management Overview**:
   - Day summary card at the top of the entry page and on the Sewing Dashboard for all 4 parts: Out Put, Back, Front, and A.S.M.
   - Line-by-line summary table with Best Line and Shortest Line highlights.
   - Dashboard charts: Target vs Actual bar chart per line, Cumulative Actual vs Target line chart, and Short Qty by Line bar chart with Out Put / Back / Front / A.S.M part selector.
   - Full read-only grid, Print, Excel (`.xlsx`), and PDF (`.pdf`) export with Management Summary including A.S.M.

6. **Granular Per-Hour Lock Model & Audit**:
   - Each hour column (01 to 10) can be independently submitted and locked (`sewing_hour_locks`).
   - Edit history logs draft edits vs. after-submit edits with human-readable labels (`Back hour target`, `Out Put hour target`, `A.S.M hour target`, `Working hours`).
   - Manual save only via "Save All Changes" with unsaved-changes indicators and page exit warnings. Whitelist prevents sending `manpower_total` or other forbidden generated columns to Supabase.

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
