import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Header } from "@/components/layout/Header";
import { User, Mail, Calendar, Crown, Sparkles, Shield, ArrowLeft } from "lucide-react";
import { format } from "date-fns";

interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

const Profile = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [fullName, setFullName] = useState("");

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
      const { data, error } = await supabase
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
                <Shield className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>
            <h1 className="text-2xl font-bold mt-4">{profile?.full_name || "Student"}</h1>
            <p className="text-muted-foreground">{profile?.email}</p>
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

          {/* Plan Card - Pro Plan Placeholder */}
          <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-accent/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Crown className="h-5 w-5 text-primary" />
                Your Plan
              </CardTitle>
              <CardDescription>
                Upgrade for more features
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                <div>
                  <p className="font-semibold">Free Plan</p>
                  <p className="text-sm text-muted-foreground">Basic quiz generation</p>
                </div>
                <Shield className="h-8 w-8 text-muted-foreground" />
              </div>
              
              <div className="mt-6 p-4 rounded-lg border border-primary/30 bg-primary/5">
                <div className="flex items-start gap-3">
                  <Sparkles className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <p className="font-semibold text-primary">Pro Plan Coming Soon</p>
                    <ul className="text-sm text-muted-foreground mt-2 space-y-1">
                      <li>• Unlimited quiz generations</li>
                      <li>• Advanced AI analysis</li>
                      <li>• Priority support</li>
                      <li>• Export to multiple formats</li>
                    </ul>
                  </div>
                </div>
                <Button 
                  variant="outline" 
                  className="w-full mt-4 border-primary/30 text-primary hover:bg-primary/10"
                  disabled
                >
                  Coming Soon
                </Button>
              </div>
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

export default Profile;
