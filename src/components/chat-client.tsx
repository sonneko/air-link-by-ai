"use client";

import { useState } from "react";
import useWebRTC from "@/hooks/use-webrtc";

import HomeView from "@/components/views/home-view";
import CreatingView from "@/components/views/creating-view";
import JoiningView from "@/components/views/joining-view";
import ChattingView from "@/components/views/chatting-view";
import ScanningView from "@/components/views/scanning-view";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, MessageSquare } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import useIsMounted from "@/hooks/use-is-mounted";


export default function ChatClient() {
  const { toast } = useToast();
  const isMounted = useIsMounted();
  const [mode, setMode] = useState<"home" | "creating" | "joining" | "chatting" | "scanning">("home");

  const {
    messages,
    connectionStatus,
    offer,
    answer,
    pastedInfo,
    setPastedInfo,
    createSession,
    joinSession,
    completeJoin,
    sendMessage,
    cleanup,
  } = useWebRTC({
    onConnectionStateChange: (state) => {
      if (state === "connected") {
        setMode("chatting");
      } else if (state === "disconnected" || state === "failed") {
        cleanupAndGoHome();
        toast({
          title: "Connection Lost",
          description: "The connection with your peer has been lost.",
          variant: "destructive",
        });
      }
    },
    onChatting: () => setMode('chatting')
  });

  const cleanupAndGoHome = () => {
    cleanup();
    setMode("home");
  };

  const handleCreateSession = async () => {
    setMode("creating");
    await createSession();
  };
  
  const handleJoinSession = async () => {
    await joinSession();
  }

  const handleScannedData = (scannedData: string) => {
    setPastedInfo(scannedData);
    setMode("joining");
  };

  if (!isMounted) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-lg bg-primary/20 text-primary">
              <MessageSquare className="w-8 h-8" />
            </div>
            <div>
              <CardTitle className="text-2xl font-bold">WebRTCSpeak</CardTitle>
              <CardDescription>Ad-hoc, direct & private chat.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-center space-x-2 text-muted-foreground pt-4">
            <Loader2 className="animate-spin h-5 w-5" />
            <span>Loading...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  switch (mode) {
    case "creating":
      return (
        <CreatingView
          offer={offer}
          pastedInfo={pastedInfo}
          setPastedInfo={setPastedInfo}
          onCompleteJoin={completeJoin}
          onCancel={cleanupAndGoHome}
        />
      );
    case "joining":
      return (
        <JoiningView
          answer={answer}
          pastedInfo={pastedInfo}
          setPastedInfo={setPastedInfo}
          onJoin={handleJoinSession}
          connectionStatus={connectionStatus}
          onBack={cleanupAndGoHome}
        />
      );
    case "scanning":
      return (
        <ScanningView
          onScan={handleScannedData}
          onBack={() => setMode("home")}
        />
      );
    case "chatting":
      return (
        <ChattingView
          messages={messages}
          connectionStatus={connectionStatus}
          onSendMessage={sendMessage}
        />
      );
    default:
      return (
        <HomeView
          onCreateSession={handleCreateSession}
          onJoin={() => setMode("joining")}
          onScan={() => setMode("scanning")}
        />
      );
  }
}
