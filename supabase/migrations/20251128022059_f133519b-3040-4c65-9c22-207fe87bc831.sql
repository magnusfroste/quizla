-- Create user_plan enum
CREATE TYPE public.user_plan AS ENUM ('free', 'student', 'pro');

-- Add plan column to profiles
ALTER TABLE public.profiles 
ADD COLUMN plan user_plan DEFAULT 'free';

-- Create subscriptions table (prepared for Stripe)
CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  plan user_plan NOT NULL DEFAULT 'free',
  status TEXT NOT NULL DEFAULT 'active',
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on subscriptions
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS policies for subscriptions
CREATE POLICY "Users can view own subscription"
ON public.subscriptions FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "System can manage subscriptions"
ON public.subscriptions FOR ALL
USING (true)
WITH CHECK (true);

-- Create app_config table for freemium limits
CREATE TABLE public.app_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Enable RLS on app_config
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

-- RLS policies for app_config
CREATE POLICY "Anyone can read config"
ON public.app_config FOR SELECT
USING (true);

CREATE POLICY "Admins can update config"
ON public.app_config FOR UPDATE
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert config"
ON public.app_config FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'));

-- Insert initial config values
INSERT INTO public.app_config (key, value, description) VALUES
  ('free_max_collections', '3', 'Max collections for free users'),
  ('free_max_materials_total', '20', 'Max total materials for free users'),
  ('free_max_materials_per_collection', '10', 'Max materials per collection for free'),
  ('free_max_quizzes_per_collection', '2', 'Max quizzes per collection for free'),
  ('student_max_collections', '20', 'Max collections for student plan'),
  ('student_max_materials_total', '200', 'Max total materials for student plan'),
  ('student_max_quizzes_per_collection', '10', 'Max quizzes per collection for student'),
  ('student_price_sek', '49', 'Monthly price in SEK for student plan'),
  ('pro_price_sek', '99', 'Monthly price in SEK for pro plan');

-- Trigger for updated_at on subscriptions
CREATE TRIGGER update_subscriptions_updated_at
BEFORE UPDATE ON public.subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- Trigger for updated_at on app_config
CREATE TRIGGER update_app_config_updated_at
BEFORE UPDATE ON public.app_config
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();