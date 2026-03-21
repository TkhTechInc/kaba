# Kaba Mobile App Design Workflow
## Code to Figma → Mobile Design → React Native Implementation

**Created:** 2026-03-21
**Integration:** Claude Code + Figma (Code to Canvas)
**Target Platform:** iOS & Android (React Native)

---

## Overview

This workflow converts your existing Kaba web application into mobile app designs using the Claude Code + Figma integration, then generates production-ready React Native code.

**Benefits:**
- ✅ Reuse existing web UI as design foundation
- ✅ Maintain brand consistency (colors, typography, spacing)
- ✅ Accelerate mobile design process (weeks → days)
- ✅ Generate code directly from designs with 1:1 fidelity

---

## Phase 1: Setup (One-Time)

### Prerequisites
- [ ] Figma account (free tier works)
- [ ] Figma Desktop app installed
- [ ] Claude Code with Figma MCP configured

### A. Configure Figma MCP

**Option 1: Official Figma MCP** (Recommended for production)
```bash
# Add Figma MCP server
claude mcp add figma \
  --transport stdio \
  npx -y @figma/mcp-server-figma

# Authenticate with Figma
# Follow prompts to connect your Figma account
```

**Option 2: Talk to Figma MCP** (More features, free tier friendly)
1. Download MCP app from `mcp.metadata.co.kr`
2. Install and copy configuration command
3. Run in Claude Code:
```bash
claude mcp add talk-to-figma \
  --transport http \
  http://localhost:8080/mcp
```
4. Start server in MCP app (keep running)
5. Install "Talk to Figma MCP" plugin in Figma Desktop
6. Get channel code from plugin
7. In Claude Code: `"Connect to Figma, channel [YOUR-CODE]"`

### B. Start Local Development Server
```bash
cd /Users/vtchokponhoue/Documents/personal/kaba/frontend
npm run dev
# Server starts at http://localhost:3000
```

### C. Create Figma Mobile Design File
1. Open Figma Desktop
2. Create new design file: "Kaba Mobile App"
3. Create frames for mobile screens:
   - iPhone 14 Pro (393 × 852 px)
   - Android Large (360 × 800 px)

---

## Phase 2: Screen-by-Screen Conversion

For each major screen, follow this 4-step process:

### Step 1: Capture Web Screen → Figma
### Step 2: Adapt for Mobile
### Step 3: Generate React Native Code
### Step 4: Test & Iterate

---

## Priority Tier 1: Core User Flows (15 screens)

### Screen 1: Sign In

**Step 1: Capture**
```
In Claude Code:
"Capture the sign-in page at http://localhost:3000/auth/sign-in and send to Figma"
```

**What happens:**
- Creates editable Figma frame with sign-in form
- Preserves input fields, buttons, logos
- Maintains your color scheme and typography

**Step 2: Mobile Adaptation in Figma**
- Resize frame to 393px width (iPhone)
- Stack form elements vertically
- Increase touch target sizes (min 44px height for buttons)
- Simplify navigation (remove sidebar)
- Add mobile-specific elements:
  - "Forgot password?" link
  - Social login buttons (if applicable)
  - "Don't have an account?" link

**Design Checklist:**
- [ ] Logo visible at top
- [ ] Email/password inputs full width with 16px padding
- [ ] Primary button height ≥ 48px
- [ ] Touch targets ≥ 44px
- [ ] Error states visible
- [ ] Loading states defined

**Step 3: Generate Code**
```
In Claude Code (after Figma adjustments):
"Generate React Native code for the mobile sign-in screen from my Figma design. Use:
- React Navigation for routing
- React Native Paper for UI components
- TypeScript
- Your existing API client from /frontend/src/lib/api-client.ts
- Form validation with react-hook-form"
```

**Expected Output:**
```typescript
// screens/auth/SignInScreen.tsx
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { TextInput, Button, Text } from 'react-native-paper';
import { useForm, Controller } from 'react-hook-form';
import { apiClient } from '@/lib/api-client';

export function SignInScreen({ navigation }) {
  const { control, handleSubmit } = useForm();

  const onSubmit = async (data) => {
    // API call using existing backend
    await apiClient.post('/auth/sign-in', data);
  };

  return (
    <View style={styles.container}>
      {/* Generated UI matching Figma design */}
    </View>
  );
}
```

**Step 4: Test**
- [ ] Run on iOS simulator
- [ ] Run on Android emulator
- [ ] Test form validation
- [ ] Test error states
- [ ] Test successful login flow

---

### Screen 2: Dashboard (Home)

**Step 1: Capture**
```
"Capture the dashboard at http://localhost:3000 and send to Figma"
```

**Step 2: Mobile Adaptation**

**Web → Mobile Changes:**
1. **Sidebar Navigation** → Bottom Tab Bar
   - Keep 5 main tabs: Home, Invoices, Ledger, Products, More
   - Use icons from your existing `overview-cards/icons.tsx`

2. **Overview Cards Layout**
   - Web: 4 cards in grid (2×2)
   - Mobile: Horizontal scroll or vertical stack
   - Reduce card height: 120px → 80px

3. **Recent Transactions**
   - Simplify list items
   - Show: date, description, amount only
   - Remove extra columns (category, type)

4. **Chart Widgets**
   - Reduce chart height: 400px → 250px
   - Show 1 chart per screen (swipeable carousel)

**Design Checklist:**
- [ ] Bottom tab bar with icons
- [ ] Overview cards scrollable horizontally
- [ ] Quick action button (FAB) for "New Invoice"
- [ ] Pull-to-refresh gesture
- [ ] Skeleton loading states

**Step 3: Generate Code**
```
"Generate React Native code for the mobile dashboard. Include:
- Bottom tab navigation (React Navigation)
- Horizontal ScrollView for overview cards
- Chart component using react-native-chart-kit
- Pull-to-refresh with RefreshControl
- Use existing data fetching hooks from /frontend/src/hooks"
```

**Step 4: Test**
- [ ] Tab navigation works
- [ ] Cards scroll smoothly
- [ ] Charts render correctly
- [ ] Pull-to-refresh updates data
- [ ] FAB opens invoice creation

---

### Screen 3: Invoice List

**Step 1: Capture**
```
"Capture the invoice list at http://localhost:3000/invoices and send to Figma"
```

**Step 2: Mobile Adaptation**

**Web → Mobile Changes:**
1. **Table View** → List View
   - Remove table headers
   - Convert rows to card-style list items

2. **List Item Design** (each invoice)
   ```
   ┌─────────────────────────────┐
   │ #INV-001         $1,250.00 │
   │ Acme Corp              PAID │
   │ Mar 21, 2026               │
   └─────────────────────────────┘
   ```

3. **Filters**
   - Web: Dropdown filters in header
   - Mobile: Bottom sheet with filter options
   - Add filter chip indicators

4. **Search**
   - Sticky search bar at top
   - Auto-focus on scroll to top

**Design Checklist:**
- [ ] Swipe actions: Left (Archive), Right (Mark Paid)
- [ ] Status badges: Paid (green), Pending (yellow), Overdue (red)
- [ ] Tap to view detail
- [ ] FAB for "New Invoice"
- [ ] Filter bottom sheet
- [ ] Empty state: "No invoices yet"

**Step 3: Generate Code**
```
"Generate React Native invoice list screen with:
- FlatList with pull-to-refresh
- Swipeable list items (react-native-gesture-handler)
- Bottom sheet for filters (@gorhom/bottom-sheet)
- Search bar
- Status badges
- Navigation to invoice detail
- Cursor-based pagination (use existing backend endpoint)"
```

---

### Screen 4: Invoice Detail

**Step 1: Capture**
```
"Capture invoice detail at http://localhost:3000/invoices/[id] and send to Figma"
```

**Step 2: Mobile Adaptation**

**Layout Structure:**
```
┌─────────────────────────────┐
│ ← Invoice #INV-001          │ Header (sticky)
├─────────────────────────────┤
│ Status: PAID                │
│ Customer: Acme Corp         │ Customer Info
│ Date: Mar 21, 2026          │
├─────────────────────────────┤
│ Line Items                  │
│ Item 1           $500.00    │ Scrollable
│ Item 2           $750.00    │ Content
│                             │
│ Subtotal        $1,250.00   │
│ Tax              $125.00    │
│ Total          $1,375.00    │
├─────────────────────────────┤
│ [Share] [Download] [Edit]   │ Action Bar (sticky)
└─────────────────────────────┘
```

**Design Checklist:**
- [ ] Sticky header with back button
- [ ] Status badge at top
- [ ] Customer info card
- [ ] Line items list
- [ ] Totals summary
- [ ] Action buttons at bottom
- [ ] Share sheet integration
- [ ] PDF preview/download

**Step 3: Generate Code**
```
"Generate React Native invoice detail screen with:
- ScrollView with sticky header
- Status badge component
- Line items FlatList
- Action buttons: Share (native share), Download PDF, Edit
- Use existing invoice model from /backend/src/domains/invoicing/models/Invoice.ts
- PDF generation with react-native-html-to-pdf"
```

---

### Screen 5: Create Invoice

**Step 1: Capture**
```
"Capture invoice creation at http://localhost:3000/invoices/new and send to Figma"
```

**Step 2: Mobile Adaptation**

**Multi-Step Form:**

**Step 1: Customer Selection**
```
┌─────────────────────────────┐
│ ← New Invoice               │
│                             │
│ Select Customer             │
│ [Search customers...]       │
│                             │
│ Recent Customers            │
│ → Acme Corp                 │
│ → Beta Inc                  │
│ → Gamma LLC                 │
│                             │
│ [+ Add New Customer]        │
│                             │
│        [Next →]             │
└─────────────────────────────┘
```

**Step 2: Line Items**
```
┌─────────────────────────────┐
│ ← New Invoice               │
│                             │
│ Line Items                  │
│                             │
│ Item 1                      │
│ [Product/Service]           │
│ Qty: 1    Price: $500       │
│ [× Remove]                  │
│                             │
│ [+ Add Line Item]           │
│                             │
│ Subtotal: $500.00           │
│                             │
│     [← Back]  [Next →]      │
└─────────────────────────────┘
```

**Step 3: Review & Send**
```
┌─────────────────────────────┐
│ ← New Invoice               │
│                             │
│ Review                      │
│                             │
│ Customer: Acme Corp         │
│ Items: 2                    │
│ Total: $1,375.00            │
│                             │
│ Due Date: [Select]          │
│ Payment Terms: [Net 30]     │
│ Notes: [Optional]           │
│                             │
│     [← Back]  [Create]      │
└─────────────────────────────┘
```

**Design Checklist:**
- [ ] Progress indicator (1/3, 2/3, 3/3)
- [ ] Customer autocomplete
- [ ] Line item dynamic form
- [ ] Product search/selection
- [ ] Price calculator
- [ ] Date picker for due date
- [ ] Payment terms dropdown
- [ ] Notes textarea
- [ ] Validation errors inline

**Step 3: Generate Code**
```
"Generate React Native multi-step invoice creation form with:
- Tab navigator for 3 steps
- Customer selection with search (use existing CustomerSelect logic)
- Dynamic line items form (add/remove)
- Product picker modal
- Date picker (@react-native-community/datetimepicker)
- Form state management (react-hook-form)
- Validation using existing CreateInvoiceInput schema
- API integration with existing POST /api/v1/invoices endpoint"
```

---

### Screen 6: Ledger (Transaction List)

**Step 1: Capture**
```
"Capture ledger at http://localhost:3000/ledger and send to Figma"
```

**Step 2: Mobile Adaptation**

**List Item Design:**
```
┌─────────────────────────────┐
│ Office Supplies    -$150.00 │ Expense (red)
│ Expense • Mar 21            │
├─────────────────────────────┤
│ Invoice #001      +$1,250.00│ Sale (green)
│ Sale • Mar 20               │
├─────────────────────────────┤
│ Filter: All | Date: This Mo │ Filter chips
└─────────────────────────────┘
```

**Design Checklist:**
- [ ] Income (green +) vs Expense (red -)
- [ ] Category icons
- [ ] Date grouping headers
- [ ] Filter chips: Type, Category, Date range
- [ ] Bottom sheet for advanced filters
- [ ] FAB for "Add Entry"
- [ ] Running balance indicator

**Step 3: Generate Code**
```
"Generate React Native ledger screen with:
- SectionList grouped by date
- Color-coded amounts (green/red)
- Filter chips (type, category, date)
- Bottom sheet filter modal
- Running balance calculation
- Infinite scroll with cursor pagination
- Use existing LedgerRepository pagination"
```

---

### Screen 7: Add Ledger Entry

**Step 1: Capture**
```
"Capture add entry at http://localhost:3000/ledger/entries/new and send to Figma"
```

**Step 2: Mobile Adaptation**

**Form Layout:**
```
┌─────────────────────────────┐
│ ← Add Entry                 │
│                             │
│ Type                        │
│ ○ Sale    ● Expense         │ Radio buttons
│                             │
│ Amount                      │
│ [1,250.00] XOF             │ Number input
│                             │
│ Category                    │
│ [Select category ▼]        │ Dropdown
│                             │
│ Description                 │
│ [Office supplies...]       │ Text input
│                             │
│ Date                        │
│ [Mar 21, 2026]             │ Date picker
│                             │
│ Receipt (optional)          │
│ [📷 Scan Receipt]          │ Camera/gallery
│                             │
│          [Save]             │
└─────────────────────────────┘
```

**Design Checklist:**
- [ ] Type selector (Sale/Expense)
- [ ] Currency input with proper formatting
- [ ] Category picker with icons
- [ ] Receipt camera/gallery upload
- [ ] Date picker
- [ ] Validation: amount > 0, category required
- [ ] Success feedback

**Step 3: Generate Code**
```
"Generate React Native add ledger entry form with:
- Type radio buttons
- Formatted currency input
- Category picker modal
- Camera integration (expo-camera or react-native-image-picker)
- Receipt upload (expo-image-picker)
- Date picker
- Form validation
- API integration with existing POST /api/v1/ledger/entries endpoint"
```

---

## Priority Tier 2: Business Operations (9 screens)

### Screen 8: Products List
### Screen 9: Add Product
### Screen 10: Customers List
### Screen 11: Add Customer
### Screen 12: Reports Overview
### Screen 13: P&L Report
### Screen 14: Cash Flow Report
### Screen 15: Payroll Dashboard
### Screen 16: Employees List

*(Follow same 4-step process for each)*

---

## Priority Tier 3: Settings & Admin (6 screens)

### Screen 17: Settings Hub
### Screen 18: Profile Settings
### Screen 19: Team Management
### Screen 20: Webhooks
### Screen 21: API Keys
### Screen 22: Preferences

---

## Phase 3: Mobile-Specific Features

### Additional Screens (Not in Web App)

**1. Mobile Onboarding**
- Welcome carousel (3 screens)
- Quick tour of features
- Permission requests (notifications, camera)

**2. Notifications Center**
- Push notification list
- Invoice payment reminders
- Low stock alerts

**3. Offline Mode**
- Offline indicator
- Sync status
- Queue of pending actions

**4. Quick Actions (iOS Widget)**
- Today's sales total
- Pending invoices count
- Quick "Add Sale" button

---

## Phase 4: Code Generation Best Practices

### Standard Prompt Template

```
Generate React Native code for [SCREEN_NAME] with the following requirements:

DESIGN SOURCE:
- Figma file: "Kaba Mobile App"
- Frame: "[FRAME_NAME]"
- Target fidelity: 1:1 match with Figma design

TECH STACK:
- React Native 0.73+
- TypeScript
- React Navigation 6.x
- React Native Paper (UI components)
- React Hook Form (forms)
- TanStack Query (data fetching)

BACKEND INTEGRATION:
- API base URL: Use existing config from /frontend/src/lib/api-client.ts
- Endpoints: [LIST_ENDPOINTS]
- Models: Import from /backend/src/domains/[DOMAIN]/models/[Model].ts

UI REQUIREMENTS:
- Match Figma spacing, colors, typography exactly
- Use theme tokens from Figma variables
- Implement loading states (skeleton)
- Implement error states
- Implement empty states
- Add accessibility labels (accessibilityLabel, accessibilityHint)

FUNCTIONALITY:
- [LIST_KEY_FEATURES]
- Form validation using react-hook-form
- Error handling with user-friendly messages
- Success feedback (toast/snackbar)

PERFORMANCE:
- Use React.memo for list items
- Implement virtualization for long lists (FlatList)
- Optimize images with react-native-fast-image
- Lazy load heavy components

TESTING:
- Include PropTypes or TypeScript interfaces
- Add example usage in comments
```

---

## Phase 5: Testing & Iteration

### A. Visual QA Checklist

For each screen:
- [ ] **Spacing**: Matches Figma exactly (8px grid)
- [ ] **Typography**: Font sizes, weights, line heights match
- [ ] **Colors**: Use design tokens, no hardcoded hex values
- [ ] **Icons**: Use consistent icon set (react-native-vector-icons)
- [ ] **Touch Targets**: Minimum 44x44 pts
- [ ] **Animations**: Smooth 60fps transitions
- [ ] **Loading States**: Skeleton screens, not just spinners
- [ ] **Error States**: Clear error messages, retry actions
- [ ] **Empty States**: Illustrations + call-to-action

### B. Functional Testing

- [ ] **Navigation**: All transitions work, deep linking
- [ ] **Forms**: Validation, error display, success feedback
- [ ] **API Integration**: Correct endpoints, error handling
- [ ] **Offline Mode**: Graceful degradation, sync when online
- [ ] **Push Notifications**: Receive, tap to navigate
- [ ] **Camera/Gallery**: Permission handling, image upload
- [ ] **PDF Generation**: Invoice PDFs match web version

### C. Device Testing Matrix

| Device Type | iOS | Android |
|-------------|-----|---------|
| Small Phone | iPhone SE (375px) | Pixel 4a (360px) |
| Medium Phone | iPhone 14 (390px) | Pixel 6 (393px) |
| Large Phone | iPhone 14 Pro Max (430px) | Samsung S22+ (412px) |
| Tablet | iPad Mini (768px) | Galaxy Tab (800px) |

### D. Performance Benchmarks

- [ ] App launch: < 2 seconds
- [ ] Screen transitions: < 300ms
- [ ] List scrolling: 60fps (no jank)
- [ ] Form submission: Feedback within 100ms
- [ ] Image loading: Progressive (blur → sharp)

---

## Phase 6: Deployment Preparation

### A. App Store Assets

**Screenshots (Required for both iOS & Android)**
1. Sign In Screen
2. Dashboard
3. Invoice List
4. Invoice Detail
5. Create Invoice Flow

**App Store Metadata:**
```
Name: Kaba - Business Management
Subtitle: Invoicing, Accounting & Reports
Description: [Generate based on web app features]
Keywords: invoice, accounting, ledger, business, OHADA, West Africa
Category: Business
```

### B. Build Configuration

**iOS (Xcode)**
```bash
cd ios
pod install
cd ..
npx react-native run-ios --configuration Release
```

**Android (Gradle)**
```bash
cd android
./gradlew assembleRelease
```

### C. App Store Submission Checklist

**iOS App Store:**
- [ ] App Store Connect account created
- [ ] Bundle ID configured: `com.kaba.mobile`
- [ ] App Store icon (1024x1024)
- [ ] Screenshots (all required sizes)
- [ ] Privacy policy URL
- [ ] Support URL
- [ ] App Store review notes

**Google Play Store:**
- [ ] Google Play Console account
- [ ] App signing key generated
- [ ] Feature graphic (1024x500)
- [ ] Screenshots (all required sizes)
- [ ] Privacy policy URL
- [ ] Data safety form completed

---

## Appendix: Resources

### A. Figma Design System

Create these in Figma before starting:

**1. Color Palette**
```
Primary: #3B82F6 (Blue)
Secondary: #10B981 (Green)
Error: #EF4444 (Red)
Warning: #F59E0B (Amber)
Background: #FFFFFF
Surface: #F9FAFB
Text Primary: #111827
Text Secondary: #6B7280
```

**2. Typography Scale**
```
H1: 32px / Bold / Line 40px
H2: 24px / Bold / Line 32px
H3: 20px / SemiBold / Line 28px
Body: 16px / Regular / Line 24px
Caption: 14px / Regular / Line 20px
Label: 12px / Medium / Line 16px
```

**3. Spacing System**
```
4px, 8px, 12px, 16px, 24px, 32px, 48px, 64px
```

**4. Components Library**
- Buttons (Primary, Secondary, Text)
- Input Fields (Text, Number, Date)
- Cards (List Item, Summary)
- Badges (Status indicators)
- Bottom Sheets
- Navigation (Tab Bar, Header)

### B. React Native Project Structure

```
kaba-mobile/
├── src/
│   ├── screens/           # Screen components
│   │   ├── auth/
│   │   ├── dashboard/
│   │   ├── invoices/
│   │   ├── ledger/
│   │   └── settings/
│   ├── components/        # Reusable components
│   │   ├── ui/           # UI primitives
│   │   ├── forms/        # Form components
│   │   └── shared/       # Shared components
│   ├── navigation/        # Navigation config
│   ├── lib/              # API client, utilities
│   ├── hooks/            # Custom hooks
│   ├── theme/            # Design tokens
│   └── types/            # TypeScript types
├── ios/                  # iOS native code
├── android/              # Android native code
└── package.json
```

### C. Key Dependencies

```json
{
  "dependencies": {
    "react": "18.2.0",
    "react-native": "0.73.0",
    "@react-navigation/native": "^6.1.9",
    "@react-navigation/bottom-tabs": "^6.5.11",
    "@react-navigation/stack": "^6.3.20",
    "react-native-paper": "^5.11.3",
    "react-hook-form": "^7.49.2",
    "@tanstack/react-query": "^5.17.9",
    "axios": "^1.6.5",
    "react-native-vector-icons": "^10.0.3",
    "@gorhom/bottom-sheet": "^4.5.1",
    "react-native-gesture-handler": "^2.14.1",
    "react-native-reanimated": "^3.6.1",
    "expo-image-picker": "^14.7.1",
    "react-native-html-to-pdf": "^0.12.0"
  }
}
```

---

## Next Steps

1. **Complete Setup** (Task #7)
   - Configure Figma MCP
   - Create "Kaba Mobile App" Figma file
   - Set up mobile design frames

2. **Start with Priority Tier 1** (Task #10)
   - Capture Sign In screen
   - Adapt for mobile in Figma
   - Generate React Native code
   - Test on simulator

3. **Iterate Through All Screens**
   - Follow 4-step process for each screen
   - Build screen by screen
   - Test continuously

4. **Final Polish**
   - Visual QA all screens
   - Performance optimization
   - Submit to app stores

---

**Questions? Ask Claude Code:**
- "Show me how to capture [screen] to Figma"
- "Generate React Native code for [component]"
- "Help me debug [issue] in the mobile app"
- "Optimize performance for [screen]"

**Ready to start? Say:**
"Let's capture the sign-in screen and create the mobile version"
