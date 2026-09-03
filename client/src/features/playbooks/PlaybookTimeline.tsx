import type { ReactNode } from "react";
import { motion, type Variants } from "framer-motion";
import {
  ShieldAlert,
  RefreshCw,
  Clock,
  Link2,
  ArrowUpRight,
  UserCheck,
  Ban,
  CircleCheckBig,
  Inbox,
  XCircle,
  HelpCircle,
  type LucideIcon,
} from "lucide-react";
import type { PlaybookDetail, RecoveryActionItem } from "@/hooks/usePlaybooks";
import {
  formatCurrency,
  formatDateTime,
  formatOutcome,
  formatPercent,
  formatPlaybookStatus,
  formatRootCause,
  formatSourceType,
  formatStrategy,
} from "@/lib/format";
import {
  badgeClassName,
  dotClassName,
  playbookStatusTone,
  recoveryOutcomeTone,
  type BadgeTone,
} from "@/lib/playbookVisuals";

interface TimelineNode {
  key: string;
  icon: LucideIcon;
  tone: BadgeTone;
  title: string;
  content: ReactNode;
}

const STRATEGY_ICONS: Record<string, LucideIcon> = {
  retry: RefreshCw,
  wait: Clock,
  payment_link: Link2,
  escalate: ArrowUpRight,
  human_approval: UserCheck,
  ignore: Ban,
};

function strategyIcon(strategy: string): LucideIcon {
  return STRATEGY_ICONS[strategy] ?? HelpCircle;
}

function outcomeNodeVisual(status: string): { icon: LucideIcon; tone: BadgeTone } {
  switch (status) {
    case "closed":
      return { icon: CircleCheckBig, tone: "positive" };
    case "escalated":
      return { icon: ShieldAlert, tone: "destructive" };
    case "awaiting_approval":
      return { icon: Inbox, tone: "risk" };
    case "executing":
      return { icon: RefreshCw, tone: "info" };
    default:
      return { icon: XCircle, tone: "neutral" };
  }
}

const OUTCOME_NARRATIVE: Record<string, string> = {
  closed: "Revenue was successfully recovered and the risk event is closed.",
  escalated:
    "The waterfall exhausted its steps without recovering and was escalated for manual follow-up.",
  awaiting_approval: "Held for a manual decision before the next step can run.",
  executing: "The waterfall is currently in progress.",
  generated: "A playbook has been generated and is waiting to start executing.",
};

// Nodes and connectors are driven by a single stagger container so they
// reveal one at a time, top to bottom, rather than all at once.
const containerVariants: Variants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.18, delayChildren: 0.05 },
  },
};

const nodeVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } },
};

const connectorVariants: Variants = {
  hidden: { scaleY: 0 },
  show: { scaleY: 1, transition: { duration: 0.35, ease: "easeOut" } },
};

interface PlaybookTimelineProps {
  playbook: PlaybookDetail;
}

export function PlaybookTimeline({ playbook }: PlaybookTimelineProps) {
  const nodes = buildTimelineNodes(playbook);

  return (
    <div className="max-h-[70vh] overflow-y-auto px-5 py-6">
      <motion.ol
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="relative"
      >
        {nodes.map((node, index) => {
          const Icon = node.icon;
          const isLast = index === nodes.length - 1;
          return (
            <motion.li
              key={node.key}
              variants={nodeVariants}
              className="relative flex gap-4 pb-10 last:pb-0"
            >
              <div className="relative flex w-9 shrink-0 flex-col items-center">
                <div className={dotClassName(node.tone)}>
                  <Icon className="size-4" />
                </div>
                {!isLast ? (
                  <motion.div
                    variants={connectorVariants}
                    style={{ transformOrigin: "top" }}
                    className="mt-1 w-px flex-1 bg-border"
                  />
                ) : null}
              </div>
              <div className="min-w-0 flex-1 rounded-lg border border-border bg-card p-4">
                <h4 className="text-sm font-semibold text-foreground">{node.title}</h4>
                <div className="mt-2 text-sm text-muted-foreground">{node.content}</div>
              </div>
            </motion.li>
          );
        })}
      </motion.ol>
    </div>
  );
}

function buildTimelineNodes(playbook: PlaybookDetail): TimelineNode[] {
  const nodes: TimelineNode[] = [
    {
      key: "diagnosis",
      icon: ShieldAlert,
      tone: "risk",
      title: "Diagnosis",
      content: (
        <div className="space-y-2">
          <p className="font-medium text-foreground">
            {formatRootCause(playbook.root_cause)}
          </p>
          <p>{playbook.explainable_reasoning}</p>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-4">
            <div>
              <dt className="text-muted-foreground">Source</dt>
              <dd className="font-medium text-foreground">
                {formatSourceType(playbook.risk_event.source_type)}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Amount at risk</dt>
              <dd className="font-medium text-foreground">
                {formatCurrency(playbook.risk_event.amount)}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Recovery odds</dt>
              <dd className="font-medium text-foreground">
                {formatPercent(playbook.recovery_probability)}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Chain depth</dt>
              <dd className="font-medium text-foreground">{playbook.chain_depth}</dd>
            </div>
          </dl>
        </div>
      ),
    },
  ];

  playbook.recovery_actions.forEach((action: RecoveryActionItem) => {
    nodes.push({
      key: action.id,
      icon: strategyIcon(action.strategy),
      tone: recoveryOutcomeTone(action.outcome),
      title: `Step ${action.step_number} · ${formatStrategy(action.strategy)}`,
      content: (
        <div className="space-y-2">
          <span className={badgeClassName(recoveryOutcomeTone(action.outcome))}>
            {formatOutcome(action.outcome)}
          </span>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-4">
            <div>
              <dt className="text-muted-foreground">Confidence</dt>
              <dd className="font-medium text-foreground">
                {formatPercent(action.confidence)}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Expected value</dt>
              <dd className="font-medium text-foreground">
                {formatCurrency(action.expected_value)}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Executed</dt>
              <dd className="font-medium text-foreground">
                {formatDateTime(action.executed_at)}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Reference</dt>
              <dd className="truncate font-medium text-foreground">
                {action.razorpay_reference_id ?? "—"}
              </dd>
            </div>
          </dl>
        </div>
      ),
    });
  });

  const outcome = outcomeNodeVisual(playbook.status);
  nodes.push({
    key: "outcome",
    icon: outcome.icon,
    tone: outcome.tone,
    title: "Outcome",
    content: (
      <div className="space-y-2">
        <span className={badgeClassName(playbookStatusTone(playbook.status))}>
          {formatPlaybookStatus(playbook.status)}
        </span>
        <p>{OUTCOME_NARRATIVE[playbook.status] ?? "Status pending."}</p>
        {playbook.status === "closed" ? (
          <p className="text-foreground">
            Recovered {formatCurrency(playbook.recovery_value)} for this risk event.
          </p>
        ) : null}
      </div>
    ),
  });

  return nodes;
}