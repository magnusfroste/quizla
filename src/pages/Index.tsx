import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Brain, Sparkles, Users, Trophy, ArrowRight, BookOpen } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background">
      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20">
        <div className="text-center max-w-4xl mx-auto">
          <div className="inline-flex items-center justify-center mb-6">
            <div className="bg-gradient-to-br from-primary to-primary-dark p-4 rounded-3xl shadow-medium">
              <Brain className="h-12 w-12 text-white" />
            </div>
          </div>
          <h1 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-primary to-primary-dark bg-clip-text text-transparent">
            Turn Your Notes Into
            <br />
            AI-Powered Quizzes
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Upload photos of your study materials and let AI instantly generate personalized quizzes. 
            Study smarter, retain more, and ace your exams.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              size="lg"
              onClick={() => navigate("/auth")}
              className="bg-gradient-to-r from-primary to-primary-dark text-lg px-8"
            >
              Get Started Free
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => navigate("/auth")}
              className="text-lg px-8"
            >
              Sign In
            </Button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="container mx-auto px-4 py-16">
        <div className="grid md:grid-cols-3 gap-8">
          <div className="text-center p-6">
            <div className="bg-primary/10 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <BookOpen className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Upload Study Materials</h3>
            <p className="text-muted-foreground">
              Take photos or upload images of your textbooks, notes, or any study material.
            </p>
          </div>
          <div className="text-center p-6">
            <div className="bg-secondary/10 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Sparkles className="h-8 w-8 text-secondary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">AI Generates Quizzes</h3>
            <p className="text-muted-foreground">
              Our AI analyzes your materials and creates intelligent multiple-choice quizzes.
            </p>
          </div>
          <div className="text-center p-6">
            <div className="bg-accent/10 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Trophy className="h-8 w-8 text-accent" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Get Instant Feedback</h3>
            <p className="text-muted-foreground">
              Learn from detailed explanations and track your progress over time.
            </p>
          </div>
        </div>
      </section>

      {/* Sharing Feature */}
      <section className="container mx-auto px-4 py-16">
        <div className="bg-gradient-to-br from-primary/5 to-primary-dark/5 rounded-3xl p-12 text-center border">
          <Users className="h-12 w-12 text-primary mx-auto mb-4" />
          <h2 className="text-3xl font-bold mb-4">Share Your Knowledge</h2>
          <p className="text-lg text-muted-foreground mb-6 max-w-2xl mx-auto">
            Create collections, share with classmates, and collaborate on study materials. 
            Anyone can take your quizzes with a simple link.
          </p>
          <Button
            size="lg"
            onClick={() => navigate("/auth")}
            className="bg-gradient-to-r from-primary to-primary-dark"
          >
            Start Creating Quizzes
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t mt-20 py-8">
        <div className="container mx-auto px-4 text-center text-muted-foreground">
          <p>© 2025 QuizGenius. AI-powered learning made simple.</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
