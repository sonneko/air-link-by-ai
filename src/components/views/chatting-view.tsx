
import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Loader2, CheckCircle2, XCircle } from "lucide-react";
import type { Message } from "@/lib/types";

type ConnectionStatus = "disconnected" | "connecting" | "connected" | "failed";

interface ChattingViewProps {
  messages: Message[];
  connectionStatus: ConnectionStatus;
  onSendMessage: (message: string) => string;
}

export default function ChattingView({ messages, connectionStatus, onSendMessage }: ChattingViewProps) {
  const [currentMessage, setCurrentMessage] = useState("");
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollAreaRef.current) {
      const viewport = scrollAreaRef.current.querySelector<HTMLDivElement>('div[data-radix-scroll-area-viewport]');
      if (viewport) {
        viewport.scrollTop = viewport.scrollHeight;
      }
    }
  }, [messages]);

  const handleSendMessage = () => {
    const remainingMessage = onSendMessage(currentMessage);
    setCurrentMessage(remainingMessage);
  };

  const renderStatusBadge = () => {
    switch (connectionStatus) {
      case "connected":
        return <Badge variant="default" className="bg-accent text-accent-foreground"><CheckCircle2 className="mr-1 h-3 w-3" /> Connected</Badge>;
      case "connecting":
        return <Badge variant="secondary"><Loader2 className="mr-1 h-3 w-3 animate-spin" /> Connecting</Badge>;
      case "failed":
        return <Badge variant="destructive"><XCircle className="mr-1 h-3 w-3" /> Failed</Badge>;
      default:
        return <Badge variant="outline">Disconnected</Badge>;
    }
  };

  return (
    <Card className="flex flex-col h-[80vh] w-full max-h-[700px]">
      <CardHeader className="flex flex-row items-center justify-between border-b">
        <CardTitle>Chat</CardTitle>
        {renderStatusBadge()}
      </CardHeader>
      <CardContent className="flex-1 p-0 overflow-hidden">
        <ScrollArea className="h-full p-6" ref={scrollAreaRef}>
          <div className="space-y-4">
            {messages.map((msg, index) => (
              <div
                key={index}
                className={`flex items-end gap-2 animate-in fade-in ${
                  msg.sender === "me" ? "justify-end" : "justify-start"
                }`}
              >
                {msg.sender === "peer" && (
                   <div className="w-8 h-8 rounded-full bg-accent flex-shrink-0" aria-label="Peer avatar" />
                )}
                <div
                  className={`max-w-[75%] p-3 rounded-lg shadow-sm ${
                    msg.sender === "me"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  }`}
                >
                  <p className="text-sm break-words">{msg.text}</p>
                  <p className="text-xs opacity-70 mt-1 text-right">
                    {msg.timestamp}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
      <CardFooter className="pt-4 border-t">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex w-full items-center space-x-2"
        >
          <Input
            value={currentMessage}
            onChange={(e) => setCurrentMessage(e.target.value)}
            placeholder="Type a message..."
            autoComplete="off"
            aria-label="Message input"
            disabled={connectionStatus !== "connected"}
          />
          <Button
            type="submit"
            size="icon"
            disabled={connectionStatus !== "connected" || !currentMessage.trim()}
            aria-label="Send message"
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </CardFooter>
    </Card>
  );
}
