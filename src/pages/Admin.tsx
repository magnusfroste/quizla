import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, Users, FolderOpen, FileQuestion, Target, Settings } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { adminService, AppStats } from "@/services/admin.service";
import { Header } from "@/components/layout/Header";
import { PageContainer } from "@/components/layout/PageContainer";
import { LoadingSpinner } from "@/components/layout/LoadingSpinner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function Admin() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const [stats, setStats] = useState<AppStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    if (!adminLoading && !isAdmin) {
      navigate("/dashboard");
    }
  }, [isAdmin, adminLoading, navigate]);

  useEffect(() => {
    async function loadStats() {
      if (isAdmin) {
        try {
          const appStats = await adminService.getAppStats();
          setStats(appStats);
        } catch (error) {
          console.error("Error loading stats:", error);
        } finally {
          setLoadingStats(false);
        }
      }
    }

    if (isAdmin) {
      loadStats();
    }
  }, [isAdmin]);

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
            <h1 className="text-2xl font-bold">QuizGeni Admin</h1>
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

        {/* Configuration Placeholder */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              System Configuration
            </CardTitle>
            <CardDescription>Manage app settings and features</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-muted-foreground">
              <Settings className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Configuration options coming soon</p>
              <p className="text-sm mt-2">AI model settings, feature flags, user management</p>
            </div>
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
