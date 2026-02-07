import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

export default function RegisterForm() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [formType, setFormType] = useState<string>("");
  const [schemaDef, setSchemaDef] = useState("{}");
  const [submitting, setSubmitting] = useState(false);
  const [mode, setMode] = useState<"system" | "member">("system");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    let parsed: object;
    try {
      parsed = JSON.parse(schemaDef);
    } catch {
      toast({ title: "Invalid JSON", description: "Schema definition must be valid JSON.", variant: "destructive" });
      setSubmitting(false);
      return;
    }

    try {
      if (mode === "system") {
        // System registration via edge function — actor_id = NULL
        const res = await supabase.functions.invoke("system-register-form", {
          body: {
            name,
            form_type: formType,
            schema_definition: parsed,
          },
        });

        if (res.error) throw res.error;
        const result = res.data as { id: string; error?: string };
        if (result.error) throw new Error(result.error);

        toast({ title: "Form registered (system)", description: `ID: ${result.id}` });
      } else {
        // Member registration via RPC — actor_id = auth.uid()
        const { data, error } = await (supabase.rpc as any)("register_card_form", {
          p_name: name,
          p_form_type: formType,
          p_schema_definition: parsed,
        });

        if (error) throw error;
        toast({ title: "Form registered", description: `ID: ${data}` });
      }

      navigate("/forms");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
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
    </div>
  );
}
