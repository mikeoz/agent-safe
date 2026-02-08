import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CopyIdButton } from "@/components/CopyIdButton";

interface CardForm {
  id: string;
  name: string;
  form_type: string;
  status: string;
  registered_at: string | null;
  created_at: string;
}

export default function RegisteredForms() {
  const [forms, setForms] = useState<CardForm[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchForms = async () => {
      const { data, error } = await supabase
        .from("card_forms")
        .select("id, name, form_type, status, registered_at, created_at")
        .order("created_at", { ascending: false });
      if (!error && data) setForms(data);
      setLoading(false);
    };
    fetchForms();
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">Registered Forms</h1>
        <Button asChild size="sm">
          <Link to="/forms/register">Register New</Link>
        </Button>
      </div>
      {loading ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : forms.length === 0 ? (
        <p className="text-muted-foreground text-sm">No registered forms yet.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Form ID</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Registered</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {forms.map((form) => (
              <TableRow key={form.id}>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <span className="font-mono text-xs">{form.id.slice(0, 8)}…</span>
                    <CopyIdButton value={form.id} />
                  </div>
                </TableCell>
                <TableCell className="font-medium">{form.name}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{form.form_type}</Badge>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{form.status}</Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {form.registered_at ? new Date(form.registered_at).toLocaleString() : "—"}
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button asChild variant="ghost" size="sm">
                      <Link to={`/instances/create?formId=${form.id}`}>Create Instance</Link>
                    </Button>
                    <Button asChild variant="ghost" size="sm">
                      <Link to={`/audit?entityType=card_form&entityId=${form.id}`}>Audit</Link>
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
