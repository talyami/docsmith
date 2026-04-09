import { useState, useRef, useEffect } from "react";
import { Link } from "wouter";
import { UploadCloud, FileType, CheckCircle2, AlertCircle, Loader2, Download, FileText, ArrowRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useFileUpload } from "@/hooks/use-file-upload";
import { useListConversions, useGetConversion, getGetConversionQueryKey } from "@workspace/api-client-react";
import type { Conversion } from "@workspace/api-client-react/src/generated/api.schemas";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { formatDistanceToNow } from "date-fns";

const SUPPORTED_TYPES = [
  { ext: ".docx", label: "Preserve + Clean" },
  { ext: ".doc", label: "Convert + Clean" },
  { ext: ".pdf", label: "Extract + Rebuild" },
  { ext: ".md", label: "Parse + Rebuild" },
  { ext: ".html", label: "Parse DOM + Rebuild" },
  { ext: ".rtf", label: "Read + Normalize" },
  { ext: ".txt", label: "Infer + Rebuild" },
  { ext: ".csv", label: "Interpret as Table" },
  { ext: ".json", label: "Interpret as Data" },
  { ext: ".xml", label: "Parse + Remap" },
  { ext: ".yaml", label: "Interpret Config" },
  { ext: ".tex", label: "Parse + Rebuild" },
  { ext: ".rst", label: "Parse + Rebuild" },
];

export function Home() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const { uploadFile, isUploading } = useFileUpload();
  const [activeConversionId, setActiveConversionId] = useState<number | null>(null);

  const { data: conversions } = useListConversions();

  // Poll for the active conversion
  const { data: activeConversion } = useGetConversion(activeConversionId || 0, {
    query: {
      enabled: !!activeConversionId,
      queryKey: getGetConversionQueryKey(activeConversionId || 0),
      refetchInterval: (query) => {
        const state = query.state?.data;
        if (state && (state.status === "done" || state.status === "error")) {
          return false;
        }
        return 2000;
      },
    },
  });

  useEffect(() => {
    if (activeConversion) {
      if (activeConversion.status === "done") {
        toast({
          title: "Conversion complete",
          description: "Your document is ready to download.",
        });
      } else if (activeConversion.status === "error") {
        toast({
          title: "Conversion failed",
          description: activeConversion.errorMessage || "An error occurred",
          variant: "destructive",
        });
      }
    }
  }, [activeConversion, toast]);

  const handleFileSelect = async (file: File) => {
    if (!file) return;
    try {
      const result = await uploadFile(file);
      setActiveConversionId(result.id);
      toast({
        title: "File uploaded",
        description: "Conversion started automatically.",
      });
    } catch (err: any) {
      toast({
        title: "Upload failed",
        description: err.message,
        variant: "destructive",
      });
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const recentConversions = conversions?.slice(0, 3) || [];

  return (
    <div className="max-w-6xl mx-auto p-8 space-y-12 animate-in fade-in duration-500">
      
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-4xl font-bold tracking-tight text-foreground">Document Transformation Studio</h1>
        <p className="text-lg text-muted-foreground max-w-2xl">
          Drop any messy file. We'll extract, clean, and format it into a pristine Word document. Professional formatting, instantly.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Main Upload Area */}
        <div className="lg:col-span-2 space-y-6">
          <Card 
            className={`relative overflow-hidden border-2 border-dashed transition-all duration-200 bg-card
              ${isDragging ? "border-primary bg-primary/5" : "border-border"}
              ${isUploading ? "opacity-50 pointer-events-none" : ""}
            `}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            data-testid="upload-zone"
          >
            <div className="p-16 flex flex-col items-center justify-center text-center space-y-6 min-h-[400px]">
              <div className="p-4 bg-primary/10 rounded-full text-primary mb-4">
                <UploadCloud className="h-12 w-12" />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-semibold">Drag & Drop your file here</h3>
                <p className="text-muted-foreground text-sm">
                  Or click below to browse your computer
                </p>
              </div>
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileSelect(e.target.files[0]);
                  }
                }}
                data-testid="input-file"
              />
              <Button 
                size="lg" 
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                data-testid="button-browse"
                className="px-8 shadow-sm hover:shadow transition-all"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Uploading...
                  </>
                ) : "Browse Files"}
              </Button>
            </div>
          </Card>

          {/* Active Conversion Status */}
          {activeConversion && (
            <Card className="p-6 bg-card border-border shadow-sm animate-in slide-in-from-bottom-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <FileText className="h-6 w-6 text-primary" />
                  <div>
                    <h4 className="font-medium text-foreground">{activeConversion.originalFilename}</h4>
                    <p className="text-xs text-muted-foreground">
                      Mode: {activeConversion.processingMode || "Standard"}
                    </p>
                  </div>
                </div>
                <StatusBadge status={activeConversion.status} />
              </div>
              
              <div className="space-y-2">
                <Progress 
                  value={
                    activeConversion.status === "done" ? 100 : 
                    activeConversion.status === "processing" ? 60 : 
                    activeConversion.status === "error" ? 0 : 20
                  } 
                  className={`h-2 ${activeConversion.status === "error" ? "bg-destructive/20 [&>div]:bg-destructive" : ""}`}
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>
                    {activeConversion.status === "pending" && "Waiting in queue..."}
                    {activeConversion.status === "processing" && "Applying formatting..."}
                    {activeConversion.status === "done" && "Ready!"}
                    {activeConversion.status === "error" && "Failed"}
                  </span>
                  {activeConversion.status === "done" && activeConversion.downloadPath && (
                    <Button variant="link" size="sm" className="h-auto p-0 text-primary" asChild>
                      <a href={activeConversion.downloadPath} download>Download Result</a>
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          )}

          {/* Recent Conversions */}
          {recentConversions.length > 0 && !activeConversion && (
            <div className="space-y-4 pt-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Recent Conversions</h3>
                <Link href="/history" className="text-sm text-primary hover:underline flex items-center">
                  View all <ArrowRight className="ml-1 h-3 w-3" />
                </Link>
              </div>
              <div className="grid gap-3">
                {recentConversions.map((conv) => (
                  <Card key={conv.id} className="p-4 flex items-center justify-between hover:border-primary/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-muted rounded-md text-muted-foreground">
                        <FileType className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{conv.originalFilename}</p>
                        <p className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(conv.createdAt), { addSuffix: true })}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <StatusBadge status={conv.status} />
                      {conv.status === "done" && conv.downloadPath && (
                        <Button size="icon" variant="ghost" asChild>
                          <a href={conv.downloadPath} download data-testid={`button-download-${conv.id}`}>
                            <Download className="h-4 w-4" />
                          </a>
                        </Button>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar Info */}
        <div className="space-y-6">
          <Card className="p-6 bg-card border-border">
            <h3 className="font-semibold mb-4 text-foreground">Supported Formats</h3>
            <div className="space-y-3">
              {SUPPORTED_TYPES.map((type) => (
                <div key={type.ext} className="flex justify-between items-center text-sm border-b border-border/50 pb-2 last:border-0 last:pb-0">
                  <span className="font-mono text-muted-foreground font-medium bg-muted px-1.5 py-0.5 rounded">{type.ext}</span>
                  <span className="text-muted-foreground text-right">{type.label}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

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
