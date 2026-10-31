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

3. **Enhanced Line Layout & Logistics**:
   - **Left Info Block**: Stacked boxed cells for Buyer, Style, **Order Qty** (entered daily), and **Manpower (M.P)** showing O.P/H.P/I.R breakdown and bold total (and 7 roles for Finishing).
   - **Target Analytics**: Columns for **HOUR TARGET** and **TOTAL TARGET** (computed as `hour target x working hours`) displayed between Parts/Process and the hourly grid.
   - **Streamlined Dashboard Cards**: The Sewing Dashboard displays a compact, high-density format with 2 cards per row (Line 01-02, Line 03-04) without vertical clutter. Main process rows are immediately followed by the bottom strip.
   - **In-Cell Shortage Indicators**: Shortage is directly visible beneath each Total cell (e.g., `-440` in red, `0` in green, `+30` in amber), keeping variance immediately clear without extra sub-rows.
   - **High-Visibility OUT PUT Row**: Prominently highlighted in emerald green with bold text and target indicator.
   - **Line Management Strip**: Full-width boxed bottom strip (Remarks, Line Chief, Mobile No) aligned with the grid with Bengali sub-labels.
   - **Reporting & Exports**: Full sub-row breakdowns (Hourly Short/Excess, Running Short/Excess, Remaining Target) remain accessible on the Entry and Reports pages, Print, Excel, and PDF exports.

4. **Line Summary Badges & Per-Hour Shortage Metrics**:
   - Line Header displays **Total MP** and **Total Output**, with live summary chips: `Target X | Actual Y | Ach Z% | Short S pcs (P%)` in Red/Green/Yellow for Out Put and A.S.M.
   - Per-hour sum is used for "Short Qty" across line chips, Management Summary, Executive Dashboard ("Short qty by line"), Reports grid, Excel export, and PDF export. Total actual / total target achievement percentage is shown alongside.

5. **Top Management Overview**:
   - Day summary card at the top of the entry page and on the Sewing Dashboard for all 4 parts: Out Put, Back, Front, and A.S.M.
   - Line-by-line summary table with Best Line and Shortest Line highlights.
   - Dashboard charts: Target vs Actual bar chart per line, Cumulative Actual vs Target line chart, and Short Qty by Line bar chart with Out Put / Back / Front / A.S.M part selector.
   - Full read-only grid, Print, Excel (`.xlsx`), and PDF (`.pdf`) export with Management Summary including A.S.M.

6. **Finishing Section Merger**:
   - The standalone Finishing module is now integrated into the Sewing production flow.
   - **Unified Entry Page**: `/sewing/report` displays both Sewing Line 01-04 and the Finishing section (Process: Inside, Iron, Top Side, Poly).
   - **Shared Permissions**: Access is governed by the `sewing` permission key; no separate finishing key is required.
   - **Unified Reporting**: Finishing performance cards and register data are integrated into the Dashboard, Reports grid, Excel, and PDF exports.
   - **Lock Synchronization**: Submitting a specific hour (H01-H10) for a Sewing report automatically locks the corresponding hour for the Finishing section to ensure data integrity.

7. **Granular Per-Hour Lock Model & Audit**:
   - Each hour column (01 to 10) can be independently submitted and locked (`sewing_hour_locks` and `finishing_hour_locks` are kept in sync).
   - Edit history logs draft edits vs. after-submit edits with human-readable labels.
   - Manual save only via "Save All Changes" with unsaved-changes indicators.

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
