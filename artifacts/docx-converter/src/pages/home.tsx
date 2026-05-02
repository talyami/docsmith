import { useState, useRef, useEffect } from "react";
import { Link } from "wouter";
import { UploadCloud, FileType, CheckCircle2, AlertCircle, Loader2, Download, ArrowRight, FileCheck, RefreshCw, ChevronDown, ChevronUp, Sparkles, Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useFileUpload } from "@/hooks/use-file-upload";
import { useListConversions, useGetConversion, getGetConversionQueryKey, useDeleteConversion, getListConversionsQueryKey } from "@workspace/api-client-react";
import type { Conversion } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { formatDistanceToNow } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";

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
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [formatsExpanded, setFormatsExpanded] = useState(false);
  const [useAi, setUseAi] = useState(false);
  const queryClient = useQueryClient();

  const { data: conversions } = useListConversions();

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
        queryClient.invalidateQueries({ queryKey: getListConversionsQueryKey() });
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
  }, [activeConversion, toast, queryClient]);

  const handleFileSelect = async (file: File) => {
    if (!file) return;
    setIsCollapsed(true);
    try {
      const result = await uploadFile(file, useAi);
      setActiveConversionId(result.id);
      toast({
        title: useAi ? "AI conversion started" : "File uploaded",
        description: useAi
          ? "DocSmith AI is reading and reformatting your document..."
          : "Conversion started automatically.",
      });
    } catch (err: unknown) {
      setIsCollapsed(false);
      const msg = err instanceof Error ? err.message : "Upload failed";
      toast({
        title: "Upload failed",
        description: msg,
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

  const handleReset = () => {
    setActiveConversionId(null);
    setIsCollapsed(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const recentConversions = conversions?.slice(0, 3) || [];

  const progressValue =
    activeConversion?.status === "done"
      ? 100
      : activeConversion?.status === "processing"
      ? 65
      : activeConversion?.status === "error"
      ? 0
      : 20;

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6 lg:space-y-10 animate-in fade-in duration-500">
      {/* Header */}
      <div className="space-y-1.5">
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-foreground">
          DocSmith
        </h1>
        <p className="text-sm sm:text-base lg:text-lg text-muted-foreground max-w-2xl">
          Drop any messy file. DocSmith extracts, cleans, and formats it into a pristine Word document — with optional AI parsing.
        </p>
      </div>

      {/* AI Mode Toggle */}
      <div
        className={`relative overflow-hidden rounded-xl border-2 p-3 sm:p-4 transition-all duration-300 ${
          useAi
            ? "border-purple-400/60 bg-gradient-to-r from-purple-500/10 via-blue-500/5 to-purple-500/10 shadow-md shadow-purple-500/10"
            : "border-border bg-card hover:border-primary/30"
        }`}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`p-2 rounded-lg shrink-0 transition-colors ${
                useAi ? "bg-purple-500/15 text-purple-600" : "bg-muted text-muted-foreground"
              }`}
            >
              {useAi ? <Sparkles className="h-5 w-5" /> : <Zap className="h-5 w-5" />}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-sm sm:text-base text-foreground">
                  {useAi ? "AI Smart Parser" : "Standard Parser"}
                </h3>
                {useAi && (
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-purple-600 text-white px-2 py-0.5 rounded-full">
                    AI
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground line-clamp-2">
                {useAi
                  ? "GPT-OSS-120B reads your document and rebuilds the structure beautifully."
                  : "Fast, deterministic format-specific parsers. Toggle on AI for messy or complex files."}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setUseAi(!useAi)}
            disabled={isUploading || !!activeConversion}
            data-testid="toggle-ai-mode"
            aria-label="Toggle AI parsing"
            className={`relative inline-flex h-7 w-12 sm:h-8 sm:w-14 shrink-0 items-center rounded-full transition-colors duration-300 disabled:opacity-50 disabled:cursor-not-allowed ${
              useAi
                ? "bg-gradient-to-r from-purple-600 to-blue-600"
                : "bg-muted-foreground/30"
            }`}
          >
            <span
              className={`inline-block h-5 w-5 sm:h-6 sm:w-6 rounded-full bg-white shadow-md transform transition-transform duration-300 ${
                useAi ? "translate-x-6 sm:translate-x-7" : "translate-x-1"
              }`}
            />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 lg:gap-8">
        <div className="lg:col-span-2 space-y-5">

          {/* Upload Zone */}
          <div
            style={{
              maxHeight: isCollapsed ? "90px" : "480px",
              opacity: isCollapsed ? 0.6 : 1,
              overflow: "hidden",
              transition: "max-height 0.5s cubic-bezier(0.4,0,0.2,1), opacity 0.4s ease",
            }}
          >
            <Card
              className={`relative overflow-hidden border-2 border-dashed cursor-pointer
                ${isDragging ? "border-primary bg-primary/5 scale-[1.01]" : "border-border hover:border-primary/40 hover:bg-muted/30"}
                ${isUploading ? "pointer-events-none" : ""}
                transition-all duration-200
              `}
              onDrop={handleDrop}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
              onClick={() => !isCollapsed && fileInputRef.current?.click()}
              data-testid="upload-zone"
            >
              <div className={`flex flex-col items-center justify-center text-center space-y-4 transition-all duration-500 ${isCollapsed ? "p-4" : "p-8 sm:p-12 lg:p-14 min-h-[220px] sm:min-h-[300px] lg:min-h-[360px]"}`}>
                <div className={`bg-primary/10 rounded-full text-primary transition-all duration-500 ${isCollapsed ? "p-2" : "p-4 sm:p-5"}`}>
                  <UploadCloud className={`transition-all duration-500 ${isCollapsed ? "h-5 w-5" : "h-8 w-8 sm:h-12 sm:w-12"}`} />
                </div>
                {!isCollapsed && (
                  <>
                    <div className="space-y-1">
                      <h3 className="text-lg sm:text-xl lg:text-2xl font-semibold">Drag & Drop your file here</h3>
                      <p className="text-muted-foreground text-xs sm:text-sm">Or click anywhere to browse your computer</p>
                    </div>
                    <input
                      type="file"
                      ref={fileInputRef}
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) handleFileSelect(e.target.files[0]);
                      }}
                      data-testid="input-file"
                    />
                    <Button
                      size="lg"
                      onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                      disabled={isUploading}
                      data-testid="button-browse"
                      className="px-8 sm:px-10 shadow hover:shadow-md transition-all"
                    >
                      {isUploading ? (
                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Uploading...</>
                      ) : "Browse Files"}
                    </Button>
                  </>
                )}
                {isCollapsed && (
                  <p className="text-sm text-muted-foreground">Converting your document...</p>
                )}
              </div>
            </Card>
          </div>

          {/* Result Card */}
          {activeConversion && (
            <div style={{ animation: "slideUp 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards" }}>
              <style>{`
                @keyframes slideUp {
                  from { opacity: 0; transform: translateY(28px) scale(0.97); }
                  to   { opacity: 1; transform: translateY(0) scale(1); }
                }
              `}</style>

              <Card className={`overflow-hidden border-2 transition-all duration-300
                ${activeConversion.status === "done" ? "border-green-400/50 shadow-lg shadow-green-500/10" : "border-border"}
              `}>
                <Progress
                  value={progressValue}
                  className={`h-1 rounded-none ${activeConversion.status === "error" ? "[&>div]:bg-destructive" : activeConversion.status === "done" ? "[&>div]:bg-green-500" : ""}`}
                />

                <div className="p-4 sm:p-6 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`p-2 sm:p-2.5 rounded-xl shrink-0 ${activeConversion.status === "done" ? "bg-green-500/10 text-green-600" : "bg-primary/10 text-primary"}`}>
                        {activeConversion.status === "done" ? <FileCheck className="h-5 w-5 sm:h-6 sm:w-6" /> : <FileType className="h-5 w-5 sm:h-6 sm:w-6" />}
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-semibold text-foreground text-sm sm:text-base truncate">{activeConversion.originalFilename}</h4>
                        <p className="text-xs text-muted-foreground truncate">
                          {activeConversion.processingMode ? `Mode: ${activeConversion.processingMode}` : "Processing..."}
                        </p>
                      </div>
                    </div>
                    <StatusBadge status={activeConversion.status} />
                  </div>

                  <div className="text-xs sm:text-sm text-muted-foreground">
                    {activeConversion.status === "pending" && "Waiting in queue..."}
                    {activeConversion.status === "processing" && "Applying professional formatting..."}
                    {activeConversion.status === "done" && "Your document is ready — formatted and polished."}
                    {activeConversion.status === "error" && (activeConversion.errorMessage || "Conversion failed")}
                  </div>

                  {activeConversion.status === "done" && activeConversion.downloadPath && (
                    <a href={activeConversion.downloadPath} download data-testid="button-download-result" style={{ display: "block", textDecoration: "none" }}>
                      <button
                        style={{
                          width: "100%",
                          padding: "16px 24px",
                          borderRadius: "14px",
                          background: "linear-gradient(135deg, #1e3a5f 0%, #16213e 60%, #0f3460 100%)",
                          color: "#fff",
                          fontWeight: 700,
                          fontSize: "1rem",
                          letterSpacing: "0.01em",
                          border: "none",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "12px",
                          boxShadow: "0 8px 24px rgba(15,52,96,0.35), 0 2px 6px rgba(15,52,96,0.2), inset 0 1px 0 rgba(255,255,255,0.12)",
                          transition: "transform 0.15s ease, box-shadow 0.15s ease",
                        }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-3px)";
                          (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 14px 32px rgba(15,52,96,0.45), 0 4px 10px rgba(15,52,96,0.25), inset 0 1px 0 rgba(255,255,255,0.15)";
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)";
                          (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 8px 24px rgba(15,52,96,0.35), 0 2px 6px rgba(15,52,96,0.2), inset 0 1px 0 rgba(255,255,255,0.12)";
                        }}
                        onMouseDown={(e) => {
                          (e.currentTarget as HTMLButtonElement).style.transform = "translateY(1px)";
                          (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 4px 12px rgba(15,52,96,0.3), inset 0 1px 0 rgba(255,255,255,0.08)";
                        }}
                        onMouseUp={(e) => {
                          (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-3px)";
                          (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 14px 32px rgba(15,52,96,0.45), 0 4px 10px rgba(15,52,96,0.25), inset 0 1px 0 rgba(255,255,255,0.15)";
                        }}
                      >
                        <span style={{
                          display: "flex", alignItems: "center", justifyContent: "center",
                          width: "36px", height: "36px", borderRadius: "10px",
                          background: "rgba(255,255,255,0.15)", backdropFilter: "blur(4px)",
                          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.2), 0 2px 4px rgba(0,0,0,0.2)",
                        }}>
                          <Download style={{ width: "20px", height: "20px" }} />
                        </span>
                        Download Your .docx File
                      </button>
                    </a>
                  )}

                  <button
                    onClick={handleReset}
                    data-testid="button-convert-another"
                    style={{
                      width: "100%", padding: "10px", borderRadius: "8px",
                      background: "transparent", color: "hsl(var(--muted-foreground))",
                      fontWeight: 500, fontSize: "0.875rem",
                      border: "1px dashed hsl(var(--border))", cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      gap: "8px", transition: "all 0.15s ease",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.borderColor = "hsl(var(--primary))";
                      (e.currentTarget as HTMLButtonElement).style.color = "hsl(var(--primary))";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.borderColor = "hsl(var(--border))";
                      (e.currentTarget as HTMLButtonElement).style.color = "hsl(var(--muted-foreground))";
                    }}
                  >
                    <RefreshCw style={{ width: "14px", height: "14px" }} />
                    Convert another file
                  </button>
                </div>
              </Card>
            </div>
          )}

          {/* Recent Conversions */}
          {recentConversions.length > 0 && !activeConversion && (
            <div className="space-y-3 pt-1">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Recent Conversions</h3>
                <Link href="/history" className="text-xs text-primary hover:underline flex items-center gap-1">
                  View all <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
              <div className="grid gap-2.5">
                {recentConversions.map((conv) => (
                  <Card key={conv.id} className="p-3 sm:p-4 flex items-center justify-between hover:border-primary/40 transition-colors gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-1.5 sm:p-2 bg-muted rounded-md text-muted-foreground shrink-0">
                        <FileType className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-xs sm:text-sm truncate">{conv.originalFilename}</p>
                        <p className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(conv.createdAt), { addSuffix: true })}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <StatusBadge status={conv.status} />
                      {conv.status === "done" && conv.downloadPath && (
                        <Button size="sm" variant="outline" asChild className="gap-1.5 h-8 px-2.5 text-xs hidden sm:flex">
                          <a href={conv.downloadPath} download data-testid={`button-download-${conv.id}`}>
                            <Download className="h-3 w-3" /> Download
                          </a>
                        </Button>
                      )}
                      {conv.status === "done" && conv.downloadPath && (
                        <Button size="icon" variant="outline" asChild className="h-8 w-8 sm:hidden">
                          <a href={conv.downloadPath} download>
                            <Download className="h-3.5 w-3.5" />
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

        {/* Sidebar: Supported Formats — hidden on mobile, shown on lg+ */}
        <div className="hidden lg:block space-y-6">
          <Card className="p-6 bg-card border-border">
            <h3 className="font-semibold mb-4 text-foreground">Supported Formats</h3>
            <div className="space-y-2.5">
              {SUPPORTED_TYPES.map((type) => (
                <div key={type.ext} className="flex justify-between items-center text-sm border-b border-border/40 pb-2 last:border-0 last:pb-0">
                  <span className="font-mono text-xs font-medium bg-muted px-1.5 py-0.5 rounded text-muted-foreground">{type.ext}</span>
                  <span className="text-muted-foreground text-right text-xs">{type.label}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Mobile: Supported Formats collapsible */}
        <div className="lg:hidden">
          <button
            onClick={() => setFormatsExpanded(!formatsExpanded)}
            className="w-full flex items-center justify-between p-4 rounded-xl border border-border bg-card text-sm font-medium text-foreground hover:bg-muted transition-colors"
          >
            <span>Supported Formats ({SUPPORTED_TYPES.length} types)</span>
            {formatsExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </button>
          {formatsExpanded && (
            <Card className="mt-2 p-4 bg-card border-border">
              <div className="grid grid-cols-2 gap-2">
                {SUPPORTED_TYPES.map((type) => (
                  <div key={type.ext} className="flex items-center justify-between text-xs border border-border/40 rounded-lg px-2.5 py-2">
                    <span className="font-mono font-medium bg-muted px-1.5 py-0.5 rounded text-muted-foreground">{type.ext}</span>
                    <span className="text-muted-foreground text-right ml-2 truncate">{type.label}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: Conversion["status"] }) {
  if (status === "done") {
    return (
      <span className="flex items-center text-xs font-medium text-green-600 bg-green-500/10 px-2 sm:px-2.5 py-1 rounded-full border border-green-500/20 whitespace-nowrap">
        <CheckCircle2 className="mr-1 h-3 w-3" /> Done
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className="flex items-center text-xs font-medium text-destructive bg-destructive/10 px-2 sm:px-2.5 py-1 rounded-full border border-destructive/20 whitespace-nowrap">
        <AlertCircle className="mr-1 h-3 w-3" /> Error
      </span>
    );
  }
  if (status === "processing") {
    return (
      <span className="flex items-center text-xs font-medium text-blue-600 bg-blue-500/10 px-2 sm:px-2.5 py-1 rounded-full border border-blue-500/20 whitespace-nowrap">
        <Loader2 className="mr-1 h-3 w-3 animate-spin" /> Processing
      </span>
    );
  }
  return (
    <span className="flex items-center text-xs font-medium text-muted-foreground bg-muted px-2 sm:px-2.5 py-1 rounded-full whitespace-nowrap">
      Pending
    </span>
  );
}
