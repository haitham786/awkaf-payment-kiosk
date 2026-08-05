CREATE TABLE public.messaging_rates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sms_unit_cost_omr numeric NOT NULL DEFAULT 0,
  whatsapp_unit_cost_omr numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.messaging_rates TO authenticated;
GRANT ALL ON public.messaging_rates TO service_role;

ALTER TABLE public.messaging_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage messaging rates"
ON public.messaging_rates
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE TRIGGER update_messaging_rates_updated_at
BEFORE UPDATE ON public.messaging_rates
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.messaging_rates (sms_unit_cost_omr, whatsapp_unit_cost_omr) VALUES (0, 0);