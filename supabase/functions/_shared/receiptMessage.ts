// Shared receipt-message builder so SMS and WhatsApp deliver identical content.

export interface ReceiptInput {
  categoryArabic: string;
  amount_baisas: number;
  reference: string;
  pos_rrn?: string | null;
  date?: Date;
}

export function formatAmountOMR(amount_baisas: number): string {
  const rials = Math.floor(amount_baisas / 1000);
  const baisas = amount_baisas % 1000;
  return `${rials}.${baisas.toString().padStart(3, '0')} ر.ع`;
}

export function formatArabicDateTime(date: Date = new Date()): { dateStr: string; timeStr: string } {
  const dateStr = date.toLocaleDateString('ar-OM', { year: 'numeric', month: '2-digit', day: '2-digit' });
  const timeStr = date.toLocaleTimeString('ar-OM', { hour: '2-digit', minute: '2-digit' });
  return { dateStr, timeStr };
}

export function buildReceiptMessage(input: ReceiptInput): string {
  const formattedAmount = formatAmountOMR(input.amount_baisas);
  const { dateStr, timeStr } = formatArabicDateTime(input.date);

  let msg = `شكراً لتبرعكم!
الفئة: ${input.categoryArabic}
المبلغ: ${formattedAmount}
التاريخ: ${dateStr} ${timeStr}
رقم المعاملة: ${input.reference}`;

  if (input.pos_rrn) {
    msg += `
رقم مرجع البنك: ${input.pos_rrn}`;
  }

  msg += `
جزاكم الله خيراً`;

  return msg;
}
