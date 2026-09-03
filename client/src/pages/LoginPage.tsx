import { SignIn } from "@clerk/react";
import { ShieldCheck, ShieldAlert, RefreshCw, CircleCheckBig } from "lucide-react";

const VALUE_PROPS = [
  {
    icon: ShieldAlert,
    title: "Detect revenue at risk",
    description:
      "Failed payments, subscription lapses and settlement issues are surfaced the moment they happen.",
  },
  {
    icon: RefreshCw,
    title: "Run recovery playbooks",
    description:
      "A deterministic decision engine ranks retry, wait and payment-link strategies by expected value.",
  },
  {
    icon: CircleCheckBig,
    title: "Stay in control",
    description:
      "Policy ceilings and daily caps route anything unusual to human approval before it executes.",
  },
];

export function LoginPage() {
  return (
    <div className="flex min-h-screen bg-background">
      {/* Brand panel */}
      <div className="relative hidden w-1/2 flex-col justify-between bg-foreground p-12 text-background lg:flex">
        <div className="flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-md bg-background/10">
            <ShieldCheck className="size-5" />
          </div>
          <span className="text-lg font-semibold">RevPilot</span>
        </div>

        <div className="max-w-md space-y-10">
          <div className="space-y-3">
            <h2 className="text-3xl font-semibold leading-tight tracking-tight">
              Revenue operations, automated.
            </h2>
            <p className="text-sm text-background/70">
              RevPilot watches your Razorpay revenue for failed payments and
              settlement risk, then runs the recovery playbook that gives you
              the best odds of getting paid.
            </p>
          </div>

          <div className="space-y-6">
            {VALUE_PROPS.map((prop) => {
              const Icon = prop.icon;
              return (
                <div key={prop.title} className="flex gap-3.5">
                  <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-background/10">
                    <Icon className="size-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{prop.title}</p>
                    <p className="mt-0.5 text-sm text-background/60">
                      {prop.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <p className="text-xs text-background/50">
          © {new Date().getFullYear()} RevPilot. Built for merchant revenue
          operations teams.
        </p>
      </div>

      {/* Sign-in panel */}
      <div className="flex w-full flex-col items-center justify-center px-6 py-12 lg:w-1/2">
        <div className="mb-8 flex items-center gap-2.5 lg:hidden">
          <div className="flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <ShieldCheck className="size-5" />
          </div>
          <span className="text-lg font-semibold text-foreground">
            RevPilot
          </span>
        </div>

        <SignIn
          appearance={{
            elements: {
              rootBox: "w-full max-w-sm",
              card: "shadow-none border border-border w-full",
              headerTitle: "text-foreground",
              headerSubtitle: "text-muted-foreground",
              formButtonPrimary:
                "bg-primary text-primary-foreground hover:bg-primary/90",
              footerActionLink: "text-primary hover:text-primary/90",
            },
            variables: {
              colorPrimary: "#171717",
              borderRadius: "0.5rem",
            },
          }}
        />
      </div>
    </div>
  );
}
