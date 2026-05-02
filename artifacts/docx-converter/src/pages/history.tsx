import { useState } from "react";
import { format } from "date-fns";
import { Trash2, Download, FileText, CheckCircle2, AlertCircle, Loader2, Search } from "lucide-react";
import { 
  useListConversions, 
  useDeleteConversion, 
  getListConversionsQueryKey 
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import type { Conversion } from "@workspace/api-client-react/src/generated/api.schemas";

function StatusBadge({ status }: { status: Conversion["status"] }) {
  if (status === "done") {
    return <span className="flex items-center text-xs font-medium text-green-600 bg-green-500/10 px-2 py-1 rounded-full whitespace-nowrap"><CheckCircle2 className="mr-1 h-3 w-3" /> Done</span>;
  }
  if (status === "error") {
    return <span className="flex items-center text-xs font-medium text-destructive bg-destructive/10 px-2 py-1 rounded-full whitespace-nowrap"><AlertCircle className="mr-1 h-3 w-3" /> Error</span>;
  }
  if (status === "processing") {
    return <span className="flex items-center text-xs font-medium text-blue-600 bg-blue-500/10 px-2 py-1 rounded-full whitespace-nowrap"><Loader2 className="mr-1 h-3 w-3 animate-spin" /> Processing</span>;
  }
  return <span className="flex items-center text-xs font-medium text-muted-foreground bg-muted px-2 py-1 rounded-full whitespace-nowrap">Pending</span>;
}

export function History() {
  const { data: conversions, isLoading } = useListConversions();
  const deleteConversion = useDeleteConversion();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState("");

  const handleDelete = async (id: number) => {
    try {
      await deleteConversion.mutateAsync({ id });
      queryClient.invalidateQueries({ queryKey: getListConversionsQueryKey() });
      toast({
        title: "Conversion deleted",
        description: "The file and record have been removed.",
      });
    } catch (err: any) {
      toast({
        title: "Failed to delete",
        description: err.message || "An error occurred",
        variant: "destructive",
      });
    }
  };

  const filteredConversions = conversions?.filter(conv => 
    conv.originalFilename.toLowerCase().includes(search.toLowerCase()) ||
    conv.originalExtension.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Conversion History</h1>
          <p className="text-muted-foreground mt-1 text-sm sm:text-base">Review and manage your past document transformations.</p>
        </div>
        
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search files..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            data-testid="input-search-history"
          />
        </div>
      </div>

      <Card className="overflow-hidden border-border bg-card">
        {isLoading ? (
          <div className="p-12 flex justify-center items-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filteredConversions?.length === 0 ? (
          <div className="p-8 sm:p-12 text-center text-muted-foreground">
            <FileText className="h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-4 opacity-20" />
            <h3 className="text-base sm:text-lg font-medium text-foreground mb-1">No conversions found</h3>
            <p className="text-sm">You haven't converted any files yet, or none match your search.</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filteredConversions?.map((conv) => (
              <div
                key={conv.id}
                className="p-3 sm:p-4 hover:bg-muted/50 transition-colors"
                data-testid={`history-item-${conv.id}`}
              >
                {/* Top row: icon + name + actions */}
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 p-1.5 sm:p-2 bg-primary/10 text-primary rounded-md shrink-0 hidden sm:block">
                    <FileText className="h-4 w-4 sm:h-5 sm:w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="font-medium text-foreground text-sm truncate" title={conv.originalFilename}>
                        {conv.originalFilename}
                      </h4>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <StatusBadge status={conv.status} />
                      </div>
                    </div>

                    {/* Meta row */}
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1 text-xs text-muted-foreground">
                      <span className="uppercase font-medium">{conv.originalExtension.replace('.', '')}</span>
                      <span className="hidden sm:inline">&bull;</span>
                      <span>{(conv.fileSize / 1024).toFixed(1)} KB</span>
                      <span className="hidden sm:inline">&bull;</span>
                      <span className="hidden sm:inline">{format(new Date(conv.createdAt), "MMM d, yyyy 'at' h:mm a")}</span>
                      <span className="sm:hidden">{format(new Date(conv.createdAt), "MMM d, yy")}</span>
                    </div>

                    {conv.status === 'error' && conv.errorMessage && (
                      <p className="text-xs text-destructive mt-1.5 truncate">{conv.errorMessage}</p>
                    )}

                    {/* Action buttons below on mobile */}
                    <div className="flex items-center gap-2 mt-2">
                      {conv.status === "done" && conv.downloadPath && (
                        <Button variant="outline" size="sm" asChild className="h-7 px-2.5 text-xs gap-1.5">
                          <a href={conv.downloadPath} download data-testid={`button-download-${conv.id}`}>
                            <Download className="h-3 w-3" />
                            Download
                          </a>
                        </Button>
                      )}
                      
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            data-testid={`button-delete-${conv.id}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="max-w-[90vw] sm:max-w-md rounded-xl">
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Conversion?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently delete the conversion record and the output file. This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter className="flex-row gap-2 sm:flex-row">
                            <AlertDialogCancel className="flex-1 sm:flex-none mt-0">Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDelete(conv.id)}
                              className="flex-1 sm:flex-none bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
