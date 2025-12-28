# Awkaf Payment Kiosk - Technical Documentation

**Version:** 1.0  
**Last Updated:** December 2024  
**Platform:** React + Capacitor (Android APK)

---

## Table of Contents

1. [System Architecture Overview](#1-system-architecture-overview)
2. [Hardware POS Integration (OM-A880)](#2-hardware-pos-integration-om-a880)
3. [Soft POS Integration (Thawani)](#3-soft-pos-integration-thawani)
4. [Database Schema](#4-database-schema)
5. [API & Edge Functions](#5-api--edge-functions)
6. [Deployment & Setup](#6-deployment--setup)
7. [Kiosk Flow & User Journey](#7-kiosk-flow--user-journey)
8. [Admin Panel](#8-admin-panel)
9. [Troubleshooting](#9-troubleshooting)

---

## 1. System Architecture Overview

### 1.1 Technology Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, TypeScript, Vite |
| UI Framework | Tailwind CSS, shadcn/ui |
| State Management | TanStack Query (React Query) |
| Backend | Supabase (Lovable Cloud) |
| Database | PostgreSQL (via Supabase) |
| Edge Functions | Deno (Supabase Edge Functions) |
| Mobile Runtime | Capacitor 7.x |
| Payment Hardware | OM-A880 EFT-POS (USB Serial) |
| Soft POS | Thawani Lamsa SDK |

### 1.2 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        KIOSK DEVICE                             │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    Android APK                            │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │  │
│  │  │   React UI  │  │  Capacitor  │  │  Native Plugins │  │  │
│  │  │  Components │  │   Bridge    │  │   (USB Serial)  │  │  │
│  │  └─────────────┘  └─────────────┘  └─────────────────┘  │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              │                                   │
│                              ▼                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    Payment Layer                          │  │
│  │  ┌─────────────────┐        ┌─────────────────────────┐  │  │
│  │  │   Hard POS      │        │      Soft POS           │  │  │
│  │  │   (OM-A880)     │        │   (Thawani Lamsa)       │  │  │
│  │  │   USB Serial    │        │      NFC SDK            │  │  │
│  │  └─────────────────┘        └─────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼ HTTPS
┌─────────────────────────────────────────────────────────────────┐
│                      SUPABASE CLOUD                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌────────────────┐  │
│  │   PostgreSQL    │  │ Edge Functions  │  │    Storage     │  │
│  │   Database      │  │  (Deno)         │  │   (Buckets)    │  │
│  └─────────────────┘  └─────────────────┘  └────────────────┘  │
│  ┌─────────────────┐  ┌─────────────────┐                      │
│  │  Realtime       │  │     Auth        │                      │
│  │  Subscriptions  │  │   (JWT/RLS)     │                      │
│  └─────────────────┘  └─────────────────┘                      │
└─────────────────────────────────────────────────────────────────┘
```

### 1.3 Project Structure

```
src/
├── components/
│   ├── admin/          # Admin panel components
│   ├── kiosk/          # Kiosk-specific UI components
│   ├── shared/         # Shared components (NetworkStatus, etc.)
│   └── ui/             # shadcn/ui components
├── contexts/           # React contexts (Theme, etc.)
├── hooks/              # Custom React hooks
├── pages/
│   ├── admin/          # Admin dashboard pages
│   ├── auth/           # Authentication pages
│   └── kiosk/          # Kiosk flow pages
├── services/           # Business logic & external integrations
│   ├── ecrFraming.ts          # ECR protocol framing (STX/ETX/LRC)
│   ├── ecrProtocol.ts         # ECR XML command builders
│   ├── hardPosService.ts      # Hardware POS orchestration
│   ├── softPosService.ts      # Thawani Soft POS service
│   ├── usbSerialPlugin.ts     # USB serial Capacitor plugin wrapper
│   ├── thawaniLamsaPlugin.ts  # Thawani Lamsa SDK bridge
│   └── offlineQueueService.ts # Offline transaction queue
├── integrations/
│   └── supabase/       # Auto-generated Supabase client & types
└── utils/              # Utility functions (sounds, etc.)

supabase/
├── config.toml         # Supabase configuration
├── functions/
│   ├── create-admin/   # Admin user creation
│   ├── process-payment/# Payment processing
│   ├── send-sms/       # SMS notification
│   └── manage-softpos-secret/ # Soft POS secret management
└── migrations/         # Database migrations (read-only)
```

---

## 2. Hardware POS Integration (OM-A880)

### 2.1 Overview

The OM-A880 is an EFT-POS terminal that communicates via **USB Serial** using the **ECR (Electronic Cash Register) XML Protocol**.

### 2.2 Connection Requirements

| Parameter | Value |
|-----------|-------|
| Interface | USB Serial (OTG) |
| Baud Rate | 2400 |
| Data Bits | 8 |
| Stop Bits | 1 |
| Parity | None |
| Flow Control | None |

### 2.3 Android Manifest Requirements

```xml
<!-- AndroidManifest.xml -->
<manifest>
    <uses-feature android:name="android.hardware.usb.host" android:required="true" />
    
    <application>
        <activity>
            <intent-filter>
                <action android:name="android.hardware.usb.action.USB_DEVICE_ATTACHED" />
            </intent-filter>
            <meta-data 
                android:name="android.hardware.usb.action.USB_DEVICE_ATTACHED"
                android:resource="@xml/device_filter" />
        </activity>
    </application>
</manifest>
```

```xml
<!-- res/xml/device_filter.xml -->
<resources>
    <usb-device vendor-id="1659" /> <!-- OM-A880 Vendor ID -->
</resources>
```

### 2.4 ECR Protocol Framing

Every command sent to the POS **MUST** be framed as follows:

```
┌─────┬─────────────────────────┬─────┬─────┐
│ STX │     XML Payload         │ ETX │ LRC │
│0x02 │ <EFTData>...</EFTData>  │0x03 │     │
└─────┴─────────────────────────┴─────┴─────┘
```

#### LRC Calculation

```typescript
// src/services/ecrFraming.ts
export function calculateLRC(data: Uint8Array): number {
  let lrc = 0;
  for (let i = 0; i < data.length; i++) {
    lrc ^= data[i];
  }
  return lrc;
}

export function frameECRCommand(xmlPayload: string): Uint8Array {
  const STX = 0x02;
  const ETX = 0x03;
  
  const encoder = new TextEncoder();
  const xmlBytes = encoder.encode(xmlPayload);
  
  // LRC = XOR of all bytes from XML start to ETX (inclusive)
  const dataForLRC = new Uint8Array(xmlBytes.length + 1);
  dataForLRC.set(xmlBytes);
  dataForLRC[xmlBytes.length] = ETX;
  const lrc = calculateLRC(dataForLRC);
  
  // Final frame: STX + XML + ETX + LRC
  const frame = new Uint8Array(1 + xmlBytes.length + 1 + 1);
  frame[0] = STX;
  frame.set(xmlBytes, 1);
  frame[1 + xmlBytes.length] = ETX;
  frame[1 + xmlBytes.length + 1] = lrc;
  
  return frame;
}
```

### 2.5 Command Types

| Command | Code | Description |
|---------|------|-------------|
| GetTerminalInfo | 100 | Get terminal status (MUST call first) |
| Purchase | 101 | Initiate payment transaction |
| LastTransactionStatus | 102 | Check last transaction result |
| Void | 103 | Void a transaction |
| Reversal | 104 | Reverse a transaction |

### 2.6 XML Command Structure

```xml
<!-- GetTerminalInfo (Command 100) -->
<EFTData>
  <TransactionData>
    <CommandType>100</CommandType>
    <PaymentType>0</PaymentType>
    <POSReferenceNo>REF123</POSReferenceNo>
  </TransactionData>
</EFTData>

<!-- Purchase (Command 101) -->
<EFTData>
  <TransactionData>
    <CommandType>101</CommandType>
    <PaymentType>0</PaymentType>
    <TransactionAmount>1050</TransactionAmount>  <!-- 10.50 OMR = 1050 -->
    <POSReferenceNo>TXN456</POSReferenceNo>
    <CurrencyCode>512</CurrencyCode>  <!-- OMR -->
  </TransactionData>
</EFTData>
```

### 2.7 Communication Flow

```
┌─────────┐                    ┌─────────┐
│  KIOSK  │                    │   POS   │
└────┬────┘                    └────┬────┘
     │                              │
     │  1. GetTerminalInfo (100)    │
     │─────────────────────────────►│
     │                              │
     │  2. ACK (0x06)               │
     │◄─────────────────────────────│
     │                              │
     │  3. Terminal Info Response   │
     │◄─────────────────────────────│
     │                              │
     │  4. ACK (0x06)               │
     │─────────────────────────────►│
     │                              │
     │  5. Purchase (101)           │
     │─────────────────────────────►│
     │                              │
     │  6. ACK (0x06)               │
     │◄─────────────────────────────│
     │                              │
     │  7. Event: INSERT CARD       │
     │◄─────────────────────────────│
     │                              │
     │  8. ACK (0x06)               │
     │─────────────────────────────►│
     │                              │
     │  9. Event: ENTER PIN         │
     │◄─────────────────────────────│
     │                              │
     │  10. ACK (0x06)              │
     │─────────────────────────────►│
     │                              │
     │  11. Event: PROCESSING       │
     │◄─────────────────────────────│
     │                              │
     │  12. ACK (0x06)              │
     │─────────────────────────────►│
     │                              │
     │  13. Final Response          │
     │◄─────────────────────────────│
     │                              │
     │  14. ACK (0x06)              │
     │─────────────────────────────►│
     │                              │
```

### 2.8 Response Codes

| Code | Meaning |
|------|---------|
| 00 | Approved |
| 01 | Refer to Issuer |
| 05 | Do Not Honor |
| 12 | Invalid Transaction |
| 14 | Invalid Card Number |
| 51 | Insufficient Funds |
| 54 | Expired Card |
| 55 | Incorrect PIN |
| 91 | Issuer Not Available |

### 2.9 Key Implementation Files

| File | Purpose |
|------|---------|
| `src/services/ecrFraming.ts` | STX/ETX/LRC framing, ACK/NAK handling |
| `src/services/ecrProtocol.ts` | XML command builders |
| `src/services/usbSerialPlugin.ts` | Capacitor USB serial plugin wrapper |
| `src/services/hardPosService.ts` | High-level POS orchestration |
| `src/pages/kiosk/POSDiagnosticsPage.tsx` | USB diagnostics & testing UI |

---

## 3. Soft POS Integration (Thawani)

### 3.1 Overview

Thawani Lamsa SDK enables NFC tap-to-pay directly on the Android device without external hardware.

### 3.2 Configuration

Stored in `kiosk_settings.soft_pos_config`:

```typescript
interface SoftPOSConfig {
  mode: 'mock' | 'sdk';           // mock = trial, sdk = production
  environment: 'uat' | 'prod';    // Thawani environment
  tajer_token: string;            // Merchant token
}
```

### 3.3 SDK Integration

```typescript
// src/services/thawaniLamsaPlugin.ts
export interface ThawaniPaymentRequest {
  amount: number;        // In baisas (1 OMR = 1000 baisas)
  reference: string;     // Transaction reference
  description?: string;  // Optional description
}

export interface ThawaniPaymentResult {
  success: boolean;
  transactionId?: string;
  authCode?: string;
  rrn?: string;
  cardLast4?: string;
  errorCode?: string;
  errorMessage?: string;
}
```

### 3.4 Payment Flow

```
┌──────────────┐     ┌─────────────┐     ┌─────────────┐
│  Kiosk App   │────►│ Lamsa SDK   │────►│  Thawani    │
│              │     │  (NFC)      │     │   Gateway   │
└──────────────┘     └─────────────┘     └─────────────┘
       │                    │                    │
       │  1. initPayment()  │                    │
       │───────────────────►│                    │
       │                    │                    │
       │  2. Show Tap UI    │                    │
       │◄───────────────────│                    │
       │                    │                    │
       │  3. Card Detected  │                    │
       │◄───────────────────│                    │
       │                    │                    │
       │                    │  4. Auth Request   │
       │                    │───────────────────►│
       │                    │                    │
       │                    │  5. Auth Response  │
       │                    │◄───────────────────│
       │                    │                    │
       │  6. Result         │                    │
       │◄───────────────────│                    │
       │                    │                    │
```

### 3.5 Trial Mode (Mock)

When `soft_pos_config.mode = 'mock'`:
- Full-screen branded "Tap Card" UI is shown
- Simulates card detection after 3 seconds
- Returns mock successful transaction
- All transactions marked as "TRIAL MODE"

---

## 4. Database Schema

### 4.1 Entity Relationship Diagram

```
┌─────────────────┐     ┌─────────────────┐
│     profiles    │     │   user_roles    │
├─────────────────┤     ├─────────────────┤
│ id (PK, FK)     │◄───►│ user_id (FK)    │
│ email           │     │ role (enum)     │
│ full_name       │     │ created_at      │
│ mobile_number   │     └─────────────────┘
│ first_login     │
└─────────────────┘
         
┌─────────────────┐     ┌─────────────────┐
│     kiosks      │     │  transactions   │
├─────────────────┤     ├─────────────────┤
│ id (PK)         │◄───►│ kiosk_id (FK)   │
│ name            │     │ category        │
│ location        │     │ amount_baisas   │
│ status          │     │ status          │
│ configuration   │     │ pos_response    │
│ reference_number│     │ mobile_number   │
│ last_heartbeat  │     │ reference_number│
└─────────────────┘     │ pos_rrn         │
                        │ pos_auth_code   │
                        └─────────────────┘

┌─────────────────┐     ┌─────────────────┐
│ kiosk_settings  │     │donation_category│
├─────────────────┤     ├─────────────────┤
│ id (PK)         │     │ id (PK)         │
│ pos_type        │     │ category_id     │
│ soft_pos_config │     │ title           │
│ logo_url        │     │ description     │
│ background_url  │     │ display_order   │
│ quranic_verse   │     │ icon_url        │
└─────────────────┘     │ is_visible      │
                        │ category_ref    │
                        └─────────────────┘

┌─────────────────┐     ┌─────────────────┐
│  sms_settings   │     │offline_tx_queue │
├─────────────────┤     ├─────────────────┤
│ api_endpoint    │     │ id (PK)         │
│ api_username    │     │ transaction_data│
│ api_password    │     │ status          │
│ sender_id       │     │ retry_count     │
└─────────────────┘     │ kiosk_id (FK)   │
                        └─────────────────┘
```

### 4.2 Key Tables

#### `transactions`

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `kiosk_id` | UUID | Foreign key to kiosks |
| `category` | ENUM | donation, zakat, sadaqah, general |
| `amount_baisas` | INTEGER | Amount in baisas (1 OMR = 1000) |
| `status` | ENUM | pending, processing, completed, failed, cancelled |
| `mobile_number` | TEXT | Customer phone for SMS receipt |
| `reference_number` | TEXT | Auto-generated TXN reference |
| `pos_rrn` | TEXT | POS Retrieval Reference Number |
| `pos_auth_code` | TEXT | POS Authorization Code |
| `pos_tid` | TEXT | Terminal ID |
| `pos_mid` | TEXT | Merchant ID |
| `pos_response_code` | TEXT | Response code (00 = approved) |
| `pos_response` | JSONB | Full POS response payload |

#### `kiosk_settings`

| Column | Type | Description |
|--------|------|-------------|
| `pos_type` | TEXT | 'hard_pos' or 'soft_pos' |
| `soft_pos_config` | JSONB | `{mode, environment, tajer_token}` |
| `logo_url` | TEXT | Organization logo URL |
| `background_image_url` | TEXT | Kiosk background URL |
| `quranic_verse` | TEXT | Display verse on home screen |

### 4.3 Row Level Security (RLS)

All tables have RLS enabled. Key policies:

```sql
-- Transactions: Anyone can INSERT (kiosk), Admins can SELECT/UPDATE
CREATE POLICY "Kiosks can create transactions" ON transactions
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins can view all transactions" ON transactions
  FOR SELECT USING (has_role(auth.uid(), 'admin'));

-- Kiosk Settings: Anyone can SELECT, Admins can UPDATE
CREATE POLICY "Anyone can view kiosk settings" ON kiosk_settings
  FOR SELECT USING (true);

CREATE POLICY "Admins can update kiosk settings" ON kiosk_settings
  FOR UPDATE USING (has_role(auth.uid(), 'admin'));
```

### 4.4 Database Functions

```sql
-- Auto-generate transaction reference number
CREATE FUNCTION generate_reference_number() RETURNS TEXT AS $$
DECLARE ref_number TEXT;
BEGIN
  LOOP
    ref_number := 'TXN' || upper(substring(md5(random()::text) from 1 for 9));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM transactions WHERE reference_number = ref_number);
  END LOOP;
  RETURN ref_number;
END;
$$ LANGUAGE plpgsql;

-- Check user role
CREATE FUNCTION has_role(_user_id UUID, _role app_role) RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = _user_id AND role = _role
  );
$$ LANGUAGE sql SECURITY DEFINER;
```

---

## 5. API & Edge Functions

### 5.1 Overview

| Function | Path | Description |
|----------|------|-------------|
| `create-admin` | `/functions/v1/create-admin` | Create new admin user |
| `process-payment` | `/functions/v1/process-payment` | Process payment transaction |
| `send-sms` | `/functions/v1/send-sms` | Send SMS receipt notification |
| `manage-softpos-secret` | `/functions/v1/manage-softpos-secret` | Manage Soft POS secrets |

### 5.2 create-admin

Creates a new admin user with profile and role assignment.

**Request:**
```json
{
  "email": "admin@example.com",
  "password": "securePassword123",
  "fullName": "John Admin",
  "role": "admin"
}
```

**Response:**
```json
{
  "success": true,
  "userId": "uuid",
  "message": "Admin created successfully"
}
```

### 5.3 process-payment

Records a completed payment transaction.

**Request:**
```json
{
  "kioskId": "uuid",
  "category": "zakat",
  "amountBaisas": 10000,
  "mobileNumber": "+96812345678",
  "posResponse": {
    "rrn": "123456789012",
    "authCode": "ABC123",
    "responseCode": "00"
  }
}
```

**Response:**
```json
{
  "success": true,
  "transactionId": "uuid",
  "referenceNumber": "TXN12345ABCD"
}
```

### 5.4 send-sms

Sends SMS receipt to customer.

**Request:**
```json
{
  "phoneNumber": "+96812345678",
  "message": "Your donation of 10.000 OMR has been received. Reference: TXN12345ABCD"
}
```

**Response:**
```json
{
  "success": true,
  "messageId": "sms-message-id"
}
```

### 5.5 Calling Edge Functions from Client

```typescript
import { supabase } from "@/integrations/supabase/client";

// Call edge function
const { data, error } = await supabase.functions.invoke('process-payment', {
  body: {
    kioskId: '...',
    category: 'zakat',
    amountBaisas: 10000
  }
});
```

---

## 6. Deployment & Setup

### 6.1 Prerequisites

- Node.js 18+
- Android Studio (for APK building)
- USB OTG cable (for Hardware POS)
- OM-A880 POS terminal (configured in ECR/Interface mode)

### 6.2 Development Setup

```bash
# Clone repository
git clone <repository-url>
cd awkaf-payment-kiosk

# Install dependencies
npm install

# Start development server
npm run dev
```

### 6.3 Building Android APK

```bash
# 1. Build web assets
npm run build

# 2. Sync Capacitor
npx cap sync android

# 3. Open in Android Studio
npx cap open android

# 4. Build APK from Android Studio
# Build → Build Bundle(s) / APK(s) → Build APK(s)
```

### 6.4 GitHub Actions Build

The project includes automated APK building via GitHub Actions:

```yaml
# .github/workflows/build-android.yml
name: Build Android APK

on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - uses: actions/setup-java@v4
      - run: npm ci
      - run: npm run build
      - run: npx cap sync android
      - run: cd android && ./gradlew assembleDebug
      - uses: actions/upload-artifact@v4
        with:
          name: app-debug.apk
          path: android/app/build/outputs/apk/debug/app-debug.apk
```

### 6.5 Capacitor Configuration

```typescript
// capacitor.config.ts
const config: CapacitorConfig = {
  appId: 'app.lovable.9d2171e7e0014fe8ada560809059a2f2',
  appName: 'awkaf-payment-kiosk',
  webDir: 'dist',
  server: {
    url: 'https://9d2171e7-e001-4fe8-ada5-60809059a2f2.lovableproject.com?forceHideBadge=true',
    cleartext: true
  }
};
```

### 6.6 USB Permissions Setup

1. Connect OM-A880 to Android device via OTG cable
2. Navigate to `/kiosk/diagnostics` in the app
3. Click "Scan USB Devices"
4. Grant USB permission when prompted
5. Permission persists across reboots

---

## 7. Kiosk Flow & User Journey

### 7.1 Payment Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Home      │────►│  Category   │────►│   Amount    │
│   Screen    │     │  Selection  │     │   Entry     │
└─────────────┘     └─────────────┘     └─────────────┘
                                               │
                                               ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Thank You  │◄────│  Payment    │◄────│   Mobile    │
│   Screen    │     │  Processing │     │   Number    │
└─────────────┘     └─────────────┘     └─────────────┘
```

### 7.2 Page Routes

| Route | Component | Description |
|-------|-----------|-------------|
| `/` | KioskHomepage | Welcome screen with logo & verse |
| `/kiosk/preset-amounts` | PresetAmountsPage | Category selection |
| `/kiosk/amount` | AmountPage | Amount entry keypad |
| `/kiosk/mobile-number` | MobileNumberPage | Mobile number for SMS |
| `/kiosk/payment-request` | PaymentRequestPage | Payment summary |
| `/kiosk/nfc-payment` | NFCPaymentPage | NFC/POS payment screen |
| `/kiosk/payment-processing` | PaymentProcessingPage | Processing animation |
| `/kiosk/confirmation` | ConfirmationPage | Success screen |
| `/kiosk/thank-you` | ThankYouPage | Thank you & reset |
| `/kiosk/error` | ErrorPage | Error handling |
| `/kiosk/diagnostics` | POSDiagnosticsPage | USB/POS diagnostics |
| `/kiosk/setup` | KioskSetupPanel | Kiosk configuration |

### 7.3 State Management

Transaction state is passed via React Router location state:

```typescript
// Navigate with transaction data
navigate('/kiosk/amount', {
  state: {
    category: 'zakat',
    categoryTitle: 'Zakat',
    categoryReference: 'ZK001'
  }
});

// Access in destination
const { state } = useLocation();
const { category, categoryTitle } = state;
```

---

## 8. Admin Panel

### 8.1 Admin Routes

| Route | Component | Description |
|-------|-----------|-------------|
| `/admin` | AdminDashboard | Dashboard overview |
| `/admin/statistics` | EnhancedStatistics | Transaction reports |
| `/admin/categories` | CategoriesManagement | Manage donation categories |
| `/admin/kiosks` | KiosksManagement | Manage kiosk devices |
| `/admin/admins` | AdminsManagement | Manage admin users |
| `/admin/sms-settings` | SMSSettings | SMS API configuration |
| `/admin/profile` | ProfilePage | Admin profile |

### 8.2 Role-Based Access

| Role | Permissions |
|------|-------------|
| `super_admin` | Full access + manage other admins |
| `admin` | Full access to all features |
| `operator` | Limited access (view + basic operations) |
| `viewer` | Read-only access |

### 8.3 Admin Panel Features

- **Dashboard**: Transaction overview, recent activity
- **Statistics**: Detailed reports, CSV export, date filtering
- **Categories**: CRUD, reordering, visibility toggle
- **Kiosks**: Device management, status monitoring
- **SMS Settings**: API configuration for receipt SMS
- **POS Config**: Hard POS vs Soft POS toggle
- **Soft POS Config**: Thawani environment, mode, token

---

## 9. Troubleshooting

### 9.1 USB Connection Issues

**Problem**: POS not detected

**Solutions**:
1. Ensure OTG cable is connected properly
2. Check USB permission was granted
3. Navigate to `/kiosk/diagnostics`
4. Click "Scan USB Devices"
5. Verify device appears in list
6. Check baud rate is 2400

**Problem**: POS not responding

**Solutions**:
1. Verify POS is in Interface/ECR mode
2. Send GetTerminalInfo (100) first
3. Check LRC calculation
4. Ensure ACK (0x06) is sent after each response
5. Check raw byte logs in diagnostics

### 9.2 Payment Failures

**Problem**: Transaction declined

**Solutions**:
1. Check POS response code in logs
2. Common codes:
   - 51: Insufficient funds
   - 55: Wrong PIN
   - 54: Expired card
3. Verify amount format (no decimals, in baisas)

**Problem**: Timeout during payment

**Solutions**:
1. Check USB connection stability
2. Verify POS is not in maintenance mode
3. Use LastTransactionStatus (102) to check result
4. Check offline queue for pending transactions

### 9.3 Soft POS Issues

**Problem**: NFC not working

**Solutions**:
1. Verify device has NFC hardware
2. Check NFC is enabled in Android settings
3. Ensure Thawani SDK is initialized
4. Check tajer_token is valid
5. Verify environment (uat vs prod)

### 9.4 Database Issues

**Problem**: Transactions not saving

**Solutions**:
1. Check RLS policies allow INSERT
2. Verify Supabase connection
3. Check offline queue for pending items
4. Review edge function logs

### 9.5 Logging & Debugging

```typescript
// Enable verbose USB logging
localStorage.setItem('USB_DEBUG', 'true');

// View raw byte traffic
// Navigate to /kiosk/diagnostics
// Check "Raw Traffic" section

// Check Supabase logs
// Use supabase--analytics-query tool
// Query auth_logs, postgres_logs, or function_edge_logs
```

---

## Appendix A: Environment Variables

| Variable | Description |
|----------|-------------|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase anon key |
| `VITE_SUPABASE_PROJECT_ID` | Supabase project ID |

## Appendix B: Storage Buckets

| Bucket | Public | Purpose |
|--------|--------|---------|
| `category-icons` | Yes | Donation category icons |
| `kiosk-backgrounds` | Yes | Kiosk background images |
| `organization-logos` | Yes | Organization logos |
| `profile-pictures` | Yes | Admin profile pictures |

## Appendix C: Enums

```typescript
type app_role = 'admin' | 'operator' | 'viewer' | 'super_admin';
type donation_category = 'donation' | 'zakat' | 'sadaqah' | 'general';
type kiosk_status = 'active' | 'inactive' | 'maintenance' | 'pending_approval';
type transaction_status = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
```

---

**Document End**
