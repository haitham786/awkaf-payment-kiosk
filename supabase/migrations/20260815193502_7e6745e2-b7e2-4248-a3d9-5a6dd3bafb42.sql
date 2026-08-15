CREATE UNIQUE INDEX IF NOT EXISTS kiosks_hardware_pos_tid_unique
ON public.kiosks (((configuration -> 'hardware_pos') ->> 'tid'))
WHERE (configuration ->> 'payment_mode') = 'hardware_pos'
  AND COALESCE((configuration -> 'hardware_pos') ->> 'tid', '') <> '';