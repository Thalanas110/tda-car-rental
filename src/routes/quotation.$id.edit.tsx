import { createFileRoute } from "@tanstack/react-router";
import { DocumentEditorPage } from "@/components/DocumentEditorPage";

export const Route = createFileRoute("/quotation/$id/edit")({
  component: QuotationEditPage,
});

function QuotationEditPage() {
  const { id } = Route.useParams();
  return <DocumentEditorPage docType="quotation" documentId={Number(id)} />;
}
