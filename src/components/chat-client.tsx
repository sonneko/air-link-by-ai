"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  doc,
  getDoc,
  setDoc,
  collection,
  addDoc,
  onSnapshot,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Copy,
  Send,
  MessageSquare,
  Loader2,
  CheckCircle2,
  XCircle,
  Link as LinkIcon,
} from "lucide-react";

const servers = {
  iceServers: [
    {
      urls: ["stun:stun1.l.google.com:19302", "stun:stun2.l.google.com:19302"],
    },
  ],
  iceCandidatePoolSize: 10,
};

type AppMode = "home" | "waiting" | "chatting";
type ConnectionStatus = "disconnected" | "connecting" | "connected" | "failed";
type Message = {
  text: string;
  sender: "me" | "peer";
  timestamp: string;
};

export default function ChatClient() {
  const { toast } = useToast();

  const [mode, setMode] = useState<AppMode>("home");
  const [myId, setMyId] = useState<string>("");
  const [friendId, setFriendId] = useState<string>("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentMessage, setCurrentMessage] = useState<string>("");
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("disconnected");

  const pc = useRef<RTCPeerConnection | null>(null);
  const dataChannel = useRef<RTCDataChannel | null>(null);
  const unsubscribe = useRef<() => void>(() => {});
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollAreaRef.current) {
      const viewport =
        scrollAreaRef.current.querySelector<HTMLDivElement>(
          'div[data-radix-scroll-area-viewport]'
        );
      if (viewport) {
        viewport.scrollTop = viewport.scrollHeight;
      }
    }
  }, [messages]);

  const cleanup = useCallback(async () => {
    if (pc.current) {
      pc.current.close();
      pc.current = null;
    }
    if (dataChannel.current) {
      dataChannel.current.close();
      dataChannel.current = null;
    }
    unsubscribe.current();

    if (myId) {
      const sessionRef = doc(db, 'sessions', myId);
      const sessionDoc = await getDoc(sessionRef);
      if (sessionDoc.exists()) {
        await deleteDoc(sessionRef);
      }
    }

    setMyId('');
    setFriendId('');
    setMessages([]);
    setCurrentMessage('');
    setConnectionStatus('disconnected');
    setMode('home');
  }, [myId]);

  const startPeerConnection = useCallback(() => {
    const peerConnection = new RTCPeerConnection(servers);
    pc.current = peerConnection;

    peerConnection.onconnectionstatechange = () => {
      setConnectionStatus(peerConnection.connectionState as ConnectionStatus);
      if (peerConnection.connectionState === 'connected') {
        setMode('chatting');
      } else if (
        peerConnection.connectionState === 'disconnected' ||
        peerConnection.connectionState === 'failed'
      ) {
        cleanup();
        toast({
          title: 'Connection Lost',
          description: 'The connection with your peer has been lost.',
          variant: 'destructive',
        });
      }
    };
  }, [cleanup, toast]);
  
  const setupDataChannel = useCallback(() => {
    if (!dataChannel.current) return;

    dataChannel.current.onopen = () => {
      setConnectionStatus("connected");
      setMode("chatting");
    };
    dataChannel.current.onclose = () => {
      cleanup();
    };
    dataChannel.current.onmessage = (event) => {
      const receivedMessage: Message = JSON.parse(event.data);
      setMessages((prev) => [...prev, receivedMessage]);
    };
  }, [cleanup]);

  const createSession = useCallback(async () => {
    setConnectionStatus("connecting");
    startPeerConnection();

    const peerConnection = pc.current!;
    const newId = doc(collection(db, "temp")).id;
    setMyId(newId);
    setMode("waiting");

    dataChannel.current = peerConnection.createDataChannel("chat");
    setupDataChannel();

    const sessionRef = doc(db, "sessions", newId);
    const offerCandidates = collection(sessionRef, "offerCandidates");
    const answerCandidates = collection(sessionRef, "answerCandidates");

    peerConnection.onicecandidate = (event) => {
      event.candidate && addDoc(offerCandidates, event.candidate.toJSON());
    };

    const offerDescription = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offerDescription);

    const offer = {
      sdp: offerDescription.sdp,
      type: offerDescription.type,
    };
    await setDoc(sessionRef, { offer });

    unsubscribe.current = onSnapshot(sessionRef, (snapshot) => {
      const data = snapshot.data();
      if (!peerConnection.currentRemoteDescription && data?.answer) {
        const answerDescription = new RTCSessionDescription(data.answer);
        peerConnection.setRemoteDescription(answerDescription);
      }
    });

    onSnapshot(answerCandidates, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === "added") {
          const candidate = new RTCIceCandidate(change.doc.data());
          peerConnection.addIceCandidate(candidate);
        }
      });
    });
  }, [startPeerConnection, setupDataChannel]);

  const joinSession = useCallback(async () => {
    if (!friendId) {
      toast({
        title: "Error",
        description: "Please enter a session ID.",
        variant: "destructive",
      });
      return;
    }

    setConnectionStatus("connecting");
    setMyId(friendId);
    startPeerConnection();

    const peerConnection = pc.current!;
    const sessionRef = doc(db, "sessions", friendId);
    const sessionDoc = await getDoc(sessionRef);

    if (!sessionDoc.exists()) {
      toast({
        title: "Error",
        description: "Session ID not found.",
        variant: "destructive",
      });
      cleanup();
      return;
    }

    peerConnection.ondatachannel = (event) => {
      dataChannel.current = event.channel;
      setupDataChannel();
    };

    const offerCandidates = collection(sessionRef, "offerCandidates");
    const answerCandidates = collection(sessionRef, "answerCandidates");

    peerConnection.onicecandidate = (event) => {
      event.candidate && addDoc(answerCandidates, event.candidate.toJSON());
    };

    const offerDescription = sessionDoc.data().offer;
    await peerConnection.setRemoteDescription(
      new RTCSessionDescription(offerDescription)
    );

    const answerDescription = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answerDescription);

    const answer = {
      type: answerDescription.type,
      sdp: answerDescription.sdp,
    };
    await updateDoc(sessionRef, { answer });

    unsubscribe.current = onSnapshot(offerCandidates, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === "added") {
          const candidate = new RTCIceCandidate(change.doc.data());
          peerConnection.addIceCandidate(candidate);
        }
      });
    });
  }, [friendId, startPeerConnection, setupDataChannel, toast, cleanup]);

  const sendMessage = () => {
    if (
      currentMessage.trim() === "" ||
      !dataChannel.current ||
      dataChannel.current.readyState !== "open"
    )
      return;
    const message: Message = {
      text: currentMessage,
      sender: "peer",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    dataChannel.current.send(JSON.stringify(message));

    const myMessage: Message = {
      text: currentMessage,
      sender: "me",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages((prev) => [...prev, myMessage]);
    setCurrentMessage("");
  };

  const handleCopyId = () => {
    navigator.clipboard.writeText(myId);
    toast({
      title: "Copied!",
      description: "Session ID copied to clipboard.",
    });
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

  const renderHome = () => (
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
        <Button onClick={createSession} className="w-full" size="lg">
          <LinkIcon className="mr-2 h-5 w-5" /> Create New Chat
        </Button>
        <div className="flex items-center space-x-2">
          <div className="flex-1 h-px bg-border" />
          <p className="text-sm text-muted-foreground">OR</p>
          <div className="flex-1 h-px bg-border" />
        </div>
        <div className="space-y-2">
          <Input
            type="text"
            placeholder="Enter friend's session ID"
            value={friendId}
            onChange={(e) => setFriendId(e.target.value)}
            className="text-center"
            aria-label="Friend's Session ID"
          />
          <Button onClick={joinSession} variant="secondary" className="w-full">
            Join Chat
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  const renderWaiting = () => (
    <Card className="text-center">
      <CardHeader>
        <CardTitle>Your Session is Ready</CardTitle>
        <CardDescription>Share this ID with a friend to connect.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative">
          <Input
            type="text"
            value={myId}
            readOnly
            className="text-2xl font-mono text-center h-14 pr-12 bg-muted"
            aria-label="Your Session ID"
          />
          <Button
            onClick={handleCopyId}
            variant="ghost"
            size="icon"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <Copy className="h-6 w-6" />
          </Button>
        </div>
        <div className="flex items-center justify-center space-x-2 text-muted-foreground pt-4">
          <Loader2 className="animate-spin h-5 w-5" />
          <span>Waiting for a friend to join...</span>
        </div>
      </CardContent>
      <CardFooter>
        <Button variant="outline" onClick={cleanup} className="w-full">
          Cancel
        </Button>
      </CardFooter>
    </Card>
  );

  const renderChatting = () => (
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
            sendMessage();
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

  // Prevent SSR
  if (typeof window === "undefined") {
    return null;
  }

  switch (mode) {
    case "waiting":
      return renderWaiting();
    case "chatting":
      return renderChatting();
    default:
      return renderHome();
  }
}
