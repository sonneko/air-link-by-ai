
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import QRCode from "qrcode.react";
import { ArrowLeft, Copy, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type ConnectionStatus = "disconnected" | "connecting" | "connected" | "failed";

interface JoiningViewProps {
  answer: string;
  pastedInfo: string;
  setPastedInfo: (info: string) => void;
  onJoin: () => void;
  connectionStatus: ConnectionStatus;
  onBack: () => void;
}

export default function JoiningView({ answer, pastedInfo, setPastedInfo, onJoin, connectionStatus, onBack }: JoiningViewProps) {
  const { toast } = useToast();

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: "Session info copied to clipboard.",
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Join Chat Session</CardTitle>
        {answer ? (
          <CardDescription>Connection ready. Have your friend scan this QR code or copy the info to send back.</CardDescription>
        ) : (
          <CardDescription>Paste or scan the session info from your friend below.</CardDescription>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {answer ? (
          <>
            <div className="bg-white p-4 rounded-lg flex justify-center">
                <QRCode value={answer} size={256} />
            </div>
            <div className="relative">
              <Textarea value={answer} readOnly className="h-24 text-xs font-mono" />
              <Button
                onClick={() => handleCopy(answer)}
                variant="ghost"
                size="icon"
                className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"
              >
                <Copy className="h-5 w-5" />
              </Button>
            </div>
          </>
        ) : (
          <>
            <Textarea 
              value={pastedInfo} 
              onChange={e => setPastedInfo(e.target.value)} 
              placeholder="Paste friend's session info here"
              className="h-32 text-xs font-mono"
            />
            <Button onClick={onJoin} disabled={!pastedInfo} className="w-full">
              Generate Your Info
            </Button>
          </>
        )}

        {(connectionStatus === 'connecting' && !answer) && (
            <div className="flex items-center justify-center space-x-2 text-muted-foreground pt-4">
                <Loader2 className="animate-spin h-5 w-5" />
                <span>Generating your connection details...</span>
            </div>
        )}
        {(connectionStatus === 'connecting' && answer) && (
            <div className="flex items-center justify-center space-x-2 text-muted-foreground pt-4">
                <Loader2 className="animate-spin h-5 w-5" />
                <span>Waiting for friend to connect...</span>
            </div>
        )}
      </CardContent>
      <CardFooter>
        <Button variant="outline" onClick={onBack} className="w-full">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
      </CardFooter>
    </Card>
  );
}
