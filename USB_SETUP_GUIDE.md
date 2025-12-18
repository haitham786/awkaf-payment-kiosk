# USB POS Connection - Automatic APK Build

## No Android Studio Required!

The APK builds **automatically** when you connect to GitHub. You just need to:

1. **Connect to GitHub** - Click the GitHub button in Lovable
2. **Wait for build** - Takes about 5 minutes
3. **Download APK** - From GitHub Releases
4. **Install on phone** - Transfer and install

---

## Step-by-Step Guide

### Step 1: Connect Lovable to GitHub

1. In the Lovable editor, click **"GitHub"** button (top right)
2. Click **"Connect to GitHub"**
3. Authorize Lovable on GitHub
4. Click **"Create Repository"**

### Step 2: Wait for APK Build

The APK builds automatically when code syncs to GitHub.

1. Go to your GitHub repository
2. Click **"Actions"** tab
3. Watch the "Build Android APK" workflow
4. Wait for green checkmark (~5 minutes)

### Step 3: Download the APK

1. In GitHub, click **"Releases"** (right sidebar)
2. Find the latest release
3. Download **`awkaf-kiosk-usb.apk`**

### Step 4: Install on Samsung A13

1. Transfer APK to phone (USB, email, or cloud)
2. Open the APK file on phone
3. Allow "Install from unknown sources" if prompted
4. Tap **Install**

### Step 5: Test USB Connection

1. Disconnect phone from computer
2. Connect **OM-A880 POS** via **USB OTG cable**
3. Open the installed app
4. A permission dialog will appear - tap **OK** (check "Always" box)
5. Navigate to `/kiosk/diagnostics`
6. Click **"Test USB Connection"**

---

## Troubleshooting

### APK build fails
- Check GitHub Actions for error messages
- Make sure secrets are configured (if needed)

### "No USB devices found"
- Ensure OTG cable is connected properly
- Make sure POS is powered on
- Try unplugging and replugging

### USB permission denied
- Unplug POS, close app, replug POS
- Check "Always allow" when permission dialog appears

### Connection timeout
- Verify POS is in ECR mode
- Check baud rate is 115200

---

## Your POS Device Info

Detected from Serial USB Terminal:
- **Type**: CDC (Communication Device Class)
- **Vendor ID**: 05C6 (hex) = 1478 (decimal)
- **Product ID**: 903B (hex) = 36923 (decimal)

This device is **fully supported** by the APK.

---

## Technical Details (For Reference)

The GitHub Actions workflow:
1. Installs `capacitor-plugin-usb-serial` 
2. Configures Android USB permissions
3. Adds your POS device IDs
4. Builds signed APK
5. Uploads to GitHub Releases

All USB configuration is done automatically.
