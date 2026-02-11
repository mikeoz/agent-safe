import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useCopyToast } from "@/components/CopyToast";
import { ResultPanel } from "@/components/ResultPanel";
import { DynamicCardForm } from "@/components/card-form/DynamicCardForm";
import type { CardFormRecord } from "@/components/card-form/types";

export default function CreateInstance() {
  const { copyToast } = useCopyToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedFormId = searchParams.get("formId") || "";
  const reviseId = searchParams.get("reviseId") || "";

  const [forms, setForms] = useState<CardFormRecord[]>([]);
  const [selectedFormId, setSelectedFormId] = useState(preselectedFormId);
  const [submitting, setSubmitting] = useState(false);
  const [lastResult, setLastResult] = useState<{ instanceId: string } | null>(null);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [revisePayload, setRevisePayload] = useState<any | null>(null);
  const [reviseTitle, setReviseTitle] = useState<string>("");

  useEffect(() => {
    const fetchForms = async () => {
      const { data } = await supabase
        .from("card_forms")
        .select("id, name, form_type, schema_definition")
        .order("name");
      if (data) setForms(data as CardFormRecord[]);
    };
    fetchForms();
  }, []);

  // Load existing payload when revising
  useEffect(() => {
    if (!reviseId) return;
    const loadRevisePayload = async () => {
      const { data } = await supabase
        .from("card_instances")
        .select("payload")
        .eq("id", reviseId)
        .single();
      if (data) {
        const p = data.payload as any;
        setRevisePayload(p);
        setReviseTitle(p?.card?.title || "");
      }
    };
    loadRevisePayload();
  }, [reviseId]);

  const selectedForm = forms.find((f) => f.id === selectedFormId);
  const isRevision = !!reviseId;

  const handleSubmit = async (formId: string, payload: object) => {
    setSubmitting(true);
    setLastResult(null);
    setInlineError(null);

    try {
      if (isRevision) {
        // Call supersede_card_instance
        const { data, error } = await (supabase.rpc as any)("supersede_card_instance", {
          p_old_instance_id: reviseId,
          p_new_payload: payload,
        });
        if (error) throw error;

        const result = Array.isArray(data) ? data[0] : data;
        if (result?.err_code) {
          const msg = result.err_code === "PAYLOAD_INVALID"
            ? "The payload does not match the required CARD structure. Please check all required fields."
            : `Blocked: ${result.err_msg || result.err_code}`;
          setInlineError(msg);
        } else {
          setLastResult({ instanceId: result?.new_instance_id });
          copyToast({
            title: "New version created",
            id: result?.new_instance_id,
            label: "New Instance ID",
          });
        }
      } else {
        // Normal create
        const { data, error } = await (supabase.rpc as any)("create_card_instance", {
          p_form_id: formId,
          p_payload: payload,
        });
        if (error) throw error;

        const result = Array.isArray(data) ? data[0] : data;
        if (result?.err_code) {
          const msg = result.err_code === "PAYLOAD_INVALID"
            ? "The payload does not match the required CARD structure. Please check all required fields."
            : `Blocked: ${result.err_msg || result.err_code}`;
          setInlineError(msg);
        } else {
          setLastResult({ instanceId: result?.id });
          copyToast({ title: "Instance created", id: result?.id, label: "Instance ID" });
        }
      }
    } catch (err: any) {
      setInlineError("Error: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <h1 className="text-xl font-semibold mb-6">
        {isRevision ? `Revise CARD — ${reviseTitle || "Loading…"}` : "Create CARD Instance"}
      </h1>

      {!isRevision && (
        <Card className="mb-6">
          <CardHeader className="py-4">
            <CardTitle className="text-base">Select Registered Form</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label>Registered Form</Label>
              <Select value={selectedFormId} onValueChange={(v) => { setSelectedFormId(v); setLastResult(null); setInlineError(null); }}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a form…" />
                </SelectTrigger>
                <SelectContent>
                  {forms.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedForm && (
                <div className="flex items-center gap-2 pt-1">
                  <Badge variant="outline">{selectedForm.form_type}</Badge>
                  <span className="text-sm text-muted-foreground">{selectedForm.name}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {isRevision && selectedForm && (
        <div className="mb-4 flex items-center gap-2">
          <Badge variant="outline">{selectedForm.form_type}</Badge>
          <span className="text-sm text-muted-foreground">{selectedForm.name}</span>
        </div>
      )}

      {selectedForm && (
        <Card>
          <CardHeader className="py-4">
            <CardTitle className="text-base">
              {isRevision ? "Revised CARD Fields" : `New ${selectedForm.form_type.charAt(0).toUpperCase() + selectedForm.form_type.slice(1)} CARD`}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DynamicCardForm
              key={selectedFormId + (reviseId || "")}
              formType={selectedForm.form_type}
              formId={selectedForm.id}
              onSubmit={handleSubmit}
              submitting={submitting}
              initialPayload={isRevision ? revisePayload : undefined}
              submitLabel={isRevision ? "Create New Version" : undefined}
            />
          </CardContent>
        </Card>
      )}

      {inlineError && (
        <div className="mt-4 rounded-md border border-destructive/50 bg-destructive/10 p-4">
          <p className="text-sm text-destructive font-medium">{inlineError}</p>
        </div>
      )}

      {lastResult && (
        <>
          <ResultPanel
            title={isRevision ? "New Version Created" : "Instance Created"}
            entries={[{ label: isRevision ? "New Instance ID" : "Instance ID", value: lastResult.instanceId }]}
          />
          {isRevision && (
            <p className="text-sm text-muted-foreground mt-2 px-1">
              Previous version preserved. The old CARD is now marked as superseded.
            </p>
          )}
        </>
      )}
    </div>
  );
}
