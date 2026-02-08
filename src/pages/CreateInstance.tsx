import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCopyToast } from "@/components/CopyToast";
import { ResultPanel } from "@/components/ResultPanel";

interface CardForm {
  id: string;
  name: string;
  form_type: string;
}

export default function CreateInstance() {
  const { copyToast } = useCopyToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedFormId = searchParams.get("formId") || "";

  const [forms, setForms] = useState<CardForm[]>([]);
  const [formId, setFormId] = useState(preselectedFormId);
  const [payload, setPayload] = useState("{}");
  const [submitting, setSubmitting] = useState(false);
  const [lastResult, setLastResult] = useState<{ instanceId: string } | null>(null);

  useEffect(() => {
    const fetchForms = async () => {
      const { data } = await supabase.from("card_forms").select("id, name, form_type").order("name");
      if (data) setForms(data);
    };
    fetchForms();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setLastResult(null);

    let parsed: object;
    try {
      parsed = JSON.parse(payload);
    } catch {
      copyToast({ title: "Invalid JSON — Payload must be valid JSON.", variant: "destructive" });
      setSubmitting(false);
      return;
    }

    try {
      const { data, error } = await (supabase.rpc as any)("create_card_instance", {
        p_form_id: formId,
        p_payload: parsed,
      });

      if (error) throw error;

      const result = Array.isArray(data) ? data[0] : data;

      if (result?.error_code) {
        copyToast({
          title: "Blocked: " + (result.error_message || result.error_code),
          variant: "destructive",
        });
      } else {
        setLastResult({ instanceId: result?.instance_id });
        copyToast({ title: "Instance created", id: result?.instance_id, label: "Instance ID" });
      }
    } catch (err: any) {
      copyToast({ title: "Error: " + err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <h1 className="text-xl font-semibold mb-6">Create CARD Instance</h1>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">New Instance</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Registered Form</Label>
              <Select value={formId} onValueChange={setFormId} required>
                <SelectTrigger>
                  <SelectValue placeholder="Select a form" />
                </SelectTrigger>
                <SelectContent>
                  {forms.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.name} ({f.form_type})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="payload">Payload (JSON)</Label>
              <Textarea
                id="payload"
                value={payload}
                onChange={(e) => setPayload(e.target.value)}
                className="font-mono text-sm min-h-[120px]"
                required
              />
            </div>
            <Button type="submit" disabled={submitting || !formId}>
              {submitting ? "Creating…" : "Create Instance"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {lastResult && (
        <ResultPanel
          title="Instance Created"
          entries={[{ label: "Instance ID", value: lastResult.instanceId }]}
        />
      )}
    </div>
  );
}
