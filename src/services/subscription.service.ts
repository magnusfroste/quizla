import { supabase } from "@/integrations/supabase/client";

export type UserPlan = 'free' | 'student' | 'pro';

export interface Subscription {
  id: string;
  user_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  plan: UserPlan;
  status: string;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  created_at: string;
  updated_at: string;
}

export const subscriptionService = {
  async getUserSubscription(userId: string): Promise<Subscription | null> {
    const { data, error } = await (supabase as any)
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching subscription:', error);
      return null;
    }
    return data;
  },

  async getUserPlan(userId: string): Promise<UserPlan> {
    // First check subscriptions table
    const subscription = await this.getUserSubscription(userId);
    if (subscription && subscription.status === 'active') {
      return subscription.plan;
    }

    // Fall back to profiles table
    const { data, error } = await (supabase as any)
      .from('profiles')
      .select('plan')
      .eq('id', userId)
      .single();

    if (error || !data?.plan) {
      return 'free';
    }

    return data.plan as UserPlan;
  },
};
