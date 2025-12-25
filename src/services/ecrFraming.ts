/**
 * ECR Protocol Framing for OM-A880 POS
 * 
 * CRITICAL: Every command sent to POS MUST be framed as:
 * STX (0x02) + <EFTData>...</EFTData> + ETX (0x03) + LRC
 * 
 * LRC Rules:
 * - XOR of all bytes from XML start to ETX
 * - Exclude STX
 * - Include ETX
 * 
 * No framing = No response from POS!
 */

// Control characters
export const STX = 0x02; // Start of Text
export const ETX = 0x03; // End of Text
export const ACK = 0x06; // Acknowledgment
export const NAK = 0x15; // Negative Acknowledgment
export const ENQ = 0x05; // Enquiry

/**
 * Calculate LRC (Longitudinal Redundancy Check)
 * XOR of all bytes from start of data to ETX (inclusive)
 */
export const calculateLRC = (data: Uint8Array): number => {
  let lrc = 0;
  for (let i = 0; i < data.length; i++) {
    lrc ^= data[i];
  }
  // Include ETX in LRC calculation
  lrc ^= ETX;
  return lrc;
};

/**
 * Frame an ECR command for transmission to POS
 * Adds STX prefix, ETX suffix, and LRC checksum
 * 
 * @param xmlCommand - Raw XML command string
 * @returns Framed bytes ready for transmission
 */
export const frameECRCommand = (xmlCommand: string): Uint8Array => {
  // Convert XML to bytes
  const encoder = new TextEncoder();
  const xmlBytes = encoder.encode(xmlCommand);
  
  // Calculate LRC (XOR of XML bytes + ETX)
  const lrc = calculateLRC(xmlBytes);
  
  // Build framed packet: STX + XML + ETX + LRC
  const framedPacket = new Uint8Array(1 + xmlBytes.length + 1 + 1);
  framedPacket[0] = STX;
  framedPacket.set(xmlBytes, 1);
  framedPacket[1 + xmlBytes.length] = ETX;
  framedPacket[1 + xmlBytes.length + 1] = lrc;
  
  return framedPacket;
};

/**
 * Convert Uint8Array to hex string for debugging
 */
export const bytesToHex = (bytes: Uint8Array): string => {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0').toUpperCase())
    .join(' ');
};

/**
 * Convert Uint8Array to string, handling binary control chars
 */
export const bytesToString = (bytes: Uint8Array): string => {
  const decoder = new TextDecoder('utf-8', { fatal: false });
  return decoder.decode(bytes);
};

/**
 * Convert framed packet to string for logging
 */
export const frameToDebugString = (packet: Uint8Array): string => {
  const parts: string[] = [];
  
  for (let i = 0; i < packet.length; i++) {
    const byte = packet[i];
    if (byte === STX) {
      parts.push('[STX]');
    } else if (byte === ETX) {
      parts.push('[ETX]');
    } else if (byte === ACK) {
      parts.push('[ACK]');
    } else if (byte === NAK) {
      parts.push('[NAK]');
    } else if (byte < 32) {
      parts.push(`[0x${byte.toString(16).padStart(2, '0')}]`);
    } else {
      parts.push(String.fromCharCode(byte));
    }
  }
  
  return parts.join('');
};

/**
 * Parse a framed response from POS
 * Extracts XML data between STX and ETX, validates LRC
 * 
 * @param framedData - Raw bytes received from POS
 * @returns Parsed XML string or null if invalid
 */
export const parseFramedResponse = (framedData: Uint8Array): { 
  valid: boolean; 
  data: string | null; 
  isACK: boolean;
  isNAK: boolean;
  isIntermediate: boolean;
  rawHex: string;
} => {
  const rawHex = bytesToHex(framedData);
  
  // Check for single ACK byte
  if (framedData.length === 1 && framedData[0] === ACK) {
    return { valid: true, data: null, isACK: true, isNAK: false, isIntermediate: false, rawHex };
  }
  
  // Check for single NAK byte
  if (framedData.length === 1 && framedData[0] === NAK) {
    return { valid: true, data: null, isACK: false, isNAK: true, isIntermediate: false, rawHex };
  }
  
  // Find STX and ETX
  const stxIndex = framedData.indexOf(STX);
  const etxIndex = framedData.indexOf(ETX);
  
  if (stxIndex === -1 || etxIndex === -1 || etxIndex <= stxIndex) {
    // No framing - might be raw data or partial message
    const decoder = new TextDecoder('utf-8', { fatal: false });
    const rawText = decoder.decode(framedData);
    
    // Check if it contains intermediate status
    const isIntermediate = rawText.includes('<IntermediateStatus>') || 
                           rawText.includes('<StatusCode>');
    
    return { 
      valid: false, 
      data: rawText, 
      isACK: false, 
      isNAK: false, 
      isIntermediate, 
      rawHex 
    };
  }
  
  // Extract XML data (between STX and ETX)
  const xmlBytes = framedData.slice(stxIndex + 1, etxIndex);
  const decoder = new TextDecoder('utf-8');
  const xmlString = decoder.decode(xmlBytes);
  
  // Get and validate LRC
  const receivedLRC = framedData[etxIndex + 1];
  const calculatedLRC = calculateLRC(xmlBytes);
  
  const valid = receivedLRC === calculatedLRC;
  
  if (!valid) {
    console.warn('[ECR Frame] LRC mismatch:', {
      received: receivedLRC?.toString(16),
      calculated: calculatedLRC.toString(16),
    });
  }
  
  // Check if intermediate status
  const isIntermediate = xmlString.includes('<IntermediateStatus>') || 
                         xmlString.includes('<StatusCode>');
  
  return { valid, data: xmlString, isACK: false, isNAK: false, isIntermediate, rawHex };
};

/**
 * Create ACK byte array
 */
export const createACK = (): Uint8Array => {
  return new Uint8Array([ACK]);
};

/**
 * Create NAK byte array
 */
export const createNAK = (): Uint8Array => {
  return new Uint8Array([NAK]);
};

/**
 * Build ECR XML command wrapper
 */
export const buildECRMessage = (commandType: string, additionalFields: Record<string, string> = {}): string => {
  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<EFTData>
<CommandType>${commandType}</CommandType>`;
  
  for (const [key, value] of Object.entries(additionalFields)) {
    xml += `\n<${key}>${value}</${key}>`;
  }
  
  xml += `
</EFTData>`;
  
  return xml;
};

/**
 * Build Purchase command XML (CommandType 100)
 * Amount must be sent without decimal: 10.50 → 1050
 */
export const buildPurchaseCommand = (
  amountInBaisas: number, 
  merchantRef?: string,
  invoiceNo?: string
): string => {
  // Amount without decimal point (already in baisas)
  const amount = Math.round(amountInBaisas).toString();
  
  const fields: Record<string, string> = {
    Amount: amount,
  };
  
  if (merchantRef) {
    fields.MerchantReference = merchantRef.substring(0, 22); // Max 22 chars
  }
  
  if (invoiceNo) {
    fields.InvoiceNo = invoiceNo;
  }
  
  return buildECRMessage('100', fields);
};

/**
 * Build GetTerminalInfo command (CommandType 109)
 * MANDATORY: Must be sent before any transaction!
 */
export const buildGetTerminalInfoCommand = (): string => {
  return buildECRMessage('109');
};

/**
 * Build GetStatus command (CommandType 114)
 */
export const buildGetStatusCommand = (): string => {
  return buildECRMessage('114');
};

/**
 * Build LastTransactionStatus command (CommandType 106)
 */
export const buildLastTransactionStatusCommand = (): string => {
  return buildECRMessage('106');
};

/**
 * Build Reconciliation command (CommandType 112)
 */
export const buildReconciliationCommand = (): string => {
  return buildECRMessage('112');
};

/**
 * Build GetTotals command (CommandType 105)
 */
export const buildGetTotalsCommand = (): string => {
  return buildECRMessage('105');
};

/**
 * Parse intermediate status code from XML
 */
export const parseIntermediateStatus = (xml: string): string | null => {
  const match = xml.match(/<StatusCode>(\d+)<\/StatusCode>/);
  return match ? match[1] : null;
};

/**
 * Intermediate status code meanings
 */
export const INTERMEDIATE_STATUS_CODES: Record<string, { event: string; arabicMessage: string }> = {
  '001': { event: 'INSERT_CARD', arabicMessage: 'الرجاء إدخال البطاقة' },
  '002': { event: 'CARD_INSERTED', arabicMessage: 'تم إدخال البطاقة' },
  '003': { event: 'FALLBACK', arabicMessage: 'جاري التبديل لقراءة أخرى' },
  '005': { event: 'CARD_SWIPED', arabicMessage: 'تم تمرير البطاقة' },
  '006': { event: 'ENTER_PIN', arabicMessage: 'الرجاء إدخال الرقم السري' },
  '007': { event: 'PIN_ENTERED', arabicMessage: 'تم إدخال الرقم السري' },
  '008': { event: 'PROCESSING', arabicMessage: 'جاري الاتصال بالبنك...' },
  '009': { event: 'RESPONSE_RECEIVED', arabicMessage: 'تم استلام الرد من البنك' },
  '010': { event: 'PRINTING', arabicMessage: 'جاري طباعة الإيصال...' },
  '011': { event: 'REMOVE_CARD', arabicMessage: 'الرجاء إزالة البطاقة' },
  '012': { event: 'CARD_REMOVED', arabicMessage: 'تم إزالة البطاقة' },
  '013': { event: 'APPROVED', arabicMessage: 'تمت العملية بنجاح' },
  '014': { event: 'DECLINED', arabicMessage: 'فشلت العملية' },
  '015': { event: 'REVERSAL', arabicMessage: 'جاري إلغاء العملية...' },
  '018': { event: 'END_TRANSACTION', arabicMessage: 'انتهت العملية' },
};
