import { Link } from "wouter";
import { FileQuestion, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] w-full text-center px-4 animate-in fade-in zoom-in duration-500">
      <div className="h-24 w-24 bg-primary/10 text-primary rounded-full flex items-center justify-center mb-6">
        <FileQuestion className="h-12 w-12" />
      </div>
      <h1 className="text-4xl font-bold tracking-tight text-foreground mb-2">Page Not Found</h1>
      <p className="text-muted-foreground max-w-md mx-auto mb-8">
        We couldn't find the page you're looking for. It might have been moved or the URL might be incorrect.
      </p>
      <Button asChild size="lg">
        <Link href="/">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Return to Studio
        </Link>
      </Button>
    </div>
  );
}
