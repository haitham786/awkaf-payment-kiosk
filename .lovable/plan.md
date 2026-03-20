

# Bilingual Kiosk App + Currency Logo Integration

## Overview
Three major changes: (1) Add English titles to donation categories with admin control, (2) Add English translations under every Arabic line across all kiosk pages, (3) Replace the "ر.ع" text with the uploaded Omani Rial currency logo.

---

## 1. Database Migration

Add `title_en` (English title) column to `donation_categories` table:
```sql
ALTER TABLE public.donation_categories ADD COLUMN title_en text;
```

This allows admins to set an optional English title for each category.

---

## 2. Admin Panel — Categories Management

**File: `src/pages/admin/CategoriesManagement.tsx`**
- Add `title_en` field to `formData` state
- Add a new input field labeled "Title (English)" below the existing Arabic title field
- Include `title_en` in the form submission and edit loading
- Update `resetForm` to clear `title_en`

**File: `src/components/admin/SortableCategory.tsx`**
- Display `category.title_en` below the Arabic title in the category list

---

## 3. Currency Logo Asset

Copy the uploaded `Omani_Rial_Logo.png` to `public/images/omani-rial.png` so it can be referenced as a static asset across all pages.

---

## 4. Kiosk Pages — Bilingual Text + Currency Logo

Every Arabic text line gets an English translation underneath in smaller, slightly muted text. The currency symbol "ر.ع" is replaced with the Omani Rial logo image (`<img>` tag, ~h-4 inline).

### Pages to update:

**KioskHomepage.tsx**
- Category cards: show `title_en` below Arabic title
- "نظام التبرعات الرقمي" → add "Digital Donation System"
- "اختر نوع التبرع..." → add "Choose the type of donation..."
- "المس الشاشة..." → add "Touch the screen to select..."
- Quranic verse section label translation
- Status overlay messages: add English below each Arabic message

**PresetAmountsPage.tsx**
- Category title: show `title_en` below Arabic
- Replace "ر.ع" with the currency logo image (left of amount)
- "إدخال مبلغ مختلف" → add "Enter a different amount"
- Enlarge category card frames slightly to fit both titles

**AmountPage.tsx**
- Category title: show `title_en` below Arabic
- "ریال عماني" → add "Omani Rial"; "بيسة" → add "Baisa"
- "تأكيد" button → add "Confirm"
- Replace currency text references with logo where applicable

**ConfirmationPage.tsx**
- "تأكيد المبلغ" → add "Confirm Amount"
- Category title: show `title_en`
- "نوع التبرع" → add "Donation Type"
- "مبلغ التبرع" → add "Donation Amount"
- Replace "ر.ع" in `formatAmount` with currency logo
- "تعديل المبلغ" → add "Edit Amount"
- "تأكيد والدفع" → add "Confirm & Pay"

**ThawaniTapCardScreen.tsx (NFC Payment)**
- Category title: show `title_en`
- Replace "ر.ع" with currency logo
- "ضع بطاقتك البنكية على الشاشة" → add "Place your bank card on the screen"
- "معالجة العملية..." → add "Processing..."
- "تم رفض العملية" → add "Transaction declined"

**NFCPaymentPage.tsx**
- Error/declined stage messages: add English translations
- "حاول مرة أخرى" → "Try Again"
- "إلغاء" → "Cancel"
- Replace "ر.ع" with currency logo

**ThankYouPage.tsx**
- "شكرا لكم" → add "Thank You"
- "تم قبول تبرعكم بنجاح" → add "Your donation has been accepted"
- Category title: show `title_en`
- Replace "ر.ع" with currency logo
- "هل تريد إيصال عبر الرسائل النصية؟" → add "Would you like an SMS receipt?"
- "نعم" → add "Yes"

**MobileNumberPage.tsx**
- "إدخال رقم الهاتف" → add "Enter Phone Number"
- "إرسال الإيصال" → add "Send Receipt"
- Popup messages: add English translations
- "تم بنجاح" → "Success"; "خطأ" → "Error"

**ErrorPage.tsx**
- All error titles/descriptions: add English below Arabic
- "المحاولة مرة أخرى" → add "Try Again"
- Replace "ر.ع" with currency logo

---

## 5. Currency Logo Component

Create a small reusable component or inline pattern:
```tsx
<img src="/images/omani-rial.png" alt="OMR" className="h-4 inline-block" />
```
Used wherever amounts are displayed, placed to the left of the number.

---

## 6. Category Card Sizing

Adjust `min-h` on KioskHomepage category cards from `min-h-[140px]` to `min-h-[160px]` to accommodate both Arabic and English titles without overflow.

---

## Technical Details

- The `title_en` column is nullable — categories without English titles simply won't show the English line
- All English text uses smaller font size (e.g., `text-sm` or `text-xs`) and slightly muted color (`text-gray-600`)
- The currency logo PNG is resized inline via Tailwind classes to match text height
- Session/image caching patterns remain unchanged
- The `select` queries in kiosk pages need to include `title_en` in the column list

