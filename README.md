# Electricity MVP

A web app for managing an electricity-selling business: customers, monthly meter readings, bills, and payments. Built with Next.js, TypeScript, Tailwind CSS, Google Sheets (backend), and Google Drive (receipt storage).

## Features

- **Roles**: Manager and Employee
- **Manager**: Dashboard, view all data, manage pricing, edit customer discounts
- **Employee**: Add customers, record meter readings, record payments, upload receipts
- **Billing**: Monthly bills with ampere + kWh or either; fixed discounts; carry-over unpaid balance
- **Data**: Google Sheets for persistence; Google Drive for receipt images

## Tech Stack

- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- iron-session (password-based auth)
- Google Sheets API
- Google Drive API

## Prerequisites

- Node.js 18+
- Google Cloud project with Sheets and Drive APIs enabled
- A Google Sheet and a Drive folder for receipts

---

## Setup

### 1. Clone and Install

```bash
cd electricity-mvp
npm install
```

### 2. Environment Variables

Copy the example file and fill in your values:

```bash
cp .env.example .env.local
```

Edit `.env.local` with:

| Variable | Required | Description |
|----------|----------|-------------|
| `MANAGER_PASSWORD` | Yes | Manager login password |
| `EMPLOYEE_PASSWORD` | Yes | Employee login password |
| `SESSION_SECRET` | Yes | Random 32+ character string for session signing |
| `GOOGLE_SHEETS_ID` | Yes | Your Google Sheet ID (from the URL) |
| `GOOGLE_DRIVE_RECEIPTS_FOLDER_ID` | Yes | Drive folder ID for receipt images |
| `GOOGLE_APPLICATION_CREDENTIALS` | Yes* | Path to service account JSON (e.g. `./service-account.json`) |
| `GOOGLE_CREDENTIALS_JSON` | Yes* | Alternative: inline JSON (for Vercel) |

\* Use one of `GOOGLE_APPLICATION_CREDENTIALS` or `GOOGLE_CREDENTIALS_JSON`.

---

## Google Cloud Setup

### 1. Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one

### 2. Enable APIs

1. APIs & Services → Library
2. Enable **Google Sheets API**
3. Enable **Google Drive API**

### 3. Create a Service Account

1. APIs & Services → Credentials → Create Credentials → Service Account
2. Name it (e.g. `electricity-mvp`)
3. Create and download the JSON key
4. Save as `service-account.json` in the project root (or use inline `GOOGLE_CREDENTIALS_JSON`)

### 4. Share the Google Sheet

1. Open your Google Sheet
2. Copy the Sheet ID from the URL:  
   `https://docs.google.com/spreadsheets/d/`**`YOUR_SHEET_ID`**`/edit`
3. Share the sheet with the service account email (e.g. `electricity-mvp@project.iam.gserviceaccount.com`) as **Editor**

### 5. Create the Sheet Tabs and Headers

Create a Google Sheet with these tabs and headers (exact order matters):

**Tab: Customers**
- Row 1: `customerId`, `fullName`, `phone`, `area` (box number), `building`, `floor`, `apartmentNumber`, `subscribedAmpere`, `billingType`, `fixedDiscountAmount`, `status`, `notes`, `createdAt`

**Tab: Bills**
- Row 1: `billId`, `customerId`, `monthKey`, `previousCounter`, `currentCounter`, `usageKwh`, `amperePriceSnapshot`, `kwhPriceSnapshot`, `ampereCharge`, `consumptionCharge`, `discountApplied`, `previousUnpaidBalance`, `totalDue`, `totalPaid`, `remainingDue`, `paymentStatus`, `createdAt`, `updatedAt`

**Tab: Payments**
- Row 1: `paymentId`, `billId`, `customerId`, `paymentDate`, `amountPaid`, `receiptImageUrl`, `paymentMethod`, `note`, `enteredByRole`, `createdAt`

**Tab: Settings**
- Row 1: `kwhPrice`, `currency`, `updatedAt`
- Row 2 (optional initial values): `0`, `LBP`, (leave updatedAt empty or use a timestamp)

**Tab: AmperePrices** (created automatically on first save, or add manually)
- Row 1: `amp`, `price`
- Data rows: one per amperage tier, e.g. `3`, `231000` (3A = 231,000 LBP)

### 6. Create Google Drive Folder for Receipts

1. Create a new folder in Google Drive for receipt images
2. Share it with the service account email as **Editor**
3. Open the folder and copy the Folder ID from the URL:  
   `https://drive.google.com/drive/folders/`**`YOUR_FOLDER_ID`**

Put `YOUR_FOLDER_ID` in `GOOGLE_DRIVE_RECEIPTS_FOLDER_ID`.

---

## Local Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). You'll be redirected to the login page.

- **Manager**: Use the Manager role and `MANAGER_PASSWORD`
- **Employee**: Use the Employee role and `EMPLOYEE_PASSWORD`

---

## Import CSV

Import customers and bills from a CSV in the format:
`Client Name`, `BOX NUMBER`, `BUILDING NAME`, `Subscription Type`, `Amps`, `Counter Previous`, `Counter Now`, `Paid till now`, `Total Price`

- **Total Price** = amount due; **Paid till now** = amount paid; diff = 0 → PAID
- **BOX NUMBER** is stored as the "Box Number" field (shown instead of Area in the app)

```bash
npm run import-csv -- 2025-02              # FILE.csv, February 2025
npm run import-csv -- "FILE 2.csv" 2025-02 # custom file + month
```

---

## Vercel Deployment

### 1. Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin <your-repo-url>
git push -u origin main
```

### 2. Connect to Vercel

1. Go to [vercel.com](https://vercel.com)
2. Import your repository
3. Add environment variables (all from `.env.local`)

### 3. Google Credentials on Vercel

For Vercel, use `GOOGLE_CREDENTIALS_JSON` instead of a file path:

1. Copy the entire contents of `service-account.json`
2. Minify to one line (remove newlines)
3. Paste as the value of `GOOGLE_CREDENTIALS_JSON` in Vercel env vars

### 4. Deploy

Vercel will build and deploy automatically on push.

---

## Project Structure

```
src/
├── app/
│   ├── actions/          # Server actions
│   │   ├── bill.ts
│   │   ├── customer.ts
│   │   ├── payment.ts
│   │   ├── receipt.ts
│   │   └── settings.ts
│   ├── api/auth/         # Auth API routes
│   ├── employee/         # Employee pages
│   ├── manager/          # Manager pages
│   ├── login/
│   └── layout.tsx
├── components/
├── lib/
│   ├── billing.ts        # Billing calculation logic
│   ├── google-drive.ts   # Drive upload
│   ├── google-sheets.ts  # Sheets CRUD
│   ├── auth.ts
│   └── ...
└── types/
```

---

## Billing Logic Summary

- **Usage**: `currentCounter - previousCounter` (kWh)
- **Ampere charge**: Applied only for `AMPERE_ONLY` and `BOTH`
- **kWh charge**: Applied only for `KWH_ONLY` and `BOTH`
- **Discount**: Fixed amount subtracted from total; total never goes negative
- **Carry-over**: Previous month's unpaid balance is added to the new bill
- **Status**: PAID / PARTIAL / UNPAID based on remaining amount

---

## Security Notes (MVP)

- Passwords are stored in env vars; use strong passwords
- Session uses HttpOnly cookies
- Manager-only actions are protected server-side
- Employee cannot edit old bills or change pricing
- Google credentials stay server-side

For production, consider migrating to a real database and a more robust auth system (e.g. OAuth, proper user tables).
