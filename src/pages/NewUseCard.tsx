import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Check,
  Bot,
  Lock,
  ShieldCheck,
  Clock,
  FileText,
  ChevronRight,
  ChevronLeft,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Json } from "@/integrations/supabase/types";

const ENTITY_FORM_ID = "96583b62-2ee5-40e3-a633-fb14e88e888b";
const USE_FORM_ID = "72d0ae00-091e-4c20-a183-0090bc12a888";
const DEMO_USER_ID = "311eb40e-5061-4e4b-96a4-bc13720ebae1";

const STEPS = ["Who gets the permission?", "What can they see?", "What can they do?", "How long does it last?", "Review and send"];

interface AgentOption {
  id: string;
  name: string;
  operator: string;
  cardId: string;
}

interface DataCardOption {
  id: string;
  title: string;
  sensitivity: string;
}

const DURATION_OPTIONS = [
  { value: "PT1H", label: "1 hour" },
  { value: "P1D", label: "24 hours" },
  { value: "P7D", label: "7 days" },
  { value: "P30D", label: "30 days" },
  { value: "custom", label: "Custom" },
];

function durationToMs(iso: string): number {
  const map: Record<string, number> = {
    PT1H: 3600_000,
    P1D: 86400_000,
    P7D: 604800_000,
    P30D: 2592000_000,
  };
  return map[iso] ?? 86400_000;
}

function durationLabel(iso: string): string {
  const map: Record<string, string> = {
    PT1H: "1 hour",
    P1D: "24 hours",
    P7D: "7 days",
    P30D: "30 days",
  };
  return map[iso] ?? iso;
}

function filenameFromTitle(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+$/, "");
}

// ─── Stepper ────────────────────────────────────────────────────────────
function Stepper({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-center gap-1 mb-8">
      {STEPS.map((label, i) => (
        <div key={label} className="flex items-center gap-1">
          <div
            className={cn(
              "flex items-center justify-center w-8 h-8 rounded-full text-xs font-semibold transition-colors",
              i < current
                ? "bg-primary text-primary-foreground"
                : i === current
                ? "bg-primary text-primary-foreground ring-2 ring-primary/30 ring-offset-2 ring-offset-background"
                : "bg-muted text-muted-foreground"
            )}
          >
            {i < current ? <Check className="w-4 h-4" /> : i + 1}
          </div>
          <span
            className={cn(
              "text-xs hidden sm:inline",
              i <= current ? "text-foreground font-medium" : "text-muted-foreground"
            )}
          >
            {label}
          </span>
          {i < STEPS.length - 1 && (
            <div
              className={cn(
                "w-6 h-0.5 mx-1",
                i < current ? "bg-primary" : "bg-border"
              )}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Main Wizard ────────────────────────────────────────────────────────
export default function NewUseCard() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [step, setStep] = useState(0);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [selectedDataCards, setSelectedDataCards] = useState<Set<string>>(new Set());
  const [allowedActions, setAllowedActions] = useState({ read: true, copy: false, share: false });
  const [prohibitions, setProhibitions] = useState({
    no_retention: true,
    no_training: true,
    no_onward_sharing: true,
  });
  const [duration, setDuration] = useState("P1D");
  const [customExpiry, setCustomExpiry] = useState("");
  const [issuing, setIssuing] = useState(false);
  const [issueError, setIssueError] = useState<string | null>(null);
  const [stepError, setStepError] = useState<string | null>(null);

  // Fetch agents (entity card instances)
  const { data: agents = [], isLoading: loadingAgents } = useQuery({
    queryKey: ["entity-agents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("card_instances")
        .select("id, payload")
        .eq("form_id", ENTITY_FORM_ID)
        .eq("is_current", true);
      if (error) throw error;
      return (data ?? []).map((row): AgentOption => {
        const p = row.payload as any;
        return {
          id: row.id,
          name: p?.card?.title ?? p?.card?.id ?? row.id,
          operator: p?.parties?.operator?.display_name || p?.parties?.holder?.display_name || "Opn.li",
          cardId: p?.card?.id ?? `urn:uuid:${row.id}`,
        };
      });
    },
  });

  // Fetch data cards
  const DATA_FORM_ID = "147a8e87-46f6-4145-b27e-87abbf8cdb77";
  const { data: dataCards = [], isLoading: loadingData } = useQuery({
    queryKey: ["data-cards-scope"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("card_instances")
        .select("id, payload")
        .eq("form_id", DATA_FORM_ID)
        .eq("is_current", true);
      if (error) throw error;
      console.log("[NewUseCard] Data cards query result:", data);
      return (data ?? []).map((row): DataCardOption => {
        const p = row.payload as any;
        return {
          id: row.id,
          title: p?.card?.title ?? row.id,
          sensitivity: "high",
        };
      });
    },
  });

  const agent = useMemo(() => agents.find((a) => a.id === selectedAgent), [agents, selectedAgent]);

  // Auto-select first agent
  if (agents.length > 0 && selectedAgent === null) {
    setSelectedAgent(agents[0].id);
  }

  const toggleDataCard = (id: string) => {
    setSelectedDataCards((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setStepError(null);
  };

  const canNext = (): boolean => {
    if (step === 0) return !!selectedAgent;
    if (step === 1) return selectedDataCards.size > 0;
    return true;
  };

  const goNext = () => {
    if (step === 1 && selectedDataCards.size === 0) {
      setStepError("Select at least one data category.");
      return;
    }
    setStepError(null);
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const goBack = () => {
    setStepError(null);
    setStep((s) => Math.max(s - 1, 0));
  };

  // Compute expiry
  const computeExpiry = (): Date => {
    if (duration === "custom" && customExpiry) {
      return new Date(customExpiry);
    }
    return new Date(Date.now() + durationToMs(duration));
  };

  const selectedDataCardsList = dataCards.filter((dc) => selectedDataCards.has(dc.id));
  const activeActions = Object.entries(allowedActions)
    .filter(([, v]) => v)
    .map(([k]) => k);
  const activeProhibitions = Object.entries(prohibitions)
    .filter(([, v]) => v)
    .map(([k]) => k);

  // ─── Issue Logic ────────────────────────────────────────────────────
  const handleIssue = async () => {
    if (!agent) return;
    setIssuing(true);
    setIssueError(null);

    const now = new Date();
    const expiry = computeExpiry();
    const effectiveDuration = duration === "custom" ? "custom" : duration;

    const claims = selectedDataCardsList.map((dc) => ({
      resource: {
        uri: `file:///health/${filenameFromTitle(dc.title)}`,
        display_name: dc.title,
        data_card_ref: `urn:uuid:${dc.id}`,
      },
      allowed_actions: activeActions,
    }));

    const prohibitionEntries = activeProhibitions.map((code) => ({
      code,
      enforcement_tier: "contractual",
    }));

    const payload = {
      card: {
        id: `urn:uuid:${crypto.randomUUID()}`,
        version: "0.1",
        title: `Use CARD — ${agent.name} — ${durationLabel(effectiveDuration)}`,
        type: "https://opn.li/types/card/use",
      },
      parties: {
        subject: { display_name: "Bob Bethany", id: `urn:uuid:${DEMO_USER_ID}`, kind: "person" },
        holder: {
          display_name: "Bob Bethany",
          id: `urn:uuid:${DEMO_USER_ID}`,
          kind: "person",
        },
        agents: [
          {
            id: agent.cardId,
            kind: "agent",
            display_name: agent.name,
            operator: { id: `urn:uuid:${agent.id}` },
            capabilities: activeActions,
          },
        ],
        recipients: [{}],
      },
      claims: { items: claims },
      policy: {
        purpose: "health_monitoring",
        consent: {
          basis: "explicit",
          granted_at: now.toISOString(),
          grants: [
            {
              to: { id: agent.cardId },
              effective: {
                from: now.toISOString(),
                to: expiry.toISOString(),
              },
            },
          ],
        },
        retention: {
          mode: "none",
          duration: effectiveDuration,
          delete_on_expiry: true,
        },
        revocation: { permitted: true, immediate: true, supported: true },
        prohibitions: prohibitionEntries,
      },
      lifecycle: {
        status: "active",
        effective: {
          from: now.toISOString(),
          to: expiry.toISOString(),
        },
      },
    };

    try {
      // Step A: create instance
      const { data: createData, error: createError } = await supabase.rpc(
        "create_card_instance",
        { p_form_id: USE_FORM_ID, p_payload: payload as unknown as Json }
      );

      if (createError) {
        setIssueError(createError.message);
        setIssuing(false);
        return;
      }

      const row = createData?.[0];
      if (!row || row.error_code) {
        setIssueError(row?.error_message ?? "Unknown error creating instance.");
        setIssuing(false);
        return;
      }

      const instanceId = row.instance_id;

      // Step B: issue card
      const { data: issueData, error: issueErr } = await supabase.rpc("issue_card", {
        p_instance_id: instanceId,
        p_recipient_member_id: DEMO_USER_ID,
      });

      if (issueErr) {
        setIssueError(issueErr.message);
        setIssuing(false);
        return;
      }

      // Step C: success
      const dataTitles = selectedDataCardsList.map((dc) => dc.title).join(", ");
      toast({
        title: "Permission sent",
        description: `${agent.name} can now access ${dataTitles} for ${durationLabel(effectiveDuration)}. You can close the door at any time from My Front Door.`,
        duration: Infinity,
      });
      navigate("/instances");
    } catch (err: any) {
      setIssueError(err?.message ?? "Unexpected error.");
    } finally {
      setIssuing(false);
    }
  };

  // ─── Step Renderers ─────────────────────────────────────────────────
  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Who gets the permission?</h2>
            {loadingAgents ? (
              <div className="flex items-center gap-2 text-muted-foreground py-8">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading agents…
              </div>
            ) : (
              <div className="grid gap-3">
                {agents.map((a) => (
                  <Card
                    key={a.id}
                    className={cn(
                      "cursor-pointer transition-all hover:border-primary/50",
                      selectedAgent === a.id && "border-primary ring-2 ring-primary/20"
                    )}
                    onClick={() => setSelectedAgent(a.id)}
                  >
                    <CardContent className="flex items-center gap-4 p-4">
                      <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10">
                        <Bot className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{a.name}</p>
                        <p className="text-sm text-muted-foreground">Operator: {a.operator}</p>
                      </div>
                      <Badge variant="outline" className="border-primary/30 text-primary text-xs">
                        agent
                      </Badge>
                      {selectedAgent === a.id && (
                        <Check className="w-5 h-5 text-primary shrink-0" />
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        );

      case 1:
        return (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold">What can they see?</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Check the data categories you are authorizing. The agent can ONLY access what you check here.
              </p>
            </div>
            {loadingData ? (
              <div className="flex items-center gap-2 text-muted-foreground py-8">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading data cards…
              </div>
            ) : dataCards.length === 0 ? (
              <Alert>
                <AlertDescription>
                  No data resources found. Make sure you have Data CARDs created for your account.
                </AlertDescription>
              </Alert>
            ) : (
              <div className="grid gap-3">
                {dataCards.map((dc) => {
                  const checked = selectedDataCards.has(dc.id);
                  return (
                    <Card
                      key={dc.id}
                      className={cn(
                        "cursor-pointer transition-all hover:border-primary/50",
                        checked && "border-primary ring-2 ring-primary/20"
                      )}
                      onClick={() => toggleDataCard(dc.id)}
                    >
                      <CardContent className="flex items-center gap-4 p-4">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() => toggleDataCard(dc.id)}
                          className="shrink-0"
                        />
                        <Lock className="w-4 h-4 text-muted-foreground shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium">{dc.title}</p>
                        </div>
                        <Badge variant="destructive" className="text-xs shrink-0">
                          🔴 HIGH SENSITIVITY
                        </Badge>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
            {stepError && (
              <Alert variant="destructive">
                <AlertDescription>{stepError}</AlertDescription>
              </Alert>
            )}
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold">What can they do with this data?</h2>

            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Allowed Actions
              </h3>
              {(["read", "copy", "share"] as const).map((action) => (
                <div key={action} className="flex items-center justify-between py-2">
                  <Label htmlFor={`action-${action}`} className="capitalize font-medium">
                    {action}
                  </Label>
                  <Switch
                    id={`action-${action}`}
                    checked={allowedActions[action]}
                    onCheckedChange={(v) =>
                      setAllowedActions((prev) => ({ ...prev, [action]: v }))
                    }
                  />
                </div>
              ))}
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Prohibitions
              </h3>
              {[
                { key: "no_retention" as const, label: "No Retention", desc: "Agent must not store your data after the session ends" },
                { key: "no_training" as const, label: "No Training", desc: "Your data cannot be used to train AI models" },
                { key: "no_onward_sharing" as const, label: "No Onward Sharing", desc: "Agent cannot share your data with third parties" },
              ].map((p) => (
                <div key={p.key} className="flex items-start gap-3 py-2">
                  <Checkbox
                    id={`prohib-${p.key}`}
                    checked={prohibitions[p.key]}
                    onCheckedChange={(v) =>
                      setProhibitions((prev) => ({ ...prev, [p.key]: !!v }))
                    }
                    className="mt-0.5"
                  />
                  <div>
                    <Label htmlFor={`prohib-${p.key}`} className="font-medium">
                      {p.label}
                    </Label>
                    <p className="text-sm text-muted-foreground">{p.desc}</p>
                  </div>
                </div>
              ))}
              <p className="text-xs text-muted-foreground mt-2">
                Prohibitions are recorded in the CARD and backed by the audit trail.
              </p>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">How long does it last?</h2>
            <RadioGroup value={duration} onValueChange={setDuration} className="space-y-3">
              {DURATION_OPTIONS.map((opt) => (
                <div key={opt.value} className="flex items-center gap-3">
                  <RadioGroupItem value={opt.value} id={`dur-${opt.value}`} />
                  <Label htmlFor={`dur-${opt.value}`} className="font-medium cursor-pointer">
                    {opt.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>

            {duration === "custom" && (
              <div className="pl-7 space-y-2">
                <Label htmlFor="custom-expiry" className="text-sm">
                  Expiry date & time
                </Label>
                <Input
                  id="custom-expiry"
                  type="datetime-local"
                  value={customExpiry}
                  onChange={(e) => setCustomExpiry(e.target.value)}
                  min={new Date().toISOString().slice(0, 16)}
                  className="max-w-xs"
                />
              </div>
            )}

            <p className="text-sm text-muted-foreground flex items-start gap-2">
              <Clock className="w-4 h-4 mt-0.5 shrink-0" />
              The agent's access ends automatically when this period expires. You can also revoke
              access at any time.
            </p>
          </div>
        );

      case 4: {
        const expiry = computeExpiry();
        const effectiveDuration = duration === "custom" ? "custom" : duration;
        return (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold">Review and send this permission slip</h2>

            <Card>
              <CardContent className="p-6 space-y-4">
                <Row icon={Bot} label="Agent" value={agent?.name ?? "—"} />
                <Row
                  icon={FileText}
                  label="Data Access"
                  value={selectedDataCardsList.map((dc) => dc.title).join(", ")}
                />
                <Row
                  icon={ShieldCheck}
                  label="Allowed Actions"
                  value={activeActions.map((a) => a.charAt(0).toUpperCase() + a.slice(1)).join(", ")}
                />
                <Row
                  icon={Lock}
                  label="Prohibitions"
                  value={
                    activeProhibitions.length > 0
                      ? activeProhibitions
                          .map((p) =>
                            p === "no_retention"
                              ? "No Retention"
                              : p === "no_training"
                              ? "No Training"
                              : "No Onward Sharing"
                          )
                          .join(", ")
                      : "None"
                  }
                />
                <Row
                  icon={Clock}
                  label="Duration"
                  value={`${durationLabel(effectiveDuration)} — expires ${expiry.toLocaleString()}`}
                />
              </CardContent>
            </Card>

            {issueError && (
              <Alert variant="destructive">
                <AlertDescription>{issueError}</AlertDescription>
              </Alert>
            )}
          </div>
        );
      }

      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-lg bg-vault-green/10 border border-vault-green/30 p-4">
        <p className="font-semibold text-vault-green">You are writing a permission slip.</p>
        <p className="text-sm text-muted-foreground mt-1">
          You choose the agent, what they can see, what they can do, and when access ends. You can close the door at any time.
        </p>
      </div>
      <Stepper current={step} />
      {renderStep()}

      <div className="flex items-center justify-between pt-4 border-t border-border">
        {step > 0 ? (
          <Button variant="outline" onClick={goBack} disabled={issuing}>
            <ChevronLeft className="w-4 h-4 mr-1" /> Back
          </Button>
        ) : (
          <div />
        )}

        {step < STEPS.length - 1 ? (
          <Button onClick={goNext} disabled={!canNext()}>
            Next <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        ) : (
          <Button
            onClick={handleIssue}
            disabled={issuing}
            className="bg-primary hover:bg-primary/90"
          >
            {issuing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" /> Sending…
              </>
            ) : (
              "Send this permission slip"
            )}
          </Button>
        )}
      </div>
    </div>
  );
}

// Small helper for summary rows
function Row({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="w-4 h-4 mt-1 text-primary shrink-0" />
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium">{value}</p>
      </div>
    </div>
  );
}
