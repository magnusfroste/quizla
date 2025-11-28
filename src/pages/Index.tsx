import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Zap, Sparkles, Users, Trophy, ArrowRight, Camera, BookOpen, Brain } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background overflow-hidden">
      {/* Hero Section */}
      <section className="relative container mx-auto px-4 py-16 md:py-24">
        {/* Background glow */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/20 rounded-full blur-3xl" />
        </div>

        <div className="text-center max-w-3xl mx-auto">
          {/* Logo */}
          <div className="inline-flex items-center justify-center mb-8 animate-slide-up">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-primary to-accent blur-xl opacity-50 scale-150" />
              <div className="relative bg-gradient-to-br from-primary to-accent p-4 rounded-2xl shadow-glow">
                <Zap className="h-10 w-10 text-primary-foreground" />
              </div>
            </div>
          </div>

          <h1 className="text-4xl md:text-6xl font-extrabold mb-6 animate-slide-up stagger-1">
            <span className="text-gradient">Snap. Quiz. </span>
            <span className="text-foreground">Ace.</span>
          </h1>

          <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-xl mx-auto animate-slide-up stagger-2">
            Turn your study notes into AI quizzes in seconds. Just snap a photo and let the magic happen.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center animate-slide-up stagger-3">
            <Button
              size="lg"
              onClick={() => navigate("/auth")}
              className="h-14 px-8 text-lg font-semibold bg-gradient-to-r from-primary to-primary-dark hover:opacity-90 transition-all shadow-glow"
            >
              Start Free
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => navigate("/auth")}
              className="h-14 px-8 text-lg font-semibold border-2"
            >
              Sign In
            </Button>
          </div>

          {/* Social proof */}
          <p className="mt-8 text-sm text-muted-foreground animate-slide-up stagger-4">
            <Users className="inline h-4 w-4 mr-1" />
            Join 10,000+ students studying smarter
          </p>
        </div>
      </section>

      {/* How it works */}
      <section className="container mx-auto px-4 py-16">
        <h2 className="text-2xl md:text-3xl font-bold text-center mb-12">
          How Quizla Works
        </h2>

        <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {[
            {
              icon: Camera,
              title: "1. Snap Your Notes",
              description: "Take photos of textbooks, handwritten notes, or slides",
              color: "from-primary to-primary-dark",
            },
            {
              icon: Brain,
              title: "2. AI Extracts Content",
              description: "Our AI reads and understands your study materials",
              color: "from-secondary to-secondary",
            },
            {
              icon: Sparkles,
              title: "3. Get Smart Quizzes",
              description: "Receive personalized quizzes with instant feedback",
              color: "from-accent to-accent",
            },
          ].map((step, index) => (
            <div
              key={step.title}
              className="relative group animate-slide-up"
              style={{ animationDelay: `${0.1 * (index + 1)}s` }}
            >
              <div className="absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-10 rounded-2xl transition-opacity" />
              <div className="bg-card border rounded-2xl p-6 text-center hover:border-primary/50 transition-colors h-full">
                <div className={`inline-flex p-4 rounded-xl bg-gradient-to-br ${step.color} mb-4`}>
                  <step.icon className="h-6 w-6 text-white" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{step.title}</h3>
                <p className="text-muted-foreground text-sm">{step.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Features highlight */}
      <section className="container mx-auto px-4 py-16">
        <div className="bg-gradient-to-br from-primary/5 via-transparent to-accent/5 rounded-3xl p-8 md:p-12 border border-border/50">
          <div className="flex flex-col md:flex-row items-center gap-8">
            <div className="flex-1">
              <Trophy className="h-12 w-12 text-primary mb-4" />
              <h2 className="text-2xl md:text-3xl font-bold mb-4">
                Study Smarter, Not Harder
              </h2>
              <p className="text-muted-foreground mb-6">
                Quizla creates quizzes that test what matters most. Share with classmates, track your progress, and master any subject.
              </p>
              <Button
                size="lg"
                onClick={() => navigate("/auth")}
                className="bg-gradient-to-r from-primary to-primary-dark"
              >
                Get Started Free
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </div>
            <div className="flex-1 grid grid-cols-2 gap-4">
              {[
                { icon: BookOpen, label: "Unlimited Quizzes" },
                { icon: Users, label: "Share with Friends" },
                { icon: Trophy, label: "Track Progress" },
                { icon: Sparkles, label: "AI-Powered" },
              ].map((feature) => (
                <div key={feature.label} className="bg-card/50 rounded-xl p-4 text-center border">
                  <feature.icon className="h-6 w-6 mx-auto mb-2 text-primary" />
                  <p className="text-sm font-medium">{feature.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t mt-16 py-8">
        <div className="container mx-auto px-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Zap className="h-5 w-5 text-primary" />
            <span className="font-bold">Quizla</span>
          </div>
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} Quizla. Snap. Quiz. Ace.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
