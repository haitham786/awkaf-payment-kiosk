-- Add soft_pos_enabled column to kiosk_settings
ALTER TABLE public.kiosk_settings 
ADD COLUMN IF NOT EXISTS pos_type TEXT DEFAULT 'hard_pos' CHECK (pos_type IN ('hard_pos', 'soft_pos'));

-- Add soft POS configuration columns to kiosk_settings
ALTER TABLE public.kiosk_settings 
ADD COLUMN IF NOT EXISTS soft_pos_config JSONB DEFAULT NULL;

-- The soft_pos_config JSON structure will contain:
-- {
--   "merchant_id": "string",
--   "terminal_id": "string",
--   "api_key": "string",
--   "sdk_endpoint": "string",
--   "callback_url": "string",
--   "provider_name": "string"
-- }

-- Create table for offline transaction queue
CREATE TABLE IF NOT EXISTS public.offline_transaction_queue (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  transaction_data JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'synced', 'failed')),
  retry_count INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  synced_at TIMESTAMP WITH TIME ZONE,
  kiosk_id UUID REFERENCES public.kiosks(id) ON DELETE CASCADE
);

-- Enable RLS on offline_transaction_queue
ALTER TABLE public.offline_transaction_queue ENABLE ROW LEVEL SECURITY;

-- Allow all operations on offline_transaction_queue (kiosk-level access)
CREATE POLICY "Allow all operations on offline_transaction_queue" 
ON public.offline_transaction_queue 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Add index for efficient querying of pending transactions
CREATE INDEX IF NOT EXISTS idx_offline_queue_status ON public.offline_transaction_queue(status);
CREATE INDEX IF NOT EXISTS idx_offline_queue_kiosk ON public.offline_transaction_queue(kiosk_id);