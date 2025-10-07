
"use client";

import { useState, useRef, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import pako from "pako";
import type { Message } from "@/lib/types";
import { compress, decompress, isValidJson } from "@/lib/compression";


const servers = {
  iceServers: [
    {
      urls: ["stun:stun1.l.google.com:19302", "stun:stun2.l.google.com:19302"],
    },
  ],
  iceCandidatePoolSize: 10,
};

type ConnectionStatus = "disconnected" | "connecting" | "connected" | "failed";

interface UseWebRTCOptions {
  onConnectionStateChange?: (state: ConnectionStatus) => void;
  onChatting?: () => void;
}

export default function useWebRTC({ onConnectionStateChange, onChatting }: UseWebRTCOptions = {}) {
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("disconnected");
  const [offer, setOffer] = useState("");
  const [answer, setAnswer] = useState("");
  const [pastedInfo, setPastedInfo] = useState("");

  const pc = useRef<RTCPeerConnection | null>(null);
  const dataChannel = useRef<RTCDataChannel | null>(null);

  const cleanup = useCallback(() => {
    pc.current?.close();
    pc.current = null;
    dataChannel.current?.close();
    dataChannel.current = null;
    setMessages([]);
    setConnectionStatus("disconnected");
    setOffer("");
    setAnswer("");
    setPastedInfo("");
  }, []);

  const handleConnectionStateChange = useCallback(() => {
    if (pc.current) {
        const newState = pc.current.connectionState as ConnectionStatus;
        setConnectionStatus(newState);
        onConnectionStateChange?.(newState);
    }
  }, [onConnectionStateChange]);
  
  const setupDataChannel = useCallback((channel: RTCDataChannel) => {
    dataChannel.current = channel;
    channel.onopen = () => {
      setConnectionStatus("connected");
      onConnectionStateChange?.("connected");
      onChatting?.();
    };
    channel.onclose = cleanup;
    channel.onmessage = (event) => {
      const receivedMessage: Message = JSON.parse(event.data);
      setMessages((prev) => [...prev, receivedMessage]);
    };
  }, [cleanup, onChatting, onConnectionStateChange]);

  const startPeerConnection = useCallback(() => {
    const peerConnection = new RTCPeerConnection(servers);
    pc.current = peerConnection;
    peerConnection.onconnectionstatechange = handleConnectionStateChange;
    return peerConnection;
  }, [handleConnectionStateChange]);

  const createSession = useCallback(async () => {
    setConnectionStatus("connecting");
    const peerConnection = startPeerConnection();

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
    
    await new Promise<void>((resolve) => {
        const checkInterval = setInterval(() => {
          if (peerConnection.iceGatheringState === 'complete') {
            clearInterval(checkInterval);
            const offerPayload = { sdp: peerConnection.localDescription, candidates };
            setOffer(compress(JSON.stringify(offerPayload)));
            resolve();
          }
        }, 100);
      });

  }, [startPeerConnection, setupDataChannel]);

  const joinSession = useCallback(async () => {
    if (!pastedInfo) {
      toast({ title: "Error", description: "Please paste or scan the session info.", variant: "destructive" });
      return;
    }

    try {
      let info = pastedInfo;
      if (!isValidJson(info)) info = decompress(pastedInfo);
      
      const offerPayload = JSON.parse(info);
      if (!offerPayload.sdp || !offerPayload.candidates) throw new Error("Invalid session info");

      setConnectionStatus("connecting");
      const peerConnection = startPeerConnection();

      peerConnection.ondatachannel = (event) => setupDataChannel(event.channel);

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
      offerPayload.candidates.forEach((c: RTCIceCandidateInit) => peerConnection.addIceCandidate(new RTCIceCandidate(c)));

      const answerDescription = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answerDescription);

      await new Promise<void>((resolve) => {
        const checkInterval = setInterval(() => {
          if (peerConnection.iceGatheringState === 'complete') {
            clearInterval(checkInterval);
            const answerPayload = { sdp: peerConnection.localDescription, candidates };
            setAnswer(compress(JSON.stringify(answerPayload)));
            resolve();
          }
        }, 100);
      });

    } catch (e) {
      console.error(e);
      toast({ title: "Error", description: "Invalid session info provided.", variant: "destructive" });
      setPastedInfo('');
    }
  }, [pastedInfo, startPeerConnection, setupDataChannel, toast]);

  const completeJoin = useCallback(async () => {
    if (!pastedInfo || !pc.current) return;
    try {
      let info = pastedInfo;
      if (!isValidJson(info)) info = decompress(pastedInfo);

      const answerPayload = JSON.parse(info);
      if (!answerPayload.sdp || !answerPayload.candidates) throw new Error("Invalid session info");

      await pc.current.setRemoteDescription(new RTCSessionDescription(answerPayload.sdp));
      answerPayload.candidates.forEach((c: RTCIceCandidateInit) => pc.current?.addIceCandidate(new RTCIceCandidate(c)));
    } catch (e) {
      toast({ title: "Error", description: "Invalid answer info provided.", variant: "destructive" });
      setPastedInfo('');
    }
  }, [pastedInfo, toast]);

  const sendMessage = (currentMessage: string): string => {
    if (currentMessage.trim() === "" || !dataChannel.current || dataChannel.current.readyState !== "open") return currentMessage;
    
    const message: Message = { text: currentMessage, sender: "peer", timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) };
    dataChannel.current.send(JSON.stringify(message));

    const myMessage: Message = { text: currentMessage, sender: "me", timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) };
    setMessages((prev) => [...prev, myMessage]);
    
    return "";
  };

  return {
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
  };
}
