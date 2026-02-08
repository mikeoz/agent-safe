import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCopyToast } from "@/components/CopyToast";
import { ResultPanel } from "@/components/ResultPanel";
import { useNavigate } from "react-router-dom";

export default function RegisterForm() {
  const { copyToast } = useCopyToast();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [formType, setFormType] = useState<string>("");
  const [schemaDef, setSchemaDef] = useState("{}");
  const [submitting, setSubmitting] = useState(false);
  const [mode, setMode] = useState<"system" | "member">("system");
  const [lastResult, setLastResult] = useState<{ id: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setLastResult(null);

    let parsed: object;
    try {
      parsed = JSON.parse(schemaDef);
    } catch {
      copyToast({ title: "Invalid JSON — Schema definition must be valid JSON.", variant: "destructive" });
      setSubmitting(false);
      return;
    }

    try {
      if (mode === "system") {
        const res = await supabase.functions.invoke("system-register-form", {
          body: { name, form_type: formType, schema_definition: parsed },
        });

        if (res.error) throw res.error;
        const result = res.data as { id: string; error?: string };
        if (result.error) throw new Error(result.error);

        setLastResult({ id: result.id });
        copyToast({ title: "Form registered (system)", id: result.id, label: "Form ID" });
      } else {
        const { data, error } = await (supabase.rpc as any)("register_card_form", {
          p_name: name,
          p_form_type: formType,
          p_schema_definition: parsed,
        });

        if (error) throw error;
        setLastResult({ id: data });
        copyToast({ title: "Form registered", id: data, label: "Form ID" });
      }
    } catch (err: any) {
      copyToast({ title: "Error: " + err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <h1 className="text-xl font-semibold mb-6">Register CARD Form</h1>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">New Form</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Registration Mode</Label>
              <Select value={mode} onValueChange={(v) => setMode(v as "system" | "member")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="system">System Register (Alpha) — actor = system</SelectItem>
                  <SelectItem value="member">Member Register — actor = you</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Form Type</Label>
              <Select value={formType} onValueChange={setFormType} required>
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="entity">Entity</SelectItem>
                  <SelectItem value="data">Data</SelectItem>
                  <SelectItem value="use">Use</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="schema">Schema Definition (JSON)</Label>
              <Textarea
                id="schema"
                value={schemaDef}
                onChange={(e) => setSchemaDef(e.target.value)}
                className="font-mono text-sm min-h-[120px]"
                required
              />
            </div>
            <Button type="submit" disabled={submitting || !formType}>
              {submitting ? "Registering…" : mode === "system" ? "System Register (Alpha)" : "Register Form"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {lastResult && (
        <ResultPanel
          title="Form Registered"
          entries={[{ label: "Form ID", value: lastResult.id }]}
        />
      )}
    </div>
  );
}
