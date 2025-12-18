# USB POS Connection Setup Guide (Samsung A13 + OM-A880)

## Why Browser Testing Doesn't Work

**Important**: Chrome browser on Android **cannot** communicate with USB devices directly. The bridge apps (TCPUART, Serial USB Terminal) expose a TCP server, but browsers cannot connect to raw TCP sockets due to security restrictions.

**Solution**: Build and install the native Android APK with USB serial support.

---

## Step-by-Step Setup

### Step 1: Export Project to GitHub

1. In Lovable, click the **"Export to GitHub"** button
2. Create a new repository or use an existing one
3. Clone the repository to your computer:
   ```bash
   git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git
   cd YOUR_REPO
   ```

### Step 2: Install Dependencies

```bash
npm install
```

### Step 3: Install USB Serial Plugin

```bash
npm install capacitor-plugin-usb-serial
```

### Step 4: Add Android Platform (if not already added)

```bash
npx cap add android
```

### Step 5: Configure Android USB Permissions

Create/update `android/app/src/main/res/xml/device_filter.xml`:

```xml
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <!-- OM-A880 POS (CDC ACM) - Vendor 05C6, Product 903B -->
    <usb-device vendor-id="1478" product-id="36923" />
    
    <!-- Generic CDC ACM devices -->
    <usb-device class="2" subclass="2" protocol="1" />
    
    <!-- CH340 USB Serial -->
    <usb-device vendor-id="6790" product-id="29987" />
    
    <!-- FTDI USB Serial -->
    <usb-device vendor-id="1027" product-id="24577" />
    
    <!-- CP210x USB Serial -->
    <usb-device vendor-id="4292" product-id="60000" />
</resources>
```

Update `android/app/src/main/AndroidManifest.xml` - add inside `<activity>`:

```xml
<intent-filter>
    <action android:name="android.hardware.usb.action.USB_DEVICE_ATTACHED" />
</intent-filter>
<meta-data
    android:name="android.hardware.usb.action.USB_DEVICE_ATTACHED"
    android:resource="@xml/device_filter" />
```

Also add these permissions at the top of the manifest:

```xml
<uses-feature android:name="android.hardware.usb.host" android:required="true" />
```

### Step 6: Sync and Build

```bash
npx cap sync android
npx cap open android
```

In Android Studio:
1. Wait for Gradle sync to complete
2. Connect your Samsung A13 via USB (enable USB debugging)
3. Click **Run** (green play button)
4. Select your device and install

### Step 7: Test the Connection

1. Disconnect Samsung from computer
2. Connect OM-A880 POS to Samsung via USB OTG cable
3. Open the installed app
4. Navigate to `/kiosk/diagnostics`
5. Click "Test Connection"

---

## Troubleshooting

### "No USB devices found"
- Make sure the OTG cable is working (test with a USB drive)
- Check that the POS is powered on
- Grant USB permission when prompted

### "Permission denied"
- Unplug and replug the POS
- When the permission dialog appears, check "Always" and tap "OK"

### "Connection timeout"
- Verify baud rate is 115200
- Check the POS is in ECR mode (not standalone mode)

---

## POS Device Info (from Serial USB Terminal)

Your POS was detected as:
- **Type**: CDC (Communication Device Class)
- **Vendor ID**: 05C6 (hex) = 1478 (decimal)
- **Product ID**: 903B (hex) = 36923 (decimal)
- **Name**: Android

This is a standard USB CDC ACM device, which the `capacitor-plugin-usb-serial` supports natively.

---

## Quick Reference

| Setting | Value |
|---------|-------|
| Baud Rate | 115200 |
| Data Bits | 8 |
| Stop Bits | 1 |
| Parity | None |
| Vendor ID | 0x05C6 (1478) |
| Product ID | 0x903B (36923) |
