
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Link as LinkIcon, MessageSquare, Scan } from "lucide-react";

interface HomeViewProps {
  onCreateSession: () => void;
  onJoin: () => void;
  onScan: () => void;
}

export default function HomeView({ onCreateSession, onJoin, onScan }: HomeViewProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-lg bg-primary/20 text-primary">
            <MessageSquare className="w-8 h-8" />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold">AirLink</CardTitle>
            <CardDescription>Ad-hoc, direct & private chat.</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <Button onClick={onCreateSession} className="w-full" size="lg">
          <LinkIcon className="mr-2 h-5 w-5" /> Create New Chat
        </Button>
        <div className="flex items-center space-x-2">
          <div className="flex-1 h-px bg-border" />
          <p className="text-sm text-muted-foreground">OR</p>
          <div className="flex-1 h-px bg-border" />
        </div>
        <div className="flex gap-2">
          <Button onClick={onJoin} variant="secondary" className="w-full">
            Join Chat
          </Button>
          <Button onClick={onScan} variant="outline" size="icon" aria-label="Scan QR Code">
            <Scan />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
