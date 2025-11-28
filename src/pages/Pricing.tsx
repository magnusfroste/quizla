import { useNavigate } from "react-router-dom";
import { Check, Sparkles, Crown, ArrowLeft } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useUserLimits } from "@/hooks/useUserLimits";
import { Header } from "@/components/layout/Header";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface PlanFeature {
  text: string;
  included: boolean;
}

interface PricingPlan {
  id: 'free' | 'student' | 'pro';
  name: string;
  price: number;
  description: string;
  features: PlanFeature[];
  popular?: boolean;
  comingSoon?: boolean;
}

export default function Pricing() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { plan: currentPlan, config, loading } = useUserLimits();

  const plans: PricingPlan[] = [
    {
      id: 'free',
      name: 'Free',
      price: 0,
      description: 'Perfekt för att testa Quizla',
      features: [
        { text: `${config.free_max_collections} samlingar`, included: true },
        { text: `${config.free_max_materials_total} sidor totalt`, included: true },
        { text: `${config.free_max_quizzes_per_collection} quiz per samling`, included: true },
        { text: 'AI-genererade quiz', included: true },
        { text: 'Spaced Repetition', included: false },
        { text: 'Prioriterad support', included: false },
      ],
    },
    {
      id: 'student',
      name: 'Student',
      price: config.student_price_sek,
      description: 'För seriösa studenter',
      popular: true,
      comingSoon: true,
      features: [
        { text: `${config.student_max_collections} samlingar`, included: true },
        { text: `${config.student_max_materials_total} sidor totalt`, included: true },
        { text: `${config.student_max_quizzes_per_collection} quiz per samling`, included: true },
        { text: 'AI-genererade quiz', included: true },
        { text: 'Spaced Repetition (snart)', included: true },
        { text: 'Prioriterad support', included: true },
      ],
    },
    {
      id: 'pro',
      name: 'Pro',
      price: config.pro_price_sek,
      description: 'Obegränsad tillgång',
      comingSoon: true,
      features: [
        { text: 'Obegränsade samlingar', included: true },
        { text: 'Obegränsade sidor', included: true },
        { text: 'Obegränsade quiz', included: true },
        { text: 'AI-genererade quiz', included: true },
        { text: 'Spaced Repetition (snart)', included: true },
        { text: 'Prioriterad support', included: true },
      ],
    },
  ];

  const handleSelectPlan = (planId: string) => {
    if (planId === 'free' || planId === currentPlan) return;
    // TODO: Implement Stripe checkout when ready
  };

  return (
    <PageContainer>
      <Header onSignOut={signOut} />

      <main className="flex-1 px-4 py-6 space-y-8">
        {/* Back button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(-1)}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Tillbaka
        </Button>

        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">Välj din plan</h1>
          <p className="text-muted-foreground max-w-md mx-auto">
            Lås upp din fulla potential som student med Quizla
          </p>
        </div>

        {/* Plans grid */}
        <div className="grid gap-6 md:grid-cols-3 max-w-5xl mx-auto">
          {plans.map((plan) => {
            const isCurrentPlan = plan.id === currentPlan;
            
            return (
              <Card
                key={plan.id}
                className={cn(
                  "relative flex flex-col",
                  plan.popular && "border-primary shadow-lg",
                  isCurrentPlan && "ring-2 ring-primary"
                )}
              >
                {plan.popular && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 gap-1">
                    <Sparkles className="h-3 w-3" />
                    Populär
                  </Badge>
                )}

                <CardHeader className="text-center pb-2">
                  <div className="flex justify-center mb-2">
                    {plan.id === 'pro' ? (
                      <Crown className="h-8 w-8 text-primary" />
                    ) : plan.id === 'student' ? (
                      <Sparkles className="h-8 w-8 text-primary" />
                    ) : (
                      <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                        <Check className="h-4 w-4" />
                      </div>
                    )}
                  </div>
                  <CardTitle>{plan.name}</CardTitle>
                  <CardDescription>{plan.description}</CardDescription>
                </CardHeader>

                <CardContent className="flex-1 flex flex-col">
                  {/* Price */}
                  <div className="text-center mb-6">
                    <span className="text-4xl font-bold">{plan.price}</span>
                    <span className="text-muted-foreground"> kr/mån</span>
                  </div>

                  {/* Features */}
                  <ul className="space-y-3 flex-1 mb-6">
                    {plan.features.map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <Check
                          className={cn(
                            "h-4 w-4 mt-0.5 flex-shrink-0",
                            feature.included ? "text-green-500" : "text-muted-foreground/30"
                          )}
                        />
                        <span
                          className={cn(
                            "text-sm",
                            !feature.included && "text-muted-foreground/50 line-through"
                          )}
                        >
                          {feature.text}
                        </span>
                      </li>
                    ))}
                  </ul>

                  {/* CTA Button */}
                  <Button
                    className="w-full"
                    variant={isCurrentPlan ? "outline" : plan.popular ? "default" : "secondary"}
                    disabled={isCurrentPlan || plan.comingSoon}
                    onClick={() => handleSelectPlan(plan.id)}
                  >
                    {isCurrentPlan
                      ? "Nuvarande plan"
                      : plan.comingSoon
                      ? "Kommer snart"
                      : "Uppgradera"}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* FAQ or additional info */}
        <div className="text-center text-sm text-muted-foreground max-w-md mx-auto">
          <p>
            Alla planer inkluderar AI-genererade quiz baserade på dina studiematerial.
            Uppgradera när som helst för att låsa upp fler funktioner.
          </p>
        </div>
      </main>
    </PageContainer>
  );
}
