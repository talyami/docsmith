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
    return <span className="flex items-center text-xs font-medium text-green-600 bg-green-500/10 px-2 py-1 rounded-full"><CheckCircle2 className="mr-1 h-3 w-3" /> Done</span>;
  }
  if (status === "error") {
    return <span className="flex items-center text-xs font-medium text-destructive bg-destructive/10 px-2 py-1 rounded-full"><AlertCircle className="mr-1 h-3 w-3" /> Error</span>;
  }
  if (status === "processing") {
    return <span className="flex items-center text-xs font-medium text-blue-600 bg-blue-500/10 px-2 py-1 rounded-full"><Loader2 className="mr-1 h-3 w-3 animate-spin" /> Processing</span>;
  }
  return <span className="flex items-center text-xs font-medium text-muted-foreground bg-muted px-2 py-1 rounded-full">Pending</span>;
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
    <div className="max-w-6xl mx-auto p-8 space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Conversion History</h1>
          <p className="text-muted-foreground mt-1">Review and manage your past document transformations.</p>
        </div>
        
        <div className="relative w-full md:w-64">
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
          <div className="p-12 text-center text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-4 opacity-20" />
            <h3 className="text-lg font-medium text-foreground mb-1">No conversions found</h3>
            <p>You haven't converted any files yet, or none match your search.</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filteredConversions?.map((conv) => (
              <div key={conv.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-muted/50 transition-colors" data-testid={`history-item-${conv.id}`}>
                <div className="flex items-start gap-4">
                  <div className="mt-1 p-2 bg-primary/10 text-primary rounded-md hidden sm:block">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="font-medium text-foreground truncate max-w-sm md:max-w-md lg:max-w-lg" title={conv.originalFilename}>
                      {conv.originalFilename}
                    </h4>
                    <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                      <span className="uppercase">{conv.originalExtension.replace('.', '')}</span>
                      <span>&bull;</span>
                      <span>{(conv.fileSize / 1024).toFixed(1)} KB</span>
                      <span>&bull;</span>
                      <span>{format(new Date(conv.createdAt), "MMM d, yyyy 'at' h:mm a")}</span>
                    </div>
                    {conv.status === 'error' && conv.errorMessage && (
                      <p className="text-xs text-destructive mt-2 max-w-xl truncate">{conv.errorMessage}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <StatusBadge status={conv.status} />
                  
                  <div className="flex items-center gap-2 border-l border-border pl-3 ml-1">
                    {conv.status === "done" && conv.downloadPath && (
                      <Button variant="outline" size="sm" asChild>
                        <a href={conv.downloadPath} download data-testid={`button-download-${conv.id}`}>
                          <Download className="h-4 w-4 mr-2" />
                          Download
                        </a>
                      </Button>
                    )}
                    
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive hover:bg-destructive/10" data-testid={`button-delete-${conv.id}`}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Conversion?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently delete the conversion record and the output file from our servers. This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(conv.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
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
