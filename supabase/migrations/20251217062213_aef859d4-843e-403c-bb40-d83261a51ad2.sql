-- Add POS reference fields to transactions table for OM-A880 integration
-- These fields store bank transaction data alongside the existing system reference

ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS pos_rrn TEXT,
ADD COLUMN IF NOT EXISTS pos_auth_code TEXT,
ADD COLUMN IF NOT EXISTS pos_tid TEXT,
ADD COLUMN IF NOT EXISTS pos_mid TEXT,
ADD COLUMN IF NOT EXISTS pos_response_code TEXT;

-- Add comment for documentation
COMMENT ON COLUMN public.transactions.pos_rrn IS 'Bank Transaction Reference (RRN) from POS';
COMMENT ON COLUMN public.transactions.pos_auth_code IS 'Authorization Code from POS';
COMMENT ON COLUMN public.transactions.pos_tid IS 'Terminal ID from POS';
COMMENT ON COLUMN public.transactions.pos_mid IS 'Merchant ID from POS';
COMMENT ON COLUMN public.transactions.pos_response_code IS 'Response code from POS';

-- Create index for searching by POS RRN for bank reconciliation
CREATE INDEX IF NOT EXISTS idx_transactions_pos_rrn ON public.transactions(pos_rrn) WHERE pos_rrn IS NOT NULL;