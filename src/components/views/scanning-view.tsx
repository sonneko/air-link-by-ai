
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import { Scanner, type IDetectedBarcode } from "@yudiel/react-qr-scanner";
import { ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ScanningViewProps {
  onScan: (data: string) => void;
  onBack: () => void;
}

export default function ScanningView({ onScan, onBack }: ScanningViewProps) {
  const { toast } = useToast();
  
  const handleScan = (result: IDetectedBarcode[]) => {
    if (result && result.length > 0 && result[0].rawValue) {
        onScan(result[0].rawValue);
    } else {
        toast({
            title: "Scan Error",
            description: "Could not read QR code. The format is invalid.",
            variant: "destructive",
        });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Scan QR Code</CardTitle>
        <CardDescription>Scan the QR code from your friend to join the chat.</CardDescription>
      </CardHeader>
      <CardContent>
        <Scanner
          onScan={handleScan}
          onError={(error) => {
            console.log(error?.message);
            toast({
              title: "Scan Error",
              description: "Could not scan QR code. Please try again.",
              variant: "destructive",
            });
          }}
        />
      </CardContent>
      <CardFooter>
        <Button variant="outline" onClick={onBack} className="w-full">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
      </CardFooter>
    </Card>
  );
}
