import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, Users, FolderOpen, FileQuestion, Target, Settings, Save, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { adminService, AppStats, ConfigItem } from "@/services/admin.service";
import { Header } from "@/components/layout/Header";
import { PageContainer } from "@/components/layout/PageContainer";
import { LoadingSpinner } from "@/components/layout/LoadingSpinner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

interface ConfigGroupItem {
  key: string;
  label: string;
  description: string;
}

const freePlanConfig: ConfigGroupItem[] = [
  { key: 'free_max_collections', label: 'Max Samlingar', description: 'Maximalt antal samlingar' },
  { key: 'free_max_materials_total', label: 'Max Material Totalt', description: 'Totalt antal sidor/bilder' },
  { key: 'free_max_materials_per_collection', label: 'Max Material/Samling', description: 'Per samling' },
  { key: 'free_max_quizzes_per_collection', label: 'Max Quiz/Samling', description: 'Per samling' },
];

const studentPlanConfig: ConfigGroupItem[] = [
  { key: 'student_max_collections', label: 'Max Samlingar', description: 'Maximalt antal samlingar' },
  { key: 'student_max_materials_total', label: 'Max Material Totalt', description: 'Totalt antal sidor/bilder' },
  { key: 'student_max_quizzes_per_collection', label: 'Max Quiz/Samling', description: 'Per samling' },
  { key: 'student_price_sek', label: 'Pris (SEK/månad)', description: 'Månadspris i kronor' },
];

const proPlanConfig: ConfigGroupItem[] = [
  { key: 'pro_price_sek', label: 'Pris (SEK/månad)', description: 'Månadspris i kronor' },
];

export default function Admin() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, signOut } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const [stats, setStats] = useState<AppStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [config, setConfig] = useState<Record<string, string>>({});
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [savingKeys, setSavingKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!adminLoading && !isAdmin) {
      navigate("/dashboard");
    }
  }, [isAdmin, adminLoading, navigate]);

  useEffect(() => {
    async function loadData() {
      if (isAdmin) {
        try {
          const [appStats, configItems] = await Promise.all([
            adminService.getAppStats(),
            adminService.getConfig(),
          ]);
          setStats(appStats);
          
          const configMap: Record<string, string> = {};
          configItems.forEach((item) => {
            configMap[item.key] = item.value;
          });
          setConfig(configMap);
        } catch (error) {
          console.error("Error loading data:", error);
        } finally {
          setLoadingStats(false);
          setLoadingConfig(false);
        }
      }
    }

    if (isAdmin) {
      loadData();
    }
  }, [isAdmin]);

  const handleConfigChange = (key: string, value: string) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  const handleSaveConfig = async (key: string) => {
    setSavingKeys(prev => new Set(prev).add(key));
    try {
      await adminService.updateConfig(key, config[key]);
      toast({
        title: 'Sparat',
        description: `${key} har uppdaterats.`,
      });
    } catch (error: any) {
      toast({
        title: 'Fel',
        description: error?.message || 'Kunde inte spara konfiguration.',
        variant: 'destructive',
      });
    } finally {
      setSavingKeys(prev => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  if (adminLoading || !isAdmin) {
    return <LoadingSpinner />;
  }

  return (
    <PageContainer>
      <Header onSignOut={signOut} />

      <main className="flex-1 px-4 py-6 space-y-6">
        {/* Admin Header */}
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-primary/10">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Quizla Admin</h1>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
          </div>
        </div>

        {/* App Statistics */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              App Statistics
            </CardTitle>
            <CardDescription>Overview of platform usage</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingStats ? (
              <div className="flex justify-center py-8">
                <LoadingSpinner />
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard
                  icon={<Users className="h-5 w-5" />}
                  label="Users"
                  value={stats?.totalUsers ?? 0}
                />
                <StatCard
                  icon={<FolderOpen className="h-5 w-5" />}
                  label="Collections"
                  value={stats?.totalCollections ?? 0}
                />
                <StatCard
                  icon={<FileQuestion className="h-5 w-5" />}
                  label="Quizzes"
                  value={stats?.totalQuizzes ?? 0}
                />
                <StatCard
                  icon={<Target className="h-5 w-5" />}
                  label="Attempts"
                  value={stats?.totalAttempts ?? 0}
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Freemium Limits Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Freemium Limits
            </CardTitle>
            <CardDescription>Configure usage limits for each plan</CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            {loadingConfig ? (
              <div className="flex justify-center py-8">
                <LoadingSpinner />
              </div>
            ) : (
              <>
                {/* Free Plan */}
                <ConfigSection
                  title="Free Plan"
                  items={freePlanConfig}
                  config={config}
                  onChange={handleConfigChange}
                  onSave={handleSaveConfig}
                  savingKeys={savingKeys}
                />

                {/* Student Plan */}
                <ConfigSection
                  title="Student Plan"
                  items={studentPlanConfig}
                  config={config}
                  onChange={handleConfigChange}
                  onSave={handleSaveConfig}
                  savingKeys={savingKeys}
                />

                {/* Pro Plan */}
                <ConfigSection
                  title="Pro Plan"
                  subtitle="(Obegränsad användning)"
                  items={proPlanConfig}
                  config={config}
                  onChange={handleConfigChange}
                  onSave={handleSaveConfig}
                  savingKeys={savingKeys}
                />
              </>
            )}
          </CardContent>
        </Card>
      </main>
    </PageContainer>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="p-4 rounded-xl bg-muted/50 text-center">
      <div className="flex justify-center mb-2 text-primary">{icon}</div>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

interface ConfigSectionProps {
  title: string;
  subtitle?: string;
  items: ConfigGroupItem[];
  config: Record<string, string>;
  onChange: (key: string, value: string) => void;
  onSave: (key: string) => void;
  savingKeys: Set<string>;
}

function ConfigSection({ title, subtitle, items, config, onChange, onSave, savingKeys }: ConfigSectionProps) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold text-lg">{title}</h3>
        {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {items.map((item) => (
          <div key={item.key} className="space-y-2">
            <Label htmlFor={item.key} className="text-sm">
              {item.label}
            </Label>
            <div className="flex gap-2">
              <Input
                id={item.key}
                type="number"
                value={config[item.key] || ''}
                onChange={(e) => onChange(item.key, e.target.value)}
                className="flex-1"
              />
              <Button
                size="icon"
                onClick={() => onSave(item.key)}
                disabled={savingKeys.has(item.key)}
              >
                {savingKeys.has(item.key) ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">{item.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
