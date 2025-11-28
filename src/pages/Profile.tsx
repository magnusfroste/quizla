import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Header } from "@/components/layout/Header";
import { useUserLimits } from "@/hooks/useUserLimits";
import { User, Mail, Calendar, Crown, Sparkles, Shield, ArrowLeft, ExternalLink } from "lucide-react";
import { format } from "date-fns";

interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
  plan?: 'free' | 'student' | 'pro';
}

const planLabels = {
  free: 'Free',
  student: 'Student',
  pro: 'Pro',
};

const planColors = {
  free: 'secondary',
  student: 'default',
  pro: 'default',
} as const;

const Profile = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [fullName, setFullName] = useState("");
  const { plan, limits, usage, config, loading: limitsLoading } = useUserLimits();

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }
      await loadProfile(session.user.id);
    };
    init();
  }, [navigate]);

  const loadProfile = async (userId: string) => {
    try {
      const { data, error } = await (supabase as any)
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) throw error;
      
      if (data) {
        setProfile(data);
        setFullName(data.full_name || "");
      }
    } catch (e: any) {
      console.error('Failed to load profile', e);
      toast({
        title: 'Could not load profile',
        description: e?.message || 'Please try again later.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!profile) return;
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: fullName })
        .eq('id', profile.id);

      if (error) throw error;

      setProfile({ ...profile, full_name: fullName });
      toast({
        title: 'Profile updated',
        description: 'Your changes have been saved.',
      });
    } catch (e: any) {
      console.error('Failed to save profile', e);
      toast({
        title: 'Save failed',
        description: e?.message || 'Could not save profile',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-muted/30 to-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background">
      <Header onSignOut={handleSignOut} />
      
      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <Button 
          variant="ghost" 
          onClick={() => navigate('/dashboard')}
          className="mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Button>

        <div className="space-y-6">
          {/* Profile Header */}
          <div className="text-center mb-8">
            <div className="relative inline-block">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-3xl font-bold text-primary-foreground">
                {profile?.full_name?.[0]?.toUpperCase() || profile?.email?.[0]?.toUpperCase() || "U"}
              </div>
              <div className="absolute -bottom-1 -right-1 bg-muted rounded-full p-1.5 border-2 border-background">
                {plan === 'pro' ? (
                  <Crown className="h-4 w-4 text-primary" />
                ) : plan === 'student' ? (
                  <Sparkles className="h-4 w-4 text-primary" />
                ) : (
                  <Shield className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
            </div>
            <h1 className="text-2xl font-bold mt-4">{profile?.full_name || "Student"}</h1>
            <p className="text-muted-foreground">{profile?.email}</p>
            <Badge variant={planColors[plan]} className="mt-2">
              {planLabels[plan]} Plan
            </Badge>
          </div>

          {/* Profile Info Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5 text-primary" />
                Profile Information
              </CardTitle>
              <CardDescription>
                Update your personal details
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name</Label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Enter your full name"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">{profile?.email}</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Member Since</Label>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">
                    {profile?.created_at ? format(new Date(profile.created_at), 'MMMM d, yyyy') : '-'}
                  </span>
                </div>
              </div>

              <Button 
                onClick={handleSave} 
                disabled={saving}
                className="w-full mt-4"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </CardContent>
          </Card>

          {/* Plan & Usage Card */}
          <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-accent/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Crown className="h-5 w-5 text-primary" />
                Your Plan & Usage
              </CardTitle>
              <CardDescription>
                {plan === 'free' ? 'Upgrade for more features' : 'Manage your subscription'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Current Plan */}
              <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                <div>
                  <p className="font-semibold">{planLabels[plan]} Plan</p>
                  <p className="text-sm text-muted-foreground">
                    {plan === 'pro' ? 'Unlimited access' : plan === 'student' ? 'Enhanced features' : 'Basic quiz generation'}
                  </p>
                </div>
                {plan === 'pro' ? (
                  <Crown className="h-8 w-8 text-primary" />
                ) : plan === 'student' ? (
                  <Sparkles className="h-8 w-8 text-primary" />
                ) : (
                  <Shield className="h-8 w-8 text-muted-foreground" />
                )}
              </div>

              {/* Usage Stats */}
              {!limitsLoading && plan !== 'pro' && (
                <div className="space-y-3">
                  <p className="text-sm font-medium">Din användning</p>
                  <div className="grid gap-2">
                    <UsageRow
                      label="Samlingar"
                      used={usage.collections}
                      max={limits.maxCollections}
                    />
                    <UsageRow
                      label="Material totalt"
                      used={usage.materialsTotal}
                      max={limits.maxMaterialsTotal}
                    />
                  </div>
                </div>
              )}

              {/* Upgrade CTA */}
              {plan === 'free' && (
                <div className="mt-4 p-4 rounded-lg border border-primary/30 bg-primary/5">
                  <div className="flex items-start gap-3">
                    <Sparkles className="h-5 w-5 text-primary mt-0.5" />
                    <div>
                      <p className="font-semibold text-primary">Uppgradera till Student</p>
                      <ul className="text-sm text-muted-foreground mt-2 space-y-1">
                        <li>• {config.student_max_collections} samlingar</li>
                        <li>• {config.student_max_materials_total} sidor totalt</li>
                        <li>• {config.student_max_quizzes_per_collection} quiz per samling</li>
                        <li>• Prioriterad support</li>
                      </ul>
                    </div>
                  </div>
                  <Button 
                    variant="outline" 
                    className="w-full mt-4 border-primary/30 text-primary hover:bg-primary/10"
                    onClick={() => navigate('/pricing')}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Se alla planer
                  </Button>
                </div>
              )}

              {/* Manage subscription (for paid plans) */}
              {plan !== 'free' && (
                <Button 
                  variant="outline" 
                  className="w-full"
                  disabled
                >
                  Hantera prenumeration (Kommer snart)
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Danger Zone */}
          <Card className="border-destructive/20">
            <CardHeader>
              <CardTitle className="text-destructive">Danger Zone</CardTitle>
              <CardDescription>
                Irreversible account actions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                variant="destructive" 
                onClick={handleSignOut}
                className="w-full"
              >
                Sign Out
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

function UsageRow({ label, used, max }: { label: string; used: number; max: number }) {
  const percentage = max === Infinity ? 0 : Math.min((used / max) * 100, 100);
  const isNearLimit = percentage >= 80;
  const isAtLimit = percentage >= 100;

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className={isAtLimit ? 'text-destructive font-medium' : isNearLimit ? 'text-yellow-500' : ''}>
          {used}/{max === Infinity ? '∞' : max}
        </span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full transition-all ${
            isAtLimit ? 'bg-destructive' : isNearLimit ? 'bg-yellow-500' : 'bg-primary'
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

export default Profile;
