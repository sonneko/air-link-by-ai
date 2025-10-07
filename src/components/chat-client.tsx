"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import QRCode from "qrcode.react";
import pako from "pako";
import { Scanner, type IDetectedBarcode } from "@yudiel/react-qr-scanner";

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
import { Textarea } from "@/components/ui/textarea";
import {
  Copy,
  Send,
  MessageSquare,
  Loader2,
  CheckCircle2,
  XCircle,
  Link as LinkIcon,
  ArrowLeft,
  QrCode,
  Scan,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

const servers = {
  iceServers: [
    {
      urls: ["stun:stun1.l.google.com:19302", "stun:stun2.l.google.com:19302"],
    },
  ],
  iceCandidatePoolSize: 10,
};

type AppMode = "home" | "creating" | "joining" | "chatting" | "scanning";
type ConnectionStatus = "disconnected" | "connecting" | "connected" | "failed";
type Message = {
  text: string;
  sender: "me" | "peer";
  timestamp: string;
};

// URL-safe compression and decompression helpers
const compress = (data: string): string => {
  const compressed = pako.deflate(data, { to: 'string' });
  return btoa(compressed)
    .replace(/\+/g, '-') // Convert '+' to '-'
    .replace(/\//g, '_') // Convert '/' to '_'
    .replace(/=+$/, ''); // Remove padding
};

const decompress = (base64Data: string): string => {
  try {
    let urlSafeData = base64Data
      .replace(/-/g, '+') // Convert '-' back to '+'
      .replace(/_/g, '/'); // Convert '_' back to '/'

    // Add padding back
    while (urlSafeData.length % 4) {
      urlSafeData += '=';
    }
    const compressed = atob(urlSafeData);
    return pako.inflate(compressed, { to: 'string' });
  } catch (e) {
    // If decompression fails, it might be uncompressed data
    return base64Data;
  }
};

const isValidJson = (str: string) => {
  try {
    JSON.parse(str);
  } catch (e) {
    return false;
  }
  return true;
}

export default function ChatClient() {
  const { toast } = useToast();
  const [isMounted, setIsMounted] = useState(false);

  const [mode, setMode] = useState<AppMode>("home");
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentMessage, setCurrentMessage] = useState<string>("");
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("disconnected");
    
  const [offer, setOffer] = useState('');
  const [answer, setAnswer] = useState('');
  const [pastedInfo, setPastedInfo] = useState('');


  const pc = useRef<RTCPeerConnection | null>(null);
  const dataChannel = useRef<RTCDataChannel | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

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

  const cleanup = useCallback(() => {
    if (pc.current) {
      pc.current.close();
      pc.current = null;
    }
    if (dataChannel.current) {
      dataChannel.current.close();
      dataChannel.current = null;
    }

    setMessages([]);
    setCurrentMessage('');
    setConnectionStatus('disconnected');
    setMode('home');
    setOffer('');
    setAnswer('');
    setPastedInfo('');
  }, []);

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
    return peerConnection;
  }, [cleanup, toast]);
  
  const setupDataChannel = useCallback((channel: RTCDataChannel) => {
    dataChannel.current = channel;
    channel.onopen = () => {
      setConnectionStatus("connected");
      setMode("chatting");
    };
    channel.onclose = () => {
      cleanup();
    };
    channel.onmessage = (event) => {
      const receivedMessage: Message = JSON.parse(event.data);
      setMessages((prev) => [...prev, receivedMessage]);
    };
  }, [cleanup]);

  const createSession = useCallback(async () => {
    setConnectionStatus("connecting");
    const peerConnection = startPeerConnection();
    setMode("creating");

    const dc = peerConnection.createDataChannel("chat");
    setupDataChannel(dc);
    
    const candidates: Partial<RTCIceCandidate>[] = [];
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        candidates.push({
          candidate: event.candidate.candidate,
          sdpMid: event.candidate.sdpMid,
          sdpMLineIndex: event.candidate.sdpMLineIndex,
        });
      }
    };

    const offerDescription = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offerDescription);
    
    // Wait for ICE gathering to complete
    await new Promise<void>((resolve) => {
      const checkInterval = setInterval(() => {
        if (peerConnection.iceGatheringState === 'complete') {
          clearInterval(checkInterval);
          const offerPayload = {
            sdp: peerConnection.localDescription,
            candidates,
          };
          setOffer(compress(JSON.stringify(offerPayload)));
          resolve();
        }
      }, 100);
    });

  }, [startPeerConnection, setupDataChannel]);

  const handleScannedData = (result: IDetectedBarcode[]) => {
    if (result && result.length > 0 && result[0].rawValue) {
      const scannedData = result[0].rawValue;
      setPastedInfo(scannedData);
      setMode("joining");
    } else {
      console.error("Invalid scan result format", result);
      toast({
        title: "Scan Error",
        description: "Could not read QR code. The format is invalid.",
        variant: "destructive",
      });
    }
  };

  const joinSession = useCallback(async () => {
    if (!pastedInfo) {
      toast({
        title: "Error",
        description: "Please paste or scan the session info from your friend.",
        variant: "destructive",
      });
      return;
    }
    
    try {
      let info = pastedInfo;
      if (!isValidJson(info)) {
        info = decompress(pastedInfo);
      }
      
      const offerPayload = JSON.parse(info);
      if (!offerPayload.sdp || !offerPayload.candidates) {
        throw new Error("Invalid session info");
      }

      setConnectionStatus("connecting");
      const peerConnection = startPeerConnection();
      
      peerConnection.ondatachannel = (event) => {
        setupDataChannel(event.channel);
      };

      const candidates: Partial<RTCIceCandidate>[] = [];
      peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          candidates.push({
            candidate: event.candidate.candidate,
            sdpMid: event.candidate.sdpMid,
            sdpMLineIndex: event.candidate.sdpMLineIndex,
          });
        }
      };

      await peerConnection.setRemoteDescription(new RTCSessionDescription(offerPayload.sdp));
      offerPayload.candidates.forEach((candidate: RTCIceCandidateInit) => {
        peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      });
      
      const answerDescription = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answerDescription);
      
      await new Promise<void>((resolve) => {
        const checkInterval = setInterval(() => {
          if (peerConnection.iceGatheringState === 'complete') {
            clearInterval(checkInterval);
            const answerPayload = {
              sdp: peerConnection.localDescription,
              candidates,
            };
            setAnswer(compress(JSON.stringify(answerPayload)));
            resolve();
          }
        }, 100);
      });

    } catch (e) {
      console.error(e);
      toast({
        title: "Error",
        description: "Invalid session info provided. Please check and try again.",
        variant: "destructive",
      });
      setPastedInfo('');
    }
  }, [pastedInfo, startPeerConnection, setupDataChannel, toast]);

  const completeJoin = useCallback(async () => {
    if(!pastedInfo) return;
    try {
      let info = pastedInfo;
      if (!isValidJson(info)) {
        info = decompress(pastedInfo);
      }
      const answerPayload = JSON.parse(info);
       if (!answerPayload.sdp || !answerPayload.candidates) {
        throw new Error("Invalid session info");
      }

      await pc.current?.setRemoteDescription(new RTCSessionDescription(answerPayload.sdp));
      answerPayload.candidates.forEach((candidate: RTCIceCandidateInit) => {
        pc.current?.addIceCandidate(new RTCIceCandidate(candidate));
      });
    } catch(e) {
        toast({
        title: "Error",
        description: "Invalid answer info provided. Please check and try again.",
        variant: "destructive",
      });
      setPastedInfo('');
    }
  }, [pastedInfo, toast]);

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

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: "Session info copied to clipboard.",
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
         <div className="flex gap-2">
          <Button onClick={() => setMode('joining')} variant="secondary" className="w-full">
            Join Chat
          </Button>
          <Button onClick={() => setMode('scanning')} variant="outline" size="icon" aria-label="Scan QR Code">
            <Scan />
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  const renderCreating = () => (
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
               <Dialog>
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
                      }
                    }}
                    onError={(error) => console.log(error?.message)}
                  />
                </DialogContent>
              </Dialog>
            </div>
            <Button onClick={completeJoin} disabled={!pastedInfo} className="w-full">Connect</Button>
          </>
        ) : (
          <div className="flex items-center justify-center space-x-2 text-muted-foreground pt-4">
            <Loader2 className="animate-spin h-5 w-5" />
            <span>Generating session...</span>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex-col gap-2">
        <Button variant="outline" onClick={cleanup} className="w-full">
          Cancel
        </Button>
      </CardFooter>
    </Card>
  );

  const renderJoining = () => (
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
          <Button onClick={joinSession} disabled={!pastedInfo} className="w-full">
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
        <Button variant="outline" onClick={cleanup} className="w-full">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
      </CardFooter>
    </Card>
  );
  
  const renderScanner = () => (
    <Card>
      <CardHeader>
        <CardTitle>Scan QR Code</CardTitle>
        <CardDescription>Scan the QR code from your friend to join the chat.</CardDescription>
      </CardHeader>
      <CardContent>
        <Scanner
          onScan={(result) => {
            handleScannedData(result);
          }}
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
        <Button variant="outline" onClick={() => setMode('home')} className="w-full">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
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

  // Prevent SSR until component is mounted
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
        return renderCreating();
    case "joining":
        return renderJoining();
    case "scanning":
      return renderScanner();
    case "chatting":
      return renderChatting();
    default:
      return renderHome();
  }
}
