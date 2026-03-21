# Kaba Mobile App - Complete UX Specification
## Native iOS & Android Development Guide

**Version:** 1.0
**Last Updated:** March 21, 2026
**Platform:** iOS 15+ | Android 8.0+ (API 26+)
**Design System:** Kaba Mobile Design System v1.0

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Design System Foundation](#design-system-foundation)
3. [Navigation Architecture](#navigation-architecture)
4. [Complete Screen Inventory](#complete-screen-inventory)
5. [User Journeys](#user-journeys)
6. [Screen Specifications](#screen-specifications)
7. [Component Library](#component-library)
8. [Platform-Specific Guidelines](#platform-specific-guidelines)
9. [API Integration Points](#api-integration-points)
10. [Accessibility Requirements](#accessibility-requirements)

---

## Executive Summary

### Purpose
This document provides complete UX specifications for native iOS and Android developers to build the Kaba mobile application. All screens, flows, and interactions are documented with pixel-perfect specifications.

### App Overview
**Kaba Mobile** is a business management application for West African SMEs, providing:
- Invoice creation and management
- Ledger/transaction tracking
- Inventory/product management
- Customer relationship management
- Financial reports and analytics
- Payroll processing
- OHADA accounting compliance

### Target Users
- Small business owners
- Accountants and bookkeepers
- Retail shop managers
- Service providers
- Inventory managers

### Platform Support
- **iOS:** iPhone SE (375px) to iPhone 15 Pro Max (430px)
- **Android:** Small phones (360px) to large phones (412px)
- **Tablets:** iPad Mini (768px), Android tablets (800px+)

---

## Design System Foundation

### 1. Color Palette

```
PRIMARY COLORS
Primary:        #5750F1 (Purple - main brand color)
Primary Dark:   #4641D1 (Pressed states)
Primary Light:  rgba(87, 80, 241, 0.1) (Backgrounds)

SEMANTIC COLORS
Success:        #22AD5C (Green - paid, positive)
Success Light:  #10B981
Error:          #F23030 (Red - overdue, negative)
Error Dark:     #E10E0E
Warning:        #F59E0B (Yellow - pending)
Warning Light:  #FCD34D
Info:           #3C50E0 (Blue - informational)

NEUTRAL COLORS
Dark:           #111928 (Primary text)
Dark-2:         #1F2A37 (Secondary backgrounds)
Dark-3:         #374151 (Borders dark mode)
Dark-4:         #4B5563
Dark-5:         #6B7280 (Secondary text)
Gray-1:         #F9FAFB (Light background)
Gray-2:         #F3F4F6 (Secondary background)
Stroke:         #E6EBF1 (Borders)
White:          #FFFFFF
```

**Usage Guidelines:**
- Primary: CTAs, active states, links, important UI
- Success: Positive metrics, paid invoices, confirmations
- Error: Validation errors, overdue items, destructive actions
- Warning: Pending states, warnings, alerts
- Info: Informational messages, neutral badges

### 2. Typography

**Font Family:** Satoshi (fallback: -apple-system, Roboto)

**iOS Type Scale:**
```
Large Title:     34pt / Bold      (Header screens)
Title 1:         28pt / Bold      (Page titles)
Title 2:         22pt / Bold      (Section headers)
Title 3:         20pt / Semibold  (Card headers)
Headline:        17pt / Semibold  (List item titles)
Body:            17pt / Regular   (Primary text)
Callout:         16pt / Regular   (Secondary info)
Subheadline:     15pt / Regular   (Metadata)
Footnote:        13pt / Regular   (Captions)
Caption 1:       12pt / Regular   (Smallest text)
Caption 2:       11pt / Medium    (Labels, tabs)
```

**Android Type Scale:**
```
Display Large:   57sp / Bold      (Splash screens)
Display Medium:  45sp / Bold
Display Small:   36sp / Bold
Headline Large:  32sp / Bold      (Page titles)
Headline Medium: 28sp / Bold
Headline Small:  24sp / Bold      (Section headers)
Title Large:     22sp / Semibold
Title Medium:    16sp / Semibold  (List items)
Title Small:     14sp / Semibold
Body Large:      16sp / Regular   (Primary text)
Body Medium:     14sp / Regular
Body Small:      12sp / Regular
Label Large:     14sp / Medium
Label Medium:    12sp / Medium    (Buttons, tabs)
Label Small:     11sp / Medium
```

**Line Heights:**
- Headings: 1.2x font size
- Body text: 1.5x font size
- Captions: 1.3x font size

### 3. Spacing System

**8px Grid System:**
```
Space 1:    4px   (Micro spacing)
Space 2:    8px   (Tight spacing)
Space 3:    12px  (Compact spacing)
Space 4:    16px  (Default spacing)
Space 5:    20px  (Comfortable spacing)
Space 6:    24px  (Section spacing)
Space 8:    32px  (Large section spacing)
Space 10:   40px  (Extra large spacing)
Space 12:   48px  (Screen padding top/bottom)
```

**Component Padding:**
- Buttons: 16px horizontal, 12px vertical
- Input fields: 16px horizontal, 14px vertical
- Cards: 16px all around
- Screen edges: 16px horizontal
- Bottom navigation: 8px vertical, 4px horizontal

**Touch Targets:**
- Minimum: 44×44pt (iOS) / 48×48dp (Android)
- Recommended: 48×48pt for all interactive elements

### 4. Corner Radius

```
Small:      6px   (Badges, small pills)
Medium:     8px   (Buttons, inputs)
Large:      12px  (Cards)
Extra Large: 16px  (Modal sheets)
Full:       9999px (Pills, avatars)
```

### 5. Shadows & Elevation

**iOS Shadows:**
```
Card Shadow:    0 1px 2px rgba(0,0,0,0.12)
Card Hover:     0 8px 13px rgba(0,0,0,0.07)
Modal:          0 12px 34px rgba(13,10,44,0.08)
FAB:            0 4px 12px rgba(87,80,241,0.4)
```

**Android Elevation:**
```
Level 1:  1dp  (Cards)
Level 2:  2dp  (Buttons, chips)
Level 3:  3dp  (FAB resting)
Level 4:  4dp  (App bar)
Level 5:  6dp  (FAB pressed)
Level 6:  8dp  (Nav drawer)
Level 8:  12dp (Modal bottom sheet)
Level 16: 24dp (Dialog)
```

### 6. Icons

**Icon Set:** Feather Icons (outline style)
**Sizes:**
- Small: 16×16px (inline icons)
- Medium: 20×20px (list icons)
- Large: 24×24px (navigation, headers)
- Extra Large: 44×44px (overview cards)

**Stroke Width:** 2px
**Style:** Rounded caps and joins

---

## Navigation Architecture

### Primary Navigation Pattern

**Bottom Tab Bar** (5 tabs - persistent across app)

```
┌─────────────────────────────────────┐
│                                     │
│         SCREEN CONTENT              │
│                                     │
│                                     │
├─────────────────────────────────────┤
│  [Home]  [Invoices]  [Ledger]      │
│  [Products]  [More]                 │
└─────────────────────────────────────┘
```

**Tab Structure:**
1. **Home** (icon: home)
   - Dashboard
   - Overview metrics
   - Quick actions

2. **Invoices** (icon: file-text)
   - Invoice list
   - Create invoice
   - Invoice details

3. **Ledger** (icon: dollar-sign)
   - Transaction list
   - Add entry
   - Filters

4. **Products** (icon: shopping-bag)
   - Product list
   - Stock management
   - Add product

5. **More** (icon: grid)
   - Customers
   - Suppliers
   - Reports
   - Payroll
   - Settings

### Navigation Hierarchy

```
App Launch
├── Splash Screen (1s)
├── Authentication Flow
│   ├── Sign In
│   ├── Sign Up
│   ├── Forgot Password
│   └── Reset Password
│
└── Main App (Bottom Tab Navigation)
    │
    ├── Tab 1: Home
    │   ├── Dashboard
    │   └── Notifications
    │
    ├── Tab 2: Invoices
    │   ├── Invoice List
    │   ├── Create Invoice
    │   │   ├── Select Customer
    │   │   ├── Add Line Items
    │   │   └── Review & Send
    │   ├── Invoice Detail
    │   └── Invoice Edit
    │
    ├── Tab 3: Ledger
    │   ├── Transaction List
    │   ├── Add Entry
    │   └── Filters
    │
    ├── Tab 4: Products
    │   ├── Product List
    │   ├── Product Detail
    │   └── Add Product
    │
    └── Tab 5: More
        ├── Customers
        │   ├── Customer List
        │   └── Add Customer
        ├── Suppliers
        │   └── Supplier List
        ├── Reports
        │   ├── P&L Report
        │   ├── Cash Flow
        │   └── Tax Report
        ├── Payroll
        │   ├── Employees
        │   └── Pay Runs
        └── Settings
            ├── Profile
            ├── Business Settings
            ├── Team
            ├── Preferences
            └── Security
```

### Navigation Patterns

**Stack Navigation:**
- Each tab has its own navigation stack
- Tabs remember scroll position and stack state
- Deep linking supported

**Modal Presentation:**
- Full-screen modals: Create forms, filters
- Bottom sheets: Quick actions, pickers, confirmations
- Alerts: Confirmations, errors

**Gestures:**
- iOS: Swipe from left edge to go back
- Android: Back button / swipe from left edge
- Pull-to-refresh: All list screens
- Swipe actions: List items (archive, delete, mark paid)

---

## Complete Screen Inventory

### Total Screens: 42

**Authentication (5 screens)**
1. Splash Screen
2. Sign In
3. Sign Up
4. Forgot Password
5. Reset Password Success

**Onboarding (1 screen)**
6. Business Setup Wizard

**Home/Dashboard (3 screens)**
7. Dashboard
8. Quick Actions Sheet
9. Notifications List

**Invoices (8 screens)**
10. Invoice List
11. Create Invoice - Step 1 (Customer)
12. Create Invoice - Step 2 (Line Items)
13. Create Invoice - Step 3 (Review)
14. Invoice Detail
15. Invoice Edit
16. Invoice POS Mode
17. Invoice Filters

**Ledger (5 screens)**
18. Transaction List
19. Add Ledger Entry
20. Transaction Detail
21. Ledger Filters
22. Category Picker

**Products/Inventory (4 screens)**
23. Product List
24. Product Detail
25. Add Product
26. Product Filters

**Customers (3 screens)**
27. Customer List
28. Customer Detail
29. Add Customer

**Suppliers (2 screens)**
30. Supplier List
31. Supplier Detail

**Reports (4 screens)**
32. Reports Hub
33. P&L Report
34. Cash Flow Report
35. Tax Report

**Payroll (3 screens)**
36. Payroll Dashboard
37. Employee List
38. Pay Runs

**Settings (7 screens)**
39. Settings Hub
40. Profile Settings
41. Business Settings
42. Team Management
43. Preferences
44. API Keys
45. Activity Log

---

## User Journeys

### Journey 1: New User Onboarding

**Goal:** Complete setup and create first invoice

```
Step 1: Download & Launch
┌────────────────────┐
│  Splash Screen     │ → Auto (1s)
│  Kaba Logo         │
└────────────────────┘
          ↓
┌────────────────────┐
│  Welcome Screen    │
│  • Value props     │
│  [Sign Up]         │ → Tap Sign Up
│  [Sign In]         │
└────────────────────┘
          ↓
Step 2: Account Creation
┌────────────────────┐
│  Sign Up           │
│  Email:   [____]   │
│  Password:[____]   │ → Fill & Submit
│  [Create Account]  │
└────────────────────┘
          ↓
Step 3: Business Setup
┌────────────────────┐
│  Business Setup    │
│  Name:     [____]  │
│  Country:  [____]  │
│  Currency: [____]  │ → Fill & Submit
│  [Continue]        │
└────────────────────┘
          ↓
Step 4: Dashboard (First Time)
┌────────────────────┐
│  Dashboard         │
│  📊 Overview       │
│  ┌──────────────┐  │
│  │ Get Started  │  │
│  │ Create your  │  │
│  │ first invoice│  │ → Tap Get Started
│  └──────────────┘  │
└────────────────────┘
          ↓
Step 5: Create First Invoice
┌────────────────────┐
│  New Invoice       │
│  Select Customer   │
│  [+ Add Customer]  │ → Add customer
│                    │
└────────────────────┘
          ↓
┌────────────────────┐
│  New Customer      │
│  Name: [____]      │
│  Email:[____]      │ → Fill & Save
│  [Save]            │
└────────────────────┘
          ↓
┌────────────────────┐
│  New Invoice       │
│  Customer: ✓       │
│  Add Line Items    │
│  [+ Add Item]      │ → Add items
└────────────────────┘
          ↓
┌────────────────────┐
│  Review Invoice    │
│  Total: XOF 50,000 │
│  [Create Invoice]  │ → Submit
└────────────────────┘
          ↓
┌────────────────────┐
│  ✓ Success!        │
│  Invoice Created   │
│  [View] [Share]    │
└────────────────────┘

**Total Time:** ~5 minutes
**Friction Points:**
- Customer creation (inline)
- Line item entry (mobile keyboard)

**Success Metrics:**
- 80% complete onboarding
- 60% create first invoice within 10 minutes
```

### Journey 2: Daily Invoice Creation

**Goal:** Create invoice for existing customer

```
Start: Dashboard
┌────────────────────┐
│  Dashboard         │
│  Today's Sales     │
│                    │
│  [+ FAB]           │ → Tap FAB
└────────────────────┘
          ↓
┌────────────────────┐
│  Quick Actions     │ (Bottom Sheet)
│  • New Invoice     │ → Tap New Invoice
│  • New Sale        │
│  • Add Expense     │
└────────────────────┘
          ↓
┌────────────────────┐
│  New Invoice       │
│  [Search]          │
│  Recent Customers  │
│  • Acme Corp       │ → Tap customer
│  • Beta Inc        │
└────────────────────┘
          ↓
┌────────────────────┐
│  New Invoice       │
│  Customer: Acme    │
│  [+ Add Item]      │ → Tap Add Item
└────────────────────┘
          ↓
┌────────────────────┐
│  Add Line Item     │ (Bottom Sheet)
│  Product: [____]   │
│  Qty: [1]          │
│  Price:[____]      │ → Fill
│  [Add]             │
└────────────────────┘
          ↓
┌────────────────────┐
│  New Invoice       │
│  Item 1: Service   │
│  Total: XOF 25,000 │
│  [Create]          │ → Submit
└────────────────────┘
          ↓
┌────────────────────┐
│  Invoice Created!  │
│  #INV-042          │
│  [Share]  [Done]   │ → Tap Share
└────────────────────┘
          ↓
┌────────────────────┐
│  Share via...      │ (Native Share)
│  • WhatsApp        │ → Send to customer
│  • Email           │
│  • SMS             │
└────────────────────┘

**Total Time:** ~90 seconds
**Success Metrics:**
- <2 minutes to create & send invoice
- 90% use recent customers (no search)
```

### Journey 3: Recording Daily Sales

**Goal:** Add ledger entries for cash sales

```
Start: Dashboard or Ledger Tab
┌────────────────────┐
│  Ledger            │
│  [+ Add Entry]     │ → Tap Add Entry
│                    │
│  Today's Entries   │
└────────────────────┘
          ↓
┌────────────────────┐
│  Add Entry         │
│  Type:             │
│  ○ Sale ● Expense  │ → Select Sale
│  Amount: [____]    │
│  Category:[____]   │ → Fill
│  [Save]            │
└────────────────────┘
          ↓
┌────────────────────┐
│  Ledger            │
│  ✓ Entry Added     │
│  + XOF 15,000      │ (Toast)
│                    │
│  [+ Add Another]   │ → Quick add more
└────────────────────┘

**Total Time:** ~30 seconds per entry
**Success Metrics:**
- 70% use quick add for multiple entries
- <45 seconds average entry time
```

### Journey 4: Monthly Report Generation

**Goal:** Generate P&L report for tax filing

```
Start: More Tab → Reports
┌────────────────────┐
│  Reports           │
│  • P&L Report      │ → Tap P&L
│  • Cash Flow       │
│  • Tax Report      │
└────────────────────┘
          ↓
┌────────────────────┐
│  P&L Report        │
│  Period:[This Mo]  │ → Select period
│  [Generate]        │
└────────────────────┘
          ↓
┌────────────────────┐
│  Loading...        │ (Spinner)
│  Generating report │
└────────────────────┘
          ↓
┌────────────────────┐
│  P&L Report        │
│  Revenue: 450,000  │
│  Expenses: 280,000 │
│  Profit:   170,000 │
│                    │
│  [Export] [Share]  │ → Tap Export
└────────────────────┘
          ↓
┌────────────────────┐
│  Export Format     │ (Bottom Sheet)
│  • PDF             │ → Select PDF
│  • CSV             │
│  • Excel           │
└────────────────────┘
          ↓
┌────────────────────┐
│  ✓ Exported        │
│  PL_Mar2026.pdf    │
│  [Open] [Share]    │
└────────────────────┘

**Total Time:** ~60 seconds
**Success Metrics:**
- 90% successfully export
- PDF most popular format (70%)
```

---

## Screen Specifications

### 1. Splash Screen

**File:** `01_splash.png`
**Duration:** 1 second
**Animation:** Fade in logo

```
┌─────────────────────────────────┐
│                                 │
│                                 │
│                                 │
│           ┌──────┐              │
│           │ KABA │              │
│           │ Logo │              │
│           └──────┘              │
│                                 │
│        Business Made            │
│           Simple                │
│                                 │
│                                 │
│                                 │
│         Loading...              │
│                                 │
└─────────────────────────────────┘
```

**Specifications:**
- Background: Primary (#5750F1)
- Logo: White, centered
- Tagline: White, 16pt, below logo (24px gap)
- Loading indicator: White spinner, bottom center

**Behavior:**
- Show for minimum 1 second
- If auth check takes >1s, show until complete
- Fade to Sign In (new user) or Dashboard (existing user)

**Platform Notes:**
- iOS: Use native splash screen (Launch Screen Storyboard)
- Android: Use splash theme (no custom view)

---

### 2. Sign In Screen

**File:** `02_sign_in.png`

```
┌─────────────────────────────────┐
│  ← Back                         │
│                                 │
│     ┌──────┐                    │
│     │ KABA │                    │
│     └──────┘                    │
│                                 │
│  Welcome Back                   │
│  Sign in to continue            │
│                                 │
│  Email                          │
│  ┌───────────────────────────┐ │
│  │ name@example.com          │ │
│  └───────────────────────────┘ │
│                                 │
│  Password                       │
│  ┌───────────────────────────┐ │
│  │ ••••••••••                │👁│
│  └───────────────────────────┘ │
│                                 │
│           Forgot Password?      │
│                                 │
│  ┌───────────────────────────┐ │
│  │      Sign In              │ │
│  └───────────────────────────┘ │
│                                 │
│  Don't have an account?         │
│         Sign Up                 │
│                                 │
└─────────────────────────────────┘
```

**Layout Specifications:**
- Screen padding: 16px horizontal
- Logo: 80×80px, centered, 32px from top
- Title: "Welcome Back", 28pt Bold, Dark, 24px below logo
- Subtitle: "Sign in to continue", 14pt Regular, Dark-5, 8px below title
- Input spacing: 24px between fields
- Forgot password: 12px below password field, right-aligned
- Button: 48px height, 16px below forgot password
- Sign up link: 24px below button, centered

**Input Field Specifications:**
```
Label: 14pt Medium, Dark, 8px above input
Input:
  - Height: 48px
  - Padding: 16px horizontal, 14px vertical
  - Border: 1px Stroke
  - Border radius: 8px
  - Font: 16pt Regular
  - Placeholder: Dark-5
Focus state:
  - Border: 2px Primary
  - Shadow: 0 0 0 3px rgba(87,80,241,0.1)
Error state:
  - Border: 2px Error
  - Error text: 12pt Regular, Error, 4px below input
```

**Button Specifications:**
```
Primary Button (Sign In):
  - Background: Primary
  - Text: White, 16pt Semibold
  - Height: 48px
  - Border radius: 8px
  - Press state: Primary Dark, scale 0.98
  - Disabled: Opacity 0.5, no interaction
```

**Behavior:**
- Email auto-capitalize: off
- Email keyboard type: email
- Password keyboard type: password
- Password visibility toggle: tap eye icon
- Forgot password: Navigate to Forgot Password screen
- Sign up link: Navigate to Sign Up screen
- Sign in button: Validate → Show loading → Navigate to Dashboard
- Remember me: Store token securely (Keychain/EncryptedSharedPreferences)

**Validation:**
- Email: Required, valid format
- Password: Required, min 8 characters
- Show inline errors on blur
- Disable button until valid

**API Integration:**
```
POST /api/v1/auth/sign-in
Body: { email, password }
Response: { success, data: { token, user, business } }
Store token in secure storage
```

**Error Handling:**
- Invalid credentials: "Email or password incorrect"
- Network error: "Connection error. Please try again."
- Server error: "Something went wrong. Please try again."
- Show errors in toast/alert

---

### 3. Dashboard (Home)

**File:** `03_dashboard.png`

```
┌─────────────────────────────────┐
│  👤 John's Business      [🔔3]  │ Header
├─────────────────────────────────┤
│                                 │
│  Good Morning, John 👋          │
│                                 │
│  ┌──────────────┬──────────────┐│ Overview
│  │ 💰 Revenue   │ 📄 Invoices  ││ Cards
│  │ XOF 2.45M    │ 24           ││ (Scroll
│  │ ↑ 12%        │ ↑ 8%         ││  horizontal)
│  └──────────────┴──────────────┘│
│  ┌──────────────┬──────────────┐│
│  │ ⏱ Pending    │ 💸 Expenses  ││
│  │ XOF 350K     │ XOF 1.1M     ││
│  │ 3 invoices   │ ↓ 5%         ││
│  └──────────────┴──────────────┘│
│                                 │
│  Quick Actions                  │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐  │
│  │📄+│ │💰+│ │💳 │ │📊 │  │
│  │Inv│ │Sal│ │Exp│ │Rep│  │
│  └────┘ └────┘ └────┘ └────┘  │
│                                 │
│  Recent Activity                │
│  ┌───────────────────────────┐ │
│  │ #INV-042      XOF 25,000  │ │
│  │ Acme Corp           PAID  │ │
│  │ Mar 21               →    │ │
│  ├───────────────────────────┤ │
│  │ Office Supplies -15,000   │ │
│  │ Expense         Mar 21    │ │
│  │                      →    │ │
│  └───────────────────────────┘ │
│                                 │
│        [View All Activity]      │
│                                 │
├─────────────────────────────────┤
│ [🏠] [📄] [💰] [📦] [⋯]       │ Bottom
└─────────────────────────────────┘ Nav
```

**Layout Specifications:**

**Header Bar:**
- Height: 56px
- Padding: 16px horizontal
- Background: White / Dark-2 (dark mode)
- Business name: 17pt Semibold, Dark
- Notification badge: 16×16px circle, Error bg, White text
- Bottom border: 1px Stroke

**Greeting Section:**
- Padding: 24px horizontal, 16px vertical
- Text: "Good Morning, [Name]", 22pt Bold, Dark
- Emoji: Platform native

**Overview Cards:**
- Container: Horizontal scroll, snap to items
- Spacing: 12px between cards
- Card size: 160px width, 100px height
- Card padding: 16px
- Card background: White / Dark-2
- Card shadow: 0 1px 2px rgba(0,0,0,0.12)
- Card border radius: 12px

**Overview Card Content:**
```
Icon: 24×24px, colored (Primary/Green/Yellow/Red)
Label: 14pt Regular, Dark-5
Value: 20pt Bold, Dark
Change: 12pt Medium, Green (positive) / Red (negative)
```

**Quick Actions:**
- Grid: 4 columns
- Item size: 64×64px
- Icon: 24×24px, centered
- Label: 11pt Medium, Dark, 4px below icon
- Background: Gray-1 / Dark-3
- Border radius: 12px
- Padding: 12px

**Recent Activity List:**
- List item height: 72px
- Padding: 16px
- Border bottom: 1px Stroke
- Invoice number: 16pt Semibold, Dark
- Customer name: 14pt Regular, Dark-5
- Date: 12pt Regular, Dark-5
- Amount: 18pt Bold, right-aligned
- Status badge: 12pt Medium, rounded pill
- Chevron: 20×20px, Dark-5

**Bottom Navigation:**
- Height: 56px
- Background: White / Dark-2
- Top border: 1px Stroke
- 5 items, equal width
- Icon: 24×24px
- Label: 11pt Medium
- Active color: Primary
- Inactive color: Dark-5

**Behavior:**
- Pull-to-refresh: Reload all dashboard data
- Overview cards: Horizontal scroll with snap
- Tap card: Navigate to relevant screen
- Quick actions: Bottom sheet with actions
- Activity item tap: Navigate to detail
- View all: Navigate to full activity log

**API Integration:**
```
GET /api/v1/dashboard
Response: {
  overview: { revenue, invoices, pending, expenses },
  recentActivity: [...],
  notifications: [...]
}
```

**Loading States:**
- Show skeleton cards while loading
- Shimmer animation on skeleton
- Error state: Retry button

---

### 4. Invoice List

**File:** `04_invoice_list.png`

```
┌─────────────────────────────────┐
│  ← Invoices            [🔍][≡] │ Header
├─────────────────────────────────┤
│  ┌─────────────────────────────┐│ Search
│  │ 🔍 Search invoices...       ││
│  └─────────────────────────────┘│
│                                 │
│  [All] [Paid] [Pending] [Late]  │ Filters
│                                 │
│  ┌───────────────────────────┐ │
│  │ #INV-042      XOF 25,000  │ │
│  │ Acme Corporation          │ │
│  │ Mar 21, 2026        PAID  │ │
│  └───────────────────────────┘ │
│  ┌───────────────────────────┐ │
│  │ #INV-041      XOF 150,000 │ │
│  │ Beta Industries           │ │
│  │ Mar 20, 2026     PENDING  │ │
│  └───────────────────────────┘ │
│  ┌───────────────────────────┐ │
│  │ #INV-040      XOF 75,000  │ │
│  │ Gamma Solutions           │ │
│  │ Mar 15, 2026     OVERDUE  │ │
│  └───────────────────────────┘ │
│                                 │
│        Loading more...          │
│                                 │
│                    [+]          │ FAB
├─────────────────────────────────┤
│ [🏠] [📄] [💰] [📦] [⋯]       │
└─────────────────────────────────┘
```

**Swipe Actions:**
```
Swipe Left (Destructive):
┌───────────────────────────────┐
│ #INV-042    │ 🗑 Delete       │
│ Acme Corp   │                 │
└───────────────────────────────┘

Swipe Right (Primary):
┌───────────────────────────────┐
│ ✓ Mark Paid │ #INV-041        │
│              │ Beta Industries │
└───────────────────────────────┘
```

**Layout Specifications:**

**Header Bar:**
- Title: "Invoices", 28pt Bold, Dark
- Search icon: 24×24px, tap to focus search
- Filter icon: 24×24px, tap to open filter sheet

**Search Bar:**
- Height: 44px
- Margin: 16px horizontal, 12px vertical
- Border radius: 12px
- Background: Gray-1 / Dark-3
- Icon: 20×20px, 12px from left
- Input padding: 12px left (after icon)
- Placeholder: "Search invoices...", Dark-5
- Clear button: 20×20px X, right side when typing

**Filter Chips:**
- Height: 36px
- Horizontal scroll
- Padding: 12px horizontal per chip
- Border radius: 18px (full pill)
- Spacing: 8px between chips
- Active: Primary bg, White text
- Inactive: Gray-1 bg, Dark text
- Font: 14pt Medium

**Invoice List Item:**
```
Height: 88px
Padding: 16px
Border bottom: 1px Stroke
Background: White / Dark-2

Layout:
┌─────────────────────────────────┐
│ #INV-042            XOF 25,000  │ Row 1
│ Acme Corporation                │ Row 2
│ Mar 21, 2026              PAID  │ Row 3
└─────────────────────────────────┘

Row 1:
- Invoice #: 16pt Semibold, Dark, left
- Amount: 18pt Bold, Dark, right

Row 2:
- Customer: 14pt Regular, Dark-5, left
- Margin top: 4px

Row 3:
- Date: 12pt Regular, Dark-5, left
- Badge: 12pt Medium, colored pill, right
- Margin top: 8px
```

**Status Badges:**
```
PAID:     Green bg (#E9FBF0), Green text
PENDING:  Yellow bg (#FFFBEB), Yellow text
OVERDUE:  Red bg (#FEEBEB), Red text
DRAFT:    Gray bg (#F3F4F6), Gray text

Padding: 6px horizontal, 4px vertical
Border radius: 12px
Text transform: uppercase
Letter spacing: 0.5px
```

**FAB (Floating Action Button):**
- Size: 56×56px
- Position: 16px from right, 72px from bottom (above nav)
- Background: Primary
- Icon: + (white, 24×24px)
- Shadow: 0 4px 12px rgba(87,80,241,0.4)
- Press: scale 0.95

**Swipe Actions:**
- Threshold: 50% of item width
- Swipe left: Red bg, Delete icon + text
- Swipe right: Green bg, Check icon + "Mark Paid"
- Full swipe: Execute action immediately
- Partial swipe: Show action, tap to execute

**Behavior:**
- Pull-to-refresh: Reload invoice list
- Infinite scroll: Load more when 3 items from bottom
- Search: Debounce 300ms, search as you type
- Filter chips: Toggle, can select multiple
- Tap item: Navigate to Invoice Detail
- FAB tap: Navigate to Create Invoice
- Swipe actions: Delete / Mark Paid with confirmation

**API Integration:**
```
GET /api/v1/invoices?limit=20&cursor=[cursor]&status=[filter]&search=[query]
Response: {
  items: [...],
  nextCursor: "abc123",
  hasMore: true
}
```

**Empty States:**
```
No Invoices:
┌─────────────────────────────────┐
│                                 │
│         📄                      │
│                                 │
│    No Invoices Yet              │
│    Create your first invoice    │
│                                 │
│  ┌─────────────────────────┐   │
│  │   Create Invoice        │   │
│  └─────────────────────────┘   │
│                                 │
└─────────────────────────────────┘

No Search Results:
┌─────────────────────────────────┐
│         🔍                      │
│                                 │
│    No Results Found             │
│    Try adjusting your search    │
│                                 │
│  ┌─────────────────────────┐   │
│  │   Clear Search          │   │
│  └─────────────────────────┘   │
└─────────────────────────────────┘
```

---

### 5. Create Invoice - Step 1 (Customer Selection)

**File:** `05_create_invoice_step1.png`

```
┌─────────────────────────────────┐
│  ✕ New Invoice           [1/3]  │ Header
├─────────────────────────────────┤
│                                 │
│  Select Customer                │
│                                 │
│  ┌─────────────────────────────┐│
│  │ 🔍 Search customers...      ││
│  └─────────────────────────────┘│
│                                 │
│  ┌─────────────────────────────┐│
│  │ + Add New Customer          ││
│  └─────────────────────────────┘│
│                                 │
│  Recent Customers               │
│  ┌───────────────────────────┐ │
│  │ AC  Acme Corporation      │ │
│  │     contact@acme.com   →  │ │
│  ├───────────────────────────┤ │
│  │ BI  Beta Industries       │ │
│  │     info@beta.com      →  │ │
│  ├───────────────────────────┤ │
│  │ GS  Gamma Solutions       │ │
│  │     hello@gamma.co     →  │ │
│  └───────────────────────────┘ │
│                                 │
│                                 │
│  ┌─────────────────────────────┐│
│  │         Next               ││
│  └─────────────────────────────┘│
└─────────────────────────────────┘
```

**Layout Specifications:**

**Header:**
- Close button (✕): 24×24px, left
- Title: "New Invoice", 17pt Semibold, center
- Progress: "[1/3]", 14pt Regular, Dark-5, right
- Height: 56px
- Border bottom: 1px Stroke

**Progress Indicator:**
```
Alternative visual:
● ○ ○  (filled/unfilled dots)
```

**Section Title:**
- "Select Customer", 24pt Bold, Dark
- Padding: 24px horizontal, 16px top

**Search Bar:**
- Same specs as Invoice List search
- Auto-focus on screen load
- Show keyboard immediately

**Add New Customer Button:**
```
Height: 48px
Background: Gray-1 / Dark-3
Border: 1px dashed Stroke
Border radius: 8px
Text: "+ Add New Customer", 16pt Semibold, Primary
Icon: + (Primary, 20×20px), left of text
```

**Section Label:**
- "Recent Customers", 14pt Semibold, Dark
- Padding: 16px horizontal, 16px top, 8px bottom

**Customer List Item:**
```
Height: 64px
Padding: 12px horizontal
Background: White / Dark-2
Border bottom: 1px Stroke

Layout:
┌─────────────────────────────────┐
│ [AC] Acme Corporation        → │
│      contact@acme.com           │
└─────────────────────────────────┘

Avatar:
- Size: 40×40px
- Background: Primary/10
- Text: Initials, 16pt Bold, Primary
- Border radius: 20px (circular)

Name: 16pt Semibold, Dark
Email: 14pt Regular, Dark-5
Chevron: 20×20px, Dark-5, right
```

**Next Button:**
```
Position: Fixed bottom, 16px from edges
Height: 48px
Background: Primary
Text: "Next", 16pt Semibold, White
Border radius: 8px
Disabled state: Opacity 0.5, gray bg
```

**Behavior:**
- Search: Filter customer list as you type
- Tap "Add New Customer": Show bottom sheet with quick add form
- Tap customer: Select (show checkmark), enable Next button
- Tap Next: Navigate to Step 2 with selected customer
- Back/Close: Show confirmation if customer selected

**Add Customer Bottom Sheet:**
```
┌─────────────────────────────────┐
│  Add Customer           [✕]     │
├─────────────────────────────────┤
│  Customer Name *                │
│  ┌───────────────────────────┐ │
│  │                           │ │
│  └───────────────────────────┘ │
│                                 │
│  Email                          │
│  ┌───────────────────────────┐ │
│  │                           │ │
│  └───────────────────────────┘ │
│                                 │
│  Phone                          │
│  ┌───────────────────────────┐ │
│  │                           │ │
│  └───────────────────────────┘ │
│                                 │
│  ┌─────────────────────────────┐│
│  │       Add Customer         ││
│  └─────────────────────────────┘│
└─────────────────────────────────┘

Height: 50% of screen
Border radius: 16px top corners
Drag handle: 32×4px gray bar, centered at top
```

**API Integration:**
```
GET /api/v1/customers?search=[query]
POST /api/v1/customers
Body: { name, email, phone }
```

---

### 6. Create Invoice - Step 2 (Line Items)

**File:** `06_create_invoice_step2.png`

```
┌─────────────────────────────────┐
│  ← New Invoice           [2/3]  │
├─────────────────────────────────┤
│  Customer: Acme Corp       ✓    │
│                                 │
│  Line Items                     │
│                                 │
│  ┌───────────────────────────┐ │
│  │ 1. Product A              │ │
│  │    Qty: 2  @  XOF 5,000   │ │
│  │    Total: XOF 10,000  [✕] │ │
│  └───────────────────────────┘ │
│  ┌───────────────────────────┐ │
│  │ 2. Service Package        │ │
│  │    Qty: 1  @  XOF 15,000  │ │
│  │    Total: XOF 15,000  [✕] │ │
│  └───────────────────────────┘ │
│                                 │
│  ┌─────────────────────────────┐│
│  │ + Add Line Item            ││
│  └─────────────────────────────┘│
│                                 │
│  ─────────────────────────────  │
│                                 │
│  Subtotal        XOF 25,000     │
│  Tax (18%)        XOF 4,500     │
│  Total           XOF 29,500     │
│                                 │
│  ┌─────────────────────────────┐│
│  │         Next               ││
│  └─────────────────────────────┘│
└─────────────────────────────────┘
```

**Layout Specifications:**

**Customer Confirmation:**
```
Height: 44px
Background: Green/10
Padding: 12px horizontal
Border radius: 8px
Margin: 16px

Text: "Customer: Acme Corp ✓"
Font: 14pt Semibold, Green
Icon: Checkmark, Green
```

**Line Item Card:**
```
Padding: 16px
Background: White / Dark-2
Border: 1px Stroke
Border radius: 8px
Margin bottom: 12px

Row 1:
- Number + Name: "1. Product A", 16pt Semibold, Dark
- Delete: ✕ icon, 20×20px, Red, right

Row 2:
- Quantity: "Qty: 2", 14pt Regular, Dark-5
- Price: "@ XOF 5,000", 14pt Regular, Dark-5
- Margin top: 8px

Row 3:
- Total: "Total: XOF 10,000", 16pt Bold, Dark
- Margin top: 4px
```

**Add Line Item Button:**
```
Same style as Add Customer button
Icon: + (Primary)
Text: "Add Line Item", Primary
Dashed border
```

**Summary Section:**
```
Background: Gray-1 / Dark-3
Padding: 16px
Border radius: 8px
Margin: 16px horizontal

Rows:
Subtotal:  16pt Regular, Dark      Right: 16pt Semibold, Dark
Tax:       14pt Regular, Dark-5    Right: 14pt Regular, Dark-5
─────────  (Divider)
Total:     18pt Bold, Dark          Right: 20pt Bold, Primary

Spacing: 12px between rows
Divider: 1px Stroke, 12px vertical margin
```

**Add Line Item Bottom Sheet:**
```
┌─────────────────────────────────┐
│  Add Item               [✕]     │
├─────────────────────────────────┤
│  ┌───────────────────────────┐ │
│  │ 🔍 Search products...     │ │
│  └───────────────────────────┘ │
│                                 │
│  OR                             │
│                                 │
│  Description *                  │
│  ┌───────────────────────────┐ │
│  │                           │ │
│  └───────────────────────────┘ │
│                                 │
│  ┌──────────┐  ┌─────────────┐ │
│  │ Quantity │  │ Unit Price  │ │
│  │   [1]    │  │  [____]     │ │
│  └──────────┘  └─────────────┘ │
│                                 │
│  Total: XOF 0                   │
│                                 │
│  ┌─────────────────────────────┐│
│  │       Add Item             ││
│  └─────────────────────────────┘│
└─────────────────────────────────┘
```

**Behavior:**
- Tap Add Item: Show bottom sheet
- Product search: Auto-fill quantity/price
- Manual entry: Calculate total live
- Delete item: Swipe left or tap ✕
- Tax calculation: Auto-calculate based on business settings
- Next: Validate (min 1 item), navigate to Step 3

**Validation:**
- Minimum 1 line item required
- Each item needs description and price > 0
- Show error if trying to proceed without items

**API Integration:**
```
GET /api/v1/products?search=[query]
(Pre-calculate totals client-side)
```

---

### 7. Create Invoice - Step 3 (Review & Send)

**File:** `07_create_invoice_step3.png`

```
┌─────────────────────────────────┐
│  ← Review Invoice        [3/3]  │
├─────────────────────────────────┤
│  ┌───────────────────────────┐ │
│  │ Invoice Preview           │ │
│  │                           │ │
│  │ To: Acme Corporation      │ │
│  │     contact@acme.com      │ │
│  │                           │ │
│  │ Items: 2                  │ │
│  │ Total: XOF 29,500         │ │
│  └───────────────────────────┘ │
│                                 │
│  Due Date                       │
│  ┌───────────────────────────┐ │
│  │ Apr 20, 2026          [▼] │ │
│  └───────────────────────────┘ │
│                                 │
│  Payment Terms                  │
│  ┌───────────────────────────┐ │
│  │ Net 30                [▼] │ │
│  └───────────────────────────┘ │
│                                 │
│  Notes (Optional)               │
│  ┌───────────────────────────┐ │
│  │                           │ │
│  │                           │ │
│  └───────────────────────────┘ │
│                                 │
│  ┌─────────────────────────────┐│
│  │    Create Invoice          ││
│  └─────────────────────────────┘│
│                                 │
│  [< Edit Items]                 │
└─────────────────────────────────┘
```

**Layout Specifications:**

**Preview Card:**
```
Background: Primary/5
Border: 1px Primary/20
Border radius: 12px
Padding: 20px
Margin: 16px

Icon: 📄 Invoice icon, 32×32px, top
To: "Acme Corporation", 16pt Semibold, Dark
Email: "contact@acme.com", 14pt Regular, Dark-5
Items count: "Items: 2", 14pt Regular, Dark-5
Total: "XOF 29,500", 24pt Bold, Primary
```

**Dropdown Fields:**
```
Height: 48px
Background: White / Dark-2
Border: 1px Stroke
Border radius: 8px
Padding: 16px horizontal
Margin bottom: 16px

Label: 14pt Medium, Dark, 8px above
Value: 16pt Regular, Dark
Icon: Chevron down, 20×20px, right

Tap behavior: Show picker (iOS) / Dialog (Android)
```

**Notes Field:**
```
Height: 88px (multi-line)
Background: White / Dark-2
Border: 1px Stroke
Border radius: 8px
Padding: 16px
Textarea, auto-expand up to 5 lines
```

**Create Button:**
```
Background: Primary
Height: 48px
Text: "Create Invoice", 16pt Semibold, White
Loading state: Show spinner, disable interaction
```

**Edit Items Link:**
```
Text: "< Edit Items", 14pt Regular, Primary
Centered
Margin top: 16px
```

**Due Date Picker:**
```
iOS: Native wheel picker
Android: Calendar dialog

Options:
- Due on receipt
- Net 7 days
- Net 15 days
- Net 30 days
- Net 60 days
- Custom date
```

**Payment Terms Options:**
```
- Net 7
- Net 15
- Net 30 (default)
- Net 60
- Net 90
- Due on receipt
```

**Behavior:**
- Tap preview: Show full invoice preview (modal)
- Due date: Default to Net 30 (30 days from today)
- Create: Show loading, call API, navigate to success
- Edit items: Navigate back to Step 2

**API Integration:**
```
POST /api/v1/invoices
Body: {
  customerId,
  lineItems: [...],
  dueDate,
  paymentTerms,
  notes
}
Response: { success, data: { invoice } }
```

**Success Screen:**
```
┌─────────────────────────────────┐
│             ✓                   │
│                                 │
│    Invoice Created!             │
│    #INV-042                     │
│                                 │
│  ┌─────────────────────────────┐│
│  │       Share Invoice        ││
│  └─────────────────────────────┘│
│  ┌─────────────────────────────┐│
│  │       View Invoice         ││
│  └─────────────────────────────┘│
│  ┌─────────────────────────────┐│
│  │       Done                 ││
│  └─────────────────────────────┘│
└─────────────────────────────────┘

Auto-dismiss after 3s if no action
Or tap Done to return to invoice list
```

---

I'll continue with more screens. This is getting quite long - would you like me to:

1. **Continue with all 42 screens** in this document (will be very comprehensive)
2. **Create a separate document for each major section** (Auth, Invoices, Ledger, etc.)
3. **Focus on the critical screens** (top 15-20) and summarize the rest

Which approach would work best for your native development team?