/**
 * ECR Protocol Implementation for OM-A880 POS
 * Based on OMA Emirates ECR Integration Specification Document v1.25
 * 
 * This module handles the ECR protocol for communication with OM-A880 POS terminals.
 * All commands are non-blocking (asynchronous) allowing the app to remain responsive.
 */

// Command Types (from spec)
export const ECR_COMMANDS = {
  PURCHASE: '100',
  REFUND: '101',
  VOID_PURCHASE: '102',
  VOID_REFUND: '103',
  DUPLICATE: '104',
  GET_TOTALS: '105',
  LAST_TRANSACTION_STATUS: '106',
  STANDALONE_MODE: '107',
  GET_TERMINAL_INFO: '109',
  RECONCILIATION: '112',
  LOGO_DOWNLOAD: '113',
  GET_STATUS: '114',
  CONFIG_TERMINAL: '117',
  UPDATE_PARAMETER: '118',
  RETURN: '125',
  DELETE_BATCH: '126',
  DELETE_REVERSAL: '127',
  PRINT_Z_REPORT: '129',
  INITIALIZE_POS: '130',
  PIN_SET: '135',
  CHECK_KCV: '136',
} as const;

// Intermediate Message Codes (from spec)
export const INTERMEDIATE_MESSAGES: Record<string, { code: string; description: string; arabicMessage: string }> = {
  '001': { code: '001', description: 'Enter card displayed', arabicMessage: 'الرجاء إدخال البطاقة' },
  '002': { code: '002', description: 'Card Inserted', arabicMessage: 'تم إدخال البطاقة' },
  '003': { code: '003', description: 'Fallback happened', arabicMessage: 'جاري التبديل لقراءة أخرى' },
  '005': { code: '005', description: 'Card swiped', arabicMessage: 'تم تمرير البطاقة' },
  '006': { code: '006', description: 'Enter PIN', arabicMessage: 'الرجاء إدخال الرقم السري' },
  '007': { code: '007', description: 'PIN Entered', arabicMessage: 'تم إدخال الرقم السري' },
  '008': { code: '008', description: 'Online Processing', arabicMessage: 'جاري الاتصال بالبنك...' },
  '009': { code: '009', description: 'Response received from Host', arabicMessage: 'تم استلام الرد من البنك' },
  '010': { code: '010', description: 'Printing of receipt', arabicMessage: 'جاري طباعة الإيصال...' },
  '011': { code: '011', description: 'Remove card displayed', arabicMessage: 'الرجاء إزالة البطاقة' },
  '012': { code: '012', description: 'Card removed', arabicMessage: 'تم إزالة البطاقة' },
  '013': { code: '013', description: 'Transaction Successful', arabicMessage: 'تمت العملية بنجاح' },
  '014': { code: '014', description: 'Transaction Failed', arabicMessage: 'فشلت العملية' },
  '015': { code: '015', description: 'Transaction being reversed', arabicMessage: 'جاري إلغاء العملية...' },
  '016': { code: '016', description: 'Waiting for Logo', arabicMessage: 'في انتظار تحميل الشعار' },
  '017': { code: '017', description: 'Sending Pending Reversal', arabicMessage: 'جاري إرسال الإلغاء المعلق' },
  '018': { code: '018', description: 'End of Transaction', arabicMessage: 'انتهت العملية' },
  '019': { code: '019', description: 'Online Pin Bypassed', arabicMessage: 'تم تجاوز الرقم السري' },
  '020': { code: '020', description: 'Offline Pin Bypassed', arabicMessage: 'تم تجاوز الرقم السري' },
  '021': { code: '021', description: 'Transaction Not Found', arabicMessage: 'العملية غير موجودة' },
  '022': { code: '022', description: 'DCC Inquiry Request', arabicMessage: 'طلب معلومات العملة' },
  '023': { code: '023', description: 'DCC Inquiry Response', arabicMessage: 'رد معلومات العملة' },
  '024': { code: '024', description: 'DCC Selection Screen', arabicMessage: 'شاشة اختيار العملة' },
  '025': { code: '025', description: 'DCC Currency Selected', arabicMessage: 'تم اختيار العملة' },
  '026': { code: '026', description: 'DCC Currency Rejected', arabicMessage: 'تم رفض العملة' },
  '027': { code: '027', description: 'Communication mode is GPRS', arabicMessage: 'وضع الاتصال: GPRS' },
  '028': { code: '028', description: 'Communication mode is Ethernet', arabicMessage: 'وضع الاتصال: إيثرنت' },
  '029': { code: '029', description: 'Communication mode is Modem', arabicMessage: 'وضع الاتصال: مودم' },
};

// Error Codes (from spec)
export const ERROR_CODES: Record<string, { code: string; description: string; arabicMessage: string; recoverable: boolean }> = {
  'E000': { code: 'E000', description: 'No Error', arabicMessage: 'لا يوجد خطأ', recoverable: true },
  'E001': { code: 'E001', description: 'Terminal Not Initialized', arabicMessage: 'الجهاز غير مهيأ', recoverable: true },
  'E002': { code: 'E002', description: 'Batch Full', arabicMessage: 'دفعة المعاملات ممتلئة', recoverable: false },
  'E003': { code: 'E003', description: 'Card Not removed from Card Reader', arabicMessage: 'البطاقة لم تُزل من القارئ', recoverable: true },
  'E004': { code: 'E004', description: 'Incorrect Amount Received', arabicMessage: 'المبلغ المستلم غير صحيح', recoverable: true },
  'E005': { code: 'E005', description: 'Invalid Message Type Received', arabicMessage: 'نوع الرسالة غير صالح', recoverable: false },
  'E006': { code: 'E006', description: 'No Paper Roll', arabicMessage: 'لا يوجد ورق في الطابعة', recoverable: true },
  'E007': { code: 'E007', description: 'XML Format Error', arabicMessage: 'خطأ في تنسيق البيانات', recoverable: false },
  'E008': { code: 'E008', description: 'Expired Card', arabicMessage: 'بطاقة منتهية الصلاحية', recoverable: false },
  'E009': { code: 'E009', description: 'Card Not Supported', arabicMessage: 'البطاقة غير مدعومة', recoverable: false },
  'E010': { code: 'E010', description: 'Transaction Not Permitted', arabicMessage: 'العملية غير مسموحة', recoverable: false },
  'E011': { code: 'E011', description: 'Low Battery', arabicMessage: 'البطارية منخفضة', recoverable: true },
  'E012': { code: 'E012', description: 'Database Error Exception', arabicMessage: 'خطأ في قاعدة البيانات', recoverable: false },
  'E013': { code: 'E013', description: 'Invalid Track', arabicMessage: 'مسار البطاقة غير صالح', recoverable: false },
  'E014': { code: 'E014', description: 'Customer Cancellation', arabicMessage: 'تم الإلغاء من قبل العميل', recoverable: true },
  'E015': { code: 'E015', description: 'Card Reader Time Out', arabicMessage: 'انتهت مهلة قارئ البطاقة', recoverable: true },
  'E016': { code: 'E016', description: 'PIN TimeOut', arabicMessage: 'انتهت مهلة الرقم السري', recoverable: true },
  'E017': { code: 'E017', description: 'Invalid Expiry', arabicMessage: 'تاريخ انتهاء غير صالح', recoverable: false },
  'E018': { code: 'E018', description: 'Card not supported (Bin Not found)', arabicMessage: 'البطاقة غير مدعومة', recoverable: false },
  'E019': { code: 'E019', description: 'AID Not Supported', arabicMessage: 'نوع التطبيق غير مدعوم', recoverable: false },
  'E020': { code: 'E020', description: 'Wrong Password', arabicMessage: 'كلمة المرور خاطئة', recoverable: true },
  'E021': { code: 'E021', description: 'Chip Read Error', arabicMessage: 'خطأ في قراءة الشريحة', recoverable: true },
  'E022': { code: 'E022', description: 'Service Code Check Error', arabicMessage: 'خطأ في رمز الخدمة', recoverable: false },
  'E023': { code: 'E023', description: 'Connection Error', arabicMessage: 'خطأ في الاتصال', recoverable: true },
  'E024': { code: 'E024', description: 'Send Exception', arabicMessage: 'خطأ في الإرسال', recoverable: true },
  'E025': { code: 'E025', description: 'Receive Exception', arabicMessage: 'خطأ في الاستلام', recoverable: true },
  'E026': { code: 'E026', description: 'Invalid Receipt Number', arabicMessage: 'رقم الإيصال غير صالح', recoverable: false },
  'E027': { code: 'E027', description: 'Transaction already voided', arabicMessage: 'العملية ملغاة مسبقاً', recoverable: false },
  'E028': { code: 'E028', description: 'Transaction not found', arabicMessage: 'العملية غير موجودة', recoverable: false },
  'E029': { code: 'E029', description: 'Wrong N Digits', arabicMessage: 'عدد الأرقام خاطئ', recoverable: true },
  'E030': { code: 'E030', description: 'Maximum Amount Digits Exceeded', arabicMessage: 'تجاوز الحد الأقصى للمبلغ', recoverable: true },
  'E031': { code: 'E031', description: 'ATM Only Exception', arabicMessage: 'للصراف الآلي فقط', recoverable: false },
  'E032': { code: 'E032', description: 'Amount Not Matching', arabicMessage: 'المبلغ غير متطابق', recoverable: true },
  'E033': { code: 'E033', description: 'Disk Exception', arabicMessage: 'خطأ في القرص', recoverable: false },
  'E034': { code: 'E034', description: 'Decompression Exception', arabicMessage: 'خطأ في فك الضغط', recoverable: false },
  'E035': { code: 'E035', description: 'Reversal Incomplete', arabicMessage: 'الإلغاء غير مكتمل', recoverable: true },
  'E036': { code: 'E036', description: 'Card Removed during Transaction', arabicMessage: 'البطاقة أُزيلت أثناء العملية', recoverable: true },
  'E037': { code: 'E037', description: 'Response parse Error', arabicMessage: 'خطأ في تحليل الرد', recoverable: false },
  'E038': { code: 'E038', description: 'Reversal Send Exception', arabicMessage: 'خطأ في إرسال الإلغاء', recoverable: true },
  'E039': { code: 'E039', description: 'Reversal Receive Exception', arabicMessage: 'خطأ في استلام الإلغاء', recoverable: true },
  'E040': { code: 'E040', description: 'Crypto Error', arabicMessage: 'خطأ في التشفير', recoverable: false },
  'E041': { code: 'E041', description: 'Batch Empty', arabicMessage: 'الدفعة فارغة', recoverable: true },
  'E042': { code: 'E042', description: 'Swipe Card Only', arabicMessage: 'تمرير البطاقة فقط', recoverable: true },
  'E043': { code: 'E043', description: 'Runtime Exception', arabicMessage: 'خطأ أثناء التشغيل', recoverable: false },
  'E044': { code: 'E044', description: 'Contactless Read Exception', arabicMessage: 'خطأ في القراءة اللاتلامسية', recoverable: true },
  'E045': { code: 'E045', description: 'Sending Batch Incomplete', arabicMessage: 'إرسال الدفعة غير مكتمل', recoverable: true },
  'E046': { code: 'E046', description: 'Fall Back Not Supported', arabicMessage: 'التبديل غير مدعوم', recoverable: false },
  'E047': { code: 'E047', description: 'Exceed Max Tip Exception', arabicMessage: 'تجاوز الحد الأقصى للإكرامية', recoverable: true },
  'E048': { code: 'E048', description: 'Transaction Time Out Exception', arabicMessage: 'انتهت مهلة العملية', recoverable: true },
  'E050': { code: 'E050', description: 'Invalid RRN Exception', arabicMessage: 'رقم المرجع غير صالح', recoverable: false },
  'E051': { code: 'E051', description: 'Initialize POS Exception', arabicMessage: 'خطأ في تهيئة الجهاز', recoverable: true },
  'E052': { code: 'E052', description: 'Connection retry exceeded', arabicMessage: 'تجاوز محاولات الاتصال', recoverable: true },
  'E053': { code: 'E053', description: 'Batch Delete Exception', arabicMessage: 'خطأ في حذف الدفعة', recoverable: false },
  'E054': { code: 'E054', description: 'Invalid Password', arabicMessage: 'كلمة المرور غير صالحة', recoverable: true },
  'E057': { code: 'E057', description: 'Key Load Exception', arabicMessage: 'خطأ في تحميل المفتاح', recoverable: false },
  'E058': { code: 'E058', description: 'CA Key Exception', arabicMessage: 'خطأ في مفتاح CA', recoverable: false },
  'E059': { code: 'E059', description: 'Mag Stripe Read Exception', arabicMessage: 'خطأ في قراءة الشريط', recoverable: true },
  'E061': { code: 'E061', description: 'GPRS Reboot Required', arabicMessage: 'يتطلب إعادة تشغيل GPRS', recoverable: true },
  'E062': { code: 'E062', description: 'Param Download Failed', arabicMessage: 'فشل تحميل الإعدادات', recoverable: true },
  'E065': { code: 'E065', description: 'PIN Key KCV Error', arabicMessage: 'خطأ في مفتاح PIN', recoverable: false },
  'E066': { code: 'E066', description: 'PAN Key KCV Error', arabicMessage: 'خطأ في مفتاح PAN', recoverable: false },
  'E099': { code: 'E099', description: 'No response from EFT device', arabicMessage: 'لا استجابة من جهاز الدفع', recoverable: true },
  'E06': { code: 'E06', description: 'No response from EFT device', arabicMessage: 'لا استجابة من جهاز الدفع', recoverable: true },
};

// Entry Modes
export const ENTRY_MODES: Record<string, string> = {
  'I': 'Chip',
  'K': 'Manual Entry',
  'S': 'Magstripe',
  'T': 'Contactless',
};

// Cardholder Verification Methods
export const CH_VERIFY_METHODS: Record<string, string> = {
  '1': 'Offline PIN',
  '2': 'Online PIN',
  '3': 'Signature',
  '5': 'PIN Timeout',
};

// Transaction Status
export const TXN_STATUS: Record<string, { status: string; description: string }> = {
  'OK': { status: 'OK', description: 'Transaction is successful' },
  'RE': { status: 'RE', description: 'Timeout or Receive exception and a Reversal is done' },
  'PE': { status: 'PE', description: 'Parse Exception and hence a reversal is done' },
  'PR': { status: 'PR', description: 'Processing Exception' },
  'CD': { status: 'CD', description: 'Card Decline - Card removed and reversal happened' },
};

// ECR Response Interface
export interface ECRResponse {
  commandType: string;
  errorCode: string;
  responseCode: string;
  reversed: boolean;
  transactionDate: string;
  transactionTime: string;
  sequenceNo: string;
  cardSchemeName: string;
  maskCardNumber: string;
  expiryDate: string;
  cardHolderName: string;
  amount: string;
  currency: string;
  txnStatus: string;
  authCode: string;
  entryMode: string;
  emvData?: {
    applicationLabel: string;
    aid: string;
    tvr: string;
    tsi: string;
    ac: string;
    cid: string;
  };
  chVerify: string;
  tid: string;
  mid: string;
  batchNo?: string;
  invoiceNo?: string;
  rrn?: string;
  hostRspCode?: string;
  responseDesc?: string;
  receiptDataMerchant?: string;
  receiptDataCustomer?: string;
  mrefLabel?: string;
  mrefValue?: string;
  dcc?: {
    exchgRate: string;
    markup: string;
    frCur: string;
    amt: string;
  };
}

// Terminal Info Response
export interface TerminalInfoResponse {
  commandType: string;
  errorCode: string;
  appVersion: string;
  serialNo: string;
  tid: string;
  mid: string;
  batchNo: string;
  tmsPriIpAddress: string;
  terminalTotals?: {
    cardSchemeTotals: Array<{
      cardSchemeName: string;
      currency: string;
      totalQtyOfDebits: number;
      totalValueOfDebits: number;
      totalQtyOfCredits: number;
      totalValueOfCredits: number;
      netTotalQty: number;
      netTotalValue: number;
    }>;
    grandQtyOfDebits: number;
    grandValueOfDebits: number;
    grandQtyOfCredits: number;
    grandValueOfCredits: number;
    grandTotalQty: number;
    grandTotalValue: number;
  };
}

// POS Status Response
export interface POSStatusECRResponse {
  errorCode: string;
  readerStatus: '0' | '1'; // 1 = card present
  printerStatus: '0' | '1'; // 1 = paper available and configured to print
}

// Reconciliation Response
export interface ReconciliationECRResponse {
  commandType: string;
  errorCode: string;
  transactionResult: '0' | '1' | '2' | '3'; // 0=Failed, 1=Rejected, 2=Accepted, 3=Accepted with upload
  transactionDate: string;
  transactionTime: string;
}

/**
 * Parse XML response from POS
 */
export const parseXMLResponse = (xmlString: string): ECRResponse | null => {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlString, 'text/xml');
    
    const getTagValue = (tagName: string): string => {
      const element = doc.getElementsByTagName(tagName)[0];
      return element?.textContent || '';
    };
    
    const response: ECRResponse = {
      commandType: getTagValue('CommandType'),
      errorCode: getTagValue('ErrorCode'),
      responseCode: getTagValue('ResponseCode'),
      reversed: getTagValue('Reversed') === '1',
      transactionDate: getTagValue('TransactionDate'),
      transactionTime: getTagValue('TransactionTime'),
      sequenceNo: getTagValue('SequenceNo'),
      cardSchemeName: getTagValue('CardSchemeName'),
      maskCardNumber: getTagValue('MaskCardNumber'),
      expiryDate: getTagValue('ExpiryDate'),
      cardHolderName: getTagValue('CardHolderName'),
      amount: getTagValue('Amount'),
      currency: getTagValue('Currency'),
      txnStatus: getTagValue('TxnStatus'),
      authCode: getTagValue('AuthCode'),
      entryMode: getTagValue('EntryMode'),
      chVerify: getTagValue('CHVerify'),
      tid: getTagValue('TID'),
      mid: getTagValue('MID'),
      batchNo: getTagValue('BatchNo'),
      invoiceNo: getTagValue('InvoiceNo'),
      rrn: getTagValue('RRN'),
      hostRspCode: getTagValue('HostRspCode'),
      responseDesc: getTagValue('ResponseDesc'),
      receiptDataMerchant: getTagValue('ReceiptDataMerchant'),
      receiptDataCustomer: getTagValue('ReceiptDataCustomer'),
      mrefLabel: getTagValue('MREFLabel'),
      mrefValue: getTagValue('MREFValue'),
    };
    
    // Parse EMV data if present
    const emvNode = doc.getElementsByTagName('EMVData')[0];
    if (emvNode) {
      response.emvData = {
        applicationLabel: getTagValue('ApplicationLabel'),
        aid: getTagValue('AID'),
        tvr: getTagValue('TVR'),
        tsi: getTagValue('TSI'),
        ac: getTagValue('AC'),
        cid: getTagValue('CID'),
      };
    }
    
    // Parse DCC data if present
    const dccNode = doc.getElementsByTagName('DCC')[0];
    if (dccNode) {
      response.dcc = {
        exchgRate: getTagValue('DccExchgRate'),
        markup: getTagValue('DccMarkup'),
        frCur: getTagValue('DccFrCur'),
        amt: getTagValue('DccAmt'),
      };
    }
    
    return response;
  } catch (error) {
    console.error('[ECR] Failed to parse XML response:', error);
    return null;
  }
};

/**
 * Get error info from error code
 */
export const getErrorInfo = (errorCode: string): { description: string; arabicMessage: string; recoverable: boolean } => {
  const error = ERROR_CODES[errorCode];
  if (error) {
    return error;
  }
  return {
    description: 'Unknown Error',
    arabicMessage: 'خطأ غير معروف',
    recoverable: false,
  };
};

/**
 * Get intermediate message info
 */
export const getIntermediateMessageInfo = (code: string): { description: string; arabicMessage: string } | null => {
  return INTERMEDIATE_MESSAGES[code] || null;
};

/**
 * Check if response indicates success
 */
export const isSuccessResponse = (response: ECRResponse): boolean => {
  return response.errorCode === 'E000' && 
         (response.responseCode === 'APPROVED' || response.txnStatus === 'OK');
};

/**
 * Format amount for POS (remove decimal, integer string)
 * 2.000 OMR → "2000"
 * 5.500 OMR → "5500"
 */
export const formatAmountForECR = (amountInBaisas: number): string => {
  return Math.round(amountInBaisas).toString();
};

/**
 * Parse amount from ECR response
 */
export const parseAmountFromECR = (amountString: string): number => {
  return parseInt(amountString, 10) || 0;
};
