
import { useState } from "react";
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
import { Copy, Loader2, Scan } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Scanner } from "@yudiel/react-qr-scanner";

interface CreatingViewProps {
  offer: string;
  pastedInfo: string;
  setPastedInfo: (info: string) => void;
  onCompleteJoin: () => void;
  onCancel: () => void;
}

export default function CreatingView({ offer, pastedInfo, setPastedInfo, onCompleteJoin, onCancel }: CreatingViewProps) {
  const { toast } = useToast();
  const [isScannerOpen, setIsScannerOpen] = useState(false);

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
        <CardTitle>Create Chat Session</CardTitle>
        <CardDescription>
          {offer ? "Have your friend scan this QR code or copy the text below." : "Generating session info..."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {offer ? (
          <>
            <div className="bg-white p-4 rounded-lg flex justify-center">
              <QRCode value={offer} size={256} />
            </div>
            <div className="relative">
              <Textarea value={offer} readOnly className="h-24 text-xs font-mono" />
              <Button
                onClick={() => handleCopy(offer)}
                variant="ghost"
                size="icon"
                className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"
              >
                <Copy className="h-5 w-5" />
              </Button>
            </div>
            <CardDescription>
              After your friend joins, they will send you back their session info. Scan or paste it below.
            </CardDescription>
            <div className="flex gap-2">
              <Textarea
                value={pastedInfo}
                onChange={e => setPastedInfo(e.target.value)}
                placeholder="Paste or scan friend's session info"
                className="h-24 text-xs font-mono"
              />
              <Dialog open={isScannerOpen} onOpenChange={setIsScannerOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="icon" aria-label="Scan QR Code"><Scan /></Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Scan Friend's QR Code</DialogTitle>
                  </DialogHeader>
                  <Scanner
                    onScan={(result) => {
                      if (result && result.length > 0 && result[0].rawValue) {
                        setPastedInfo(result[0].rawValue);
                        setIsScannerOpen(false);
                      }
                    }}
                    onError={(error) => console.log(error?.message)}
                  />
                </DialogContent>
              </Dialog>
            </div>
            <Button onClick={onCompleteJoin} disabled={!pastedInfo} className="w-full">Connect</Button>
          </>
        ) : (
          <div className="flex items-center justify-center space-x-2 text-muted-foreground pt-4">
            <Loader2 className="animate-spin h-5 w-5" />
            <span>Generating session...</span>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex-col gap-2">
        <Button variant="outline" onClick={onCancel} className="w-full">
          Cancel
        </Button>
      </CardFooter>
    </Card>
  );
}
