# Rupkatha Apparels Ltd. - Knit and Woven Garments ERP

Professional Enterprise Resource Planning (ERP) web application tailored for **Rupkatha Apparels Ltd.** (Knit & Woven Garments Manufacturer & Exporter, Hemayetpur, Dhaka, Bangladesh).

## Tech Stack
- **Frontend**: React + Vite + TypeScript + Tailwind CSS
- **Routing**: React Router (HashRouter optimized for GitHub Pages static hosting)
- **Database & Auth**: Supabase (@supabase/supabase-js) with Row Level Security (RLS) & RPC functions
- **UI Components & Icons**: Lucide React, Framer Motion, React Hot Toast, Recharts
- **Design System**: Light / Dark theme with dual plant support (Knit & Woven units) and Hind Siliguri + Inter typography. Supports theme persistence via localStorage.

---

## Sewing Module: Per-Part Targets & Shortage Tracking
The **Sewing Hourly Production Report** (`/sewing/report`) includes production tracking and target analytics across all four part rows: **Back**, **Front**, **A.S.M**, and **Q.C.P**:

1. **Per-Part Targets (Hour & Total Targets)**:
   - Separate Hour Target (`back_hour_target`, `front_hour_target`, `output_hour_target`, `asm_hour_target`) and Total Target (`hour_target x working_hours`) for Back, Front, A.S.M, and Q.C.P rows.
   - Configurable **per-line Working Hours** selector (`8`, `9`, `10`, `11`, `12`; default `8`) on every Sewing Line (`01–04`) and the Finishing table, dynamically rendering `H01..H{working_hours}` columns (with data-clear guard before lowering hours).
   - "Apply Back Target to All" helper button copies Back hour target to Front, A.S.M, and Q.C.P (with confirmation).

2. **Real-time Color Coding**:
   - **Hour cells vs Hour Target**: Below target = RED (`#FEE2E2` with diff badge, e.g. `-20`), Equal = GREEN (`#DCFCE7` with `✓`), Above target = YELLOW (`#FEF9C3` with `+N`). Uncolored when target is blank.
   - **Cumulative (Σ) zone**: Running cumulative sum under each hour cell compared dynamically with cumulative target (`hour target x elapsed working hours`) with color coding for Back, Front, A.S.M, and Q.C.P.
   - **Total Column**: Shows sum of entered hourly values, compared with Total Target (`-N` or `+N`).

3. **Enhanced Line Layout & Logistics**:
   - **Left Info Block**: Stacked boxed cells for Buyer, Style, **Order Qty** (entered daily), and **Manpower (M.P)** showing O.P/H.P/I.R breakdown and bold total (and 7 roles for Finishing).
   - **Target Analytics**: Columns for **HOUR TARGET** and **TOTAL TARGET** (computed as `hour target x working hours`) displayed between Parts/Process and the hourly grid.
   - **Streamlined Dashboard Cards**: The Sewing Dashboard displays a compact, high-density format with 2 cards per row (Line 01-02, Line 03-04) without vertical clutter. Main process rows are immediately followed by the bottom strip.
   - **In-Cell Shortage Indicators**: Shortage is directly visible beneath each Total cell (e.g., `-440` in red, `0` in green, `+30` in amber), keeping variance immediately clear without extra sub-rows.
   - **High-Visibility Q.C.P Row**: Prominently highlighted in emerald green with bold text and target indicator.
   - **Line Management Strip**: Full-width boxed bottom strip (Remarks, Line Chief, Mobile No) aligned with the grid with Bengali sub-labels.
   - **Reporting & Exports**: Full sub-row breakdowns (Hourly Short/Excess, Running Short/Excess, Remaining Target) remain accessible on the Entry and Reports pages, Print, Excel, and PDF exports.

4. **Line Summary Badges & Per-Hour Shortage Metrics**:
   - Line Header displays **Total MP** and **Total Q.C.P**, with live summary chips: `Target X | Actual Y | Ach Z% | Short S pcs (P%)` in Red/Green/Yellow for Q.C.P and A.S.M.
   - Per-hour sum is used for "Short Qty" across line chips, Management Summary, Executive Dashboard ("Short qty by line"), Reports grid, Excel export, and PDF export. Total actual / total target achievement percentage is shown alongside.

5. **Top Management Overview**:
   - Day summary card at the top of the entry page and on the Sewing Dashboard for all 4 parts: Back, Front, A.S.M, and Q.C.P.
   - Line-by-line summary table with Best Line and Shortest Line highlights.
   - Dashboard charts: Target vs Actual bar chart per line, Cumulative Actual vs Target line chart, and Short Qty by Line bar chart with Back / Front / A.S.M / Q.C.P part selector.
   - Full read-only grid, Print, Excel (`.xlsx`), and PDF (`.pdf`) export with Management Summary including A.S.M.

6. **Finishing Section Merger**:
   - The standalone Finishing module is now integrated into the Sewing production flow.
   - **Unified Entry Page**: `/sewing/report` displays both Sewing Line 01-04 and the Finishing section (Process: Inside, Iron, Top Side, Poly).
   - **Shared Permissions**: Access is governed by the `sewing` permission key; no separate finishing key is required.
   - **Unified Reporting**: Finishing performance cards and register data are integrated into the Dashboard, Reports grid, Excel, and PDF exports.
   - **Lock Synchronization**: Submitting a specific hour (`H01–H12`) for a Sewing report automatically locks the corresponding hour for the Finishing section to ensure data integrity.

7. **Granular Per-Hour Lock Model & Audit**:
   - Each hour column (`01` to `12`, shown up to each line's `working_hours`) can be independently submitted and locked (`sewing_hour_locks` and `finishing_hour_locks` are kept in sync).
   - Edit history logs draft edits vs. after-submit edits with human-readable labels.
   - Manual save only via "Save All Changes" with unsaved-changes indicators.

---

## Line Dashboard: Enterprise Factory TV Boards (`/linedash/all`, `/linedash/:line`)
Dedicated 16:9 zero-scroll floor TV displays governed by the `sewing` permission (also accessible to `admin`):

1. **Routes & Access**:
   - `/linedash/all` — **All Lines 2×2 Overview**: Live cards for Line 1–4 showing traffic-light status, Buyer/Style, Today Target, Done, Remaining, SVG progress ring, and per-line mini Q.C.P hour dots (`H1–H{working_hours}`). Clicking any card opens that line's full TV board.
   - `/linedash/:line` (`/linedash/1` – `/linedash/4`) — **Single-Line TV Board**: Deep navy gradient (`#071633` → `#0D2D63`) with light-blue enterprise cards, line-colored header accent (`blue`, `purple`, `orange`, `teal`), live Dhaka clock (`Asia/Dhaka`), Info Strip, 4 Bangla/English KPI cards (`আজকের লক্ষ্য`, `উৎপাদন হয়েছে`, `এখনো বাকি` / `লক্ষ্য পূরণ`, progress ring + `বাকি সময়`), per-line Q.C.P hourly production & `SHORT / +/-` grid (`H1–H{working_hours}`), Q.C.P Final Status, Efficiency %, Manpower, and Attention Required / On Track panels.
   - **Kiosk & Fullscreen**: Press `F` or click Fullscreen (auto-hides after 3s idle) to hide Sidebar/TopBar, or open with `?kiosk=1` for unattended factory TV screens.
   - **Realtime + Sound**: Subscribes to Supabase Realtime (`400ms` debounce) with `15s` polling fallback, 1.5s highlight flash on changed numbers, and optional Web Audio short-hour alert beep (muted by default).

---

## Attendance Module: Mobile-First Selfie & GPS Punch
The **Attendance Punch** module (`/attendance`) provides a tamper-proof, mobile-friendly punch clock for factory staff:

1. **Direct RPC Security & Server Timestamps**:
   - Direct database inserts/updates are disabled. Punching operates exclusively via `supabase.rpc('att_check_in')` and `supabase.rpc('att_check_out')`.
   - All punch times are generated by the backend server in **Dhaka Time (UTC+6, 12-hour AM/PM format)**; client phone clocks cannot spoof or alter punch times.
   - Requires employee ID card number assigned by HR; users without an ID are prompted with a clear alert.

2. **Mobile Front-Camera Selfie & High-Accuracy GPS**:
   - Each IN or OUT punch asks for GPS coordinates (15s timeout, high accuracy) and prompts a front-camera selfie (`capture="user"`).
   - In-browser client compression optimizes selfies to max 600px width/height at 0.6 JPEG quality (~40-60 KB) before uploading to the private `attendance` bucket.
   - Offline detection prevents incomplete or failed punches when network connectivity is lost.

3. **Punch Lifecycle & Personal Log**:
   - Exactly two large action buttons: **IN (Green)** and **OUT (Red)**.
   - Punching IN locks the IN button and unlocks OUT. Punching OUT locks both for the remainder of the day.
   - Personal monthly attendance sheet is displayed below the punch buttons, showing date, IN/OUT times, hours, and late badges.

---

## HR & Payroll Suite: Staff Directory & Monthly Attendance Register
Governed by the `hr_payroll` permission key (available to HR officers and Administrators):

1. **Staff Information Directory (`/hr/staff`)**:
   - Complete directory of factory employees showing SL, Employee ID (office card number), Name, Login Email, Department, Designation, Mobile, Joining Date, and Service Length.
   - **Primary "Add Staff" Action**: Enables HR to enroll staff members using their Supabase login email, Full Name, Employee ID, Department, Designation, Joining Date, and Mobile.
   - Enrolls staff strictly via `supabase.rpc('hr_setup_staff')`, which automatically assigns the `"attendance"` permission and enforces validation (e.g. valid Supabase auth user, unique Employee ID).
   - **Service Length Auto-Calculation**: Automatically computes the service tenure from `joining_date` to today as `"X years Y months Z days"`.
   - **HR Update Drawer**: Securely updates staff details via `supabase.rpc('hr_update_staff')` with direct database error feedback.
   - Filter by department and search by name, ID, or login email; export to Excel (`.xlsx`).

2. **Monthly Attendance Summary Report (`/hr/attendance`)**:
   - Interactive month and year selector defaulting to current month in Dhaka time.
   - Powered by `supabase.rpc('hr_monthly_attendance', { y, m })` returning: SL, Employee ID, Name, Department, Designation, Present, Absent, Late, Missing OUT, and Total Working Hours (`hh:mm`).
   - Every staff member is displayed (even with zero punch records). Search by Employee ID or Name.
   - All-staff summary export actions: Print A4 Landscape, Download Excel (.xlsx), and Download PDF.
   - **Admin Purge**: Purges selfies older than 90 days via `supabase.rpc('purge_old_selfies', { days: 90 })` while retaining all attendance timestamps and figures.

3. **Individual Staff Monthly Attendance Sheet (`/hr/attendance/:id`)**:
   - Clicking on a staff member's Employee ID in the summary report opens their dedicated Monthly Attendance Sheet.
   - Powered by `supabase.rpc('hr_staff_month_sheet', { target, y, m })`, displaying every single calendar day from the 1st to the end of the month.
   - **Header Block**: Official company header (*Rupkatha Apparels Ltd.*, factory address, month), Staff Name, Employee ID, Department, Designation, Joining Date, and Service Length.
   - **Day-by-Day Table**: SL, Date (dd-mm-yyyy), Day name (Sat, Sun, etc.), IN time, OUT time, Working hours, Late badge, Status, and Remarks.
   - **Visual Status Hierarchy**:
     - **Present**: Emerald green badge
     - **ABSENT**: High-contrast red badge (working days up to today with no punch)
     - **Friday (Holiday)**: Highlighted in amber/yellow (`Friday - Holiday`)
     - **Missing OUT**: Orange badge
     - **Upcoming**: Neutral gray
   - **Selfie & GPS Verification**: In-cell selfie thumbnails (via 60s signed URLs) with full-screen preview and one-click Google Maps GPS pin links.
   - **Summary Strip & Totals Row**: Present days, Absent days, Fridays, Late days, and Total hours.
   - **Official Signatures & Exports**: A4 Portrait Print, Download Excel (.xlsx), and Download PDF with signature lines (*Prepared by HR*, *Checked by*, *Approved by*).
---

## Planning & Production Module: 30-Day Rolling Line Plan (`/planning/lineplan`)
The **Planning & Production** module provides a 30-day rolling line plan with real-time daily input and output tracking:

1. **Access & Permissions**:
   - Governed by the `merchandising` permission key, labeled **"Planning & Production / পরিকল্পনা"** in Staff & Role Management.
   - Non-permitted access redirects to `/dashboard` with an explicit notice (`Access denied / আপনার এই পেইজে প্রবেশের অনুমতি নেই`).
   - Dedicated sidebar group with direct access to **Line Plan** (`/planning/lineplan`). `/planning` automatically redirects to `/planning/lineplan`.

2. **8-Day Rolling Window & Date Navigation (Asia/Dhaka)**:
   - Configured with an 8-day window starting by default with yesterday (`today - 1 day`), ensuring yesterday's records are always visible.
   - Interactive date navigation buttons (`‹ Earlier` and `Later ›`) shift the 8-day window backward and forward smoothly with live date range indicators (e.g. `31/10 – 07/11`).
   - Friday columns highlighted with high-contrast slate-200 / dark slate-800 shading.

3. **5-Sub-row Order Production & Logistics Matrix**:
   - Fixed / sticky left columns: SL, Buyer, PO, Style, Order Qty (PO total), Colour, Wash, Line (inline selector), Start Date (inline picker), Colour Qty, Cutting Qty (inline editor), Extra %, and Cut Status (merged with `rowSpan=5`).
   - Each order splits into **5 tracked sub-rows**:
     - **Sub-row 1 (INPUT)**: Daily input quantities, Total Input, and Cutting Balance.
     - **Sub-row 2 (OUTPUT)**: Daily output quantities, Total Output, and Sewing Balance.
     - **Sub-row 3 (WASH SENT)**: Daily wash dispatch quantities, Total Wash Sent, and Order Wash Balance.
     - **Sub-row 4 (WASH RECV)**: Daily wash return quantities, Total Wash Recv, and In-Wash Balance.
     - **Sub-row 5 (FINISHING)**: Daily finishing quantities, Total Finishing, and Finishing Balance.
   - Realtime multi-tier upsert (`input_qty`, `output_qty`, `wash_sent_qty`, `wash_recv_qty`, `finishing_qty`) with active typing protection.

4. **Wash & Finishing Tracking Columns**:
   - **TOTAL WASH SENT**: Bold, green if `total_wash_sent >= cutting_qty`, amber otherwise (when `cutting_qty > 0`).
   - **WASH REMAINING**: `order_qty - total_wash_sent`, red when `> 0`, green when `0`.
   - **TOTAL WASH RECV**: Bold, green if `>= total_wash_sent`, amber otherwise.
   - **WASH RECV REMAINING**: `total_wash_sent - total_wash_recv`, red when `> 0`, green when `0`.
   - **TOTAL FINISHING**: Bold, green if `>= total_wash_recv`, amber otherwise.
   - **FINISHING REMAINING**: `total_wash_recv - total_finishing`, red when `> 0`, green when `0`.

5. **Line-Wise Boxed Cards & Cell Grid Borders**:
   - Orders are grouped by line (`Line-1` through `Line-4`, and `No line yet`) and wrapped in distinct colored box cards (`rounded-xl border-2` with line-specific color badges and summary strips).
   - All cells feature explicit 1px solid cell borders (`#374151` dark / `#D1D5DB` light) with `border-collapse: collapse`, creating a clean printed planning sheet appearance.
   - Balance columns clearly display Input Bal., Output Bal., Wash Rem., Wash Recv Rem., and Finish Rem. with strong color coding (red when > 0, green when 0).

6. **View-Driven Status Logic & 10-Step Lifecycle**:
   - Driven by `status_key` and `is_done` from `planning_orders_with_status`:
     1. `not_cut` → "Not cut" (gray)
     2. `cutting_running` → "Cutting running" (amber)
     3. `cut_no_line` → "Cut done · no line yet" (red)
     4. `ready_input` → "Ready to input" (amber)
     5. `input_pending` → "Input pending N" (amber)
     6. `output_pending` → "Input done · output pending N" (amber)
     7. `sewing_done` → "Sewing done · send to wash" (teal/cyan)
     8. `wash_pending` → "Wash sent · waiting recv N" (orange)
     9. `finishing_pending` → "Wash recv · finishing pending N" (purple)
     10. `po_done` → "PO done ✓" (green bold)
   - Done tab displays only rows where `is_done = true` (`po_done`).

6. **Slide-over Add Order Drawer**:
   - Buyer (mandatory field), PO, Style, Wash, Order Quantity, Line Allocation, Start Date, Cutting Quantity, Wash Send.
   - Intelligent Colour Breakdown parser:
     - With quantities: e.g. `Black 400, Navy 400, White 400` with exact sum validation.
     - By names: e.g. `Black, Navy, White` with equal split and remainder to last colour.
     - Single / blank colour.
   - Seamless insertion into `planning_orders` without modifying or sending computed fields (`is_done`).

7. **Line-Wise Summary & Multi-Format Exports**:
   - Collapsible summary grouped by line (`Line-1` through `Line-4` and `No line yet`) with Buyer, Cutting, Input, Output, Wash Sent, Wash Recv, and Finishing totals per line and grand totals.
   - Print A3 Landscape with 4 official signatures (*Prepared By*, *Merchandiser*, *Production Manager*, *General Manager / MD*).
   - Export to Excel (`.xlsx`) with smart borders, vertical merges for 5 sub-rows, and PDF (`.pdf`) via jsPDF and autoTable.

---

## Store & Inventory Module (Part 1)
The **Store & Inventory** module manages factory raw materials, item master records, stock valuation, and Goods Received Notes (GRN) with Bangladeshi currency (`৳` lakh/crore grouping) and Hind Siliguri Bangla sub-labels.

1. **Role-Based Access Control (`/store/*`)**:
   - Access checks `profiles.role` and `profiles.is_active` directly (not the module permissions array).
   - **Allowed Roles**: `admin`, `store_keeper`, `store_manager`, `production_manager`, `accounts`. Unauthorized users are redirected to `/dashboard`.
   - **Capabilities**:
     - `admin`: Full access (Dashboard, Item Master add/edit, GRN create/edit/submit, GRN Approve/Reject).
     - `store_manager`: Dashboard, Item Master view, GRN create/edit/submit, GRN Approve/Reject.
     - `store_keeper`: Dashboard, Item Master view, GRN create/edit/submit.
     - `production_manager` & `accounts`: Read-only access to Store Dashboard, Item Master, and GRN records.

2. **Routes**:
   - `/store/dashboard` — **Overview (`ওভারভিউ`)**: Hero valuation card, 2×2 KPIs + Today GRN/Issue cards, monthly Recharts `ComposedChart`, Stock Status & Category charts, Top Low Stock Items, and Recent Stock Activities (filtered dynamically by top unit selector `All` / `Knit` / `Woven`).
   - `/store/items` — **Products (`পণ্য`)**: Searchable, paginated Item Master table with category/status filters, Excel & PDF exports (with Hind Siliguri Bangla font), and Admin-only Add/Edit drawer supporting dynamic `extra_fields` JSONB (`GSM`, `Width`, `Composition` for Fabric; `Count`, `Type`, `Lot` for Yarn).
   - `/store/grn` — **Stock In (GRN) (`স্টক ইন`)**: Filterable GRN register, multi-line item receipt drawer with searchable item picker, BDT & USD (`exchange_rate`) calculation, Draft / Submit / Approve / Reject workflow, role-scoped Delete for `draft`/`rejected` documents (`admin`, `store_manager`, and creator `store_keeper` via `canDeleteStoreDocument` — same rule applies to `store_issues`, `store_transfers`, and `store_adjustments`), Excel & PDF exports, and A4 formatted Print document with signature boxes (*Prepared by*, *Store Manager*, *Accounts*).
   - `/store/issue`, `/store/transfer`, `/store/adjustment`, `/store/ledger`, `/store/reports` — Coming in Part 2.

3. **RPC Functions & Read-Only Views**:
   - **RPCs**:
     - `store_next_no({ p_kind: 'grn' })` — Generates sequential GRN document numbers on save.
     - `store_submit({ p_kind: 'grn', p_id })` — Submits a draft or rejected GRN for approval.
     - `store_approve_grn({ p_grn_id })` — Approves a submitted GRN (`admin` / `store_manager`) and updates inventory balances.
     - `store_reject({ p_kind: 'grn', p_id })` — Rejects a submitted GRN (`admin` / `store_manager`) so it can be edited and resubmitted.
   - **Read-Only Views**:
     - `store_v_stock_status` — Per-item stock totals (`knit_qty`, `woven_qty`, `current_stock`, `stock_value`, `status`).
     - `store_v_category_value` — Category-level item counts and stock valuation.
     - `store_v_monthly_movement` — Monthly `qty_in`, `qty_out`, `value_in`, `value_out`, `net_value` by unit.
     - `store_v_recent_activity` — Chronological feed of GRN, issue, transfer, and adjustment movements.

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
