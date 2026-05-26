"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { LiveKitRoom, VideoConference } from "@livekit/components-react";
import "@livekit/components-styles";

interface Props {
  meetingId: number;
  title: string;
  host: string;
  startTime: string;
  endTime: string;
  livekitToken: string | null;
  livekitUrl: string | null;
}

interface ChatMessage {
  id: string;
  sender: string;
  text: string;
  timestamp: string;
  isMe: boolean;
}

export default function MeetClient({
  meetingId,
  title,
  host,
  startTime,
  endTime,
  livekitToken,
  livekitUrl,
}: Props) {
  const router = useRouter();
  const [useDemoMode, setUseDemoMode] = useState(false);

  // If LiveKit is configured and we don't force demo mode, run real LiveKit conference!
  const hasLiveKitConfig = livekitToken && livekitUrl;

  if (hasLiveKitConfig && !useDemoMode) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans overflow-hidden">
        {/* Top Header */}
        <header className="h-16 border-b border-slate-800 bg-slate-900 px-6 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <div className="px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-full text-[10px] font-bold tracking-widest flex items-center gap-1.5 uppercase">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
              LiveKit Active
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-tight text-white">{title}</h1>
              <p className="text-[10px] text-slate-400 font-medium">Host: {host} · Meeting ID: {meetingId}</p>
            </div>
          </div>
        </header>

        {/* LiveKit Video Conference Room */}
        <div className="flex-1 relative">
          <LiveKitRoom
            video={true}
            audio={true}
            token={livekitToken}
            serverUrl={livekitUrl}
            onDisconnected={() => {
              router.push("/home");
            }}
            data-lk-theme="default"
            style={{ height: "calc(100vh - 64px)" }}
          >
            <VideoConference />
          </LiveKitRoom>
        </div>
      </div>
    );
  }

  // --- DEMO MODE WORKFLOW (Simulated meeting client) ---
  return (
    <DemoMeetingPortal
      meetingId={meetingId}
      title={title}
      host={host}
      endTime={endTime}
      hasConfig={!!hasLiveKitConfig}
      onConfigureDemo={() => setUseDemoMode(false)}
    />
  );
}

// Simulated mock portal to fall back to when LiveKit isn't configured
interface DemoProps {
  meetingId: number;
  title: string;
  host: string;
  endTime: string;
  hasConfig: boolean;
  onConfigureDemo: () => void;
}

function DemoMeetingPortal({
  meetingId,
  title,
  host,
  endTime,
  hasConfig,
  onConfigureDemo,
}: DemoProps) {
  const [micOn, setMicOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(true);
  const [sharingScreen, setSharingScreen] = useState(false);
  const [showChat, setShowChat] = useState(true);
  const [activeTab, setActiveTab] = useState<"chat" | "people">("chat");

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [streamError, setStreamError] = useState<string | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "1",
      sender: host,
      text: `Welcome to the online meeting portal! Glad you could join.`,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      isMe: false,
    },
  ]);
  const [inputText, setInputText] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    async function startCamera() {
      if (!cameraOn) {
        stopCamera();
        return;
      }
      try {
        setStreamError(null);
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: micOn,
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err: any) {
        console.error("Camera access failed:", err);
        setStreamError("Camera not available or permission denied.");
      }
    }

    startCamera();

    return () => {
      stopCamera();
    };
  }, [cameraOn]);

  useEffect(() => {
    if (streamRef.current) {
      const audioTracks = streamRef.current.getAudioTracks();
      audioTracks.forEach((track) => {
        track.enabled = micOn;
      });
    }
  }, [micOn]);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  useEffect(() => {
    const end = new Date(endTime).getTime();
    const updateTimer = () => {
      const now = Date.now();
      const diff = end - now;
      if (diff <= 0) {
        setTimeLeft("Meeting ended");
        return;
      }
      const h = Math.floor(diff / (1000 * 60 * 60));
      const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const s = Math.floor((diff % (1000 * 60)) / 1000);
      const hoursPart = h > 0 ? `${h}:` : "";
      const minsPart = m.toString().padStart(2, "0");
      const secsPart = s.toString().padStart(2, "0");
      setTimeLeft(`${hoursPart}${minsPart}:${secsPart}`);
    };
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [endTime]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, showChat]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    const newMsg: ChatMessage = {
      id: Math.random().toString(),
      sender: "You",
      text: inputText,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      isMe: true,
    };
    setMessages((prev) => [...prev, newMsg]);
    setInputText("");

    setTimeout(() => {
      const hostReply: ChatMessage = {
        id: Math.random().toString(),
        sender: host,
        text: "I hear you! Let's get started with the discussion.",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        isMe: false,
      };
      setMessages((prev) => [...prev, hostReply]);
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans overflow-hidden">
      {/* Configuration Alert Banner */}
      {!hasConfig && (
        <div className="bg-gradient-to-r from-amber-600 to-amber-700 text-white px-6 py-3 flex items-center justify-between text-xs font-semibold shadow z-20">
          <div className="flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            <span>LiveKit is not configured. Running in **Demo Mode**. Add `NEXT_PUBLIC_LIVEKIT_URL`, `LIVEKIT_API_KEY`, and `LIVEKIT_API_SECRET` to `.env` to connect.</span>
          </div>
          <button
            onClick={() => {
              alert("Please add these keys to your .env file:\nLIVEKIT_API_KEY=...\nLIVEKIT_API_SECRET=...\nNEXT_PUBLIC_LIVEKIT_URL=...\nThen restart the server.");
            }}
            className="bg-white/20 hover:bg-white/30 px-3 py-1 rounded transition-colors text-[10px] uppercase font-bold"
          >
            Setup Guide
          </button>
        </div>
      )}

      {/* Top Header */}
      <header className="h-16 border-b border-slate-800/60 bg-slate-900/40 backdrop-blur-md px-6 flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <div className="px-2.5 py-1 bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 rounded-full text-[10px] font-bold tracking-widest flex items-center gap-1.5 uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-ping"></span>
            Demo Mode
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight text-white">{title}</h1>
            <p className="text-[10px] text-slate-400 font-medium">Host: {host}</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {hasConfig && (
            <button
              onClick={onConfigureDemo}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl transition-all duration-200 cursor-pointer"
            >
              Use LiveKit Room
            </button>
          )}
          <div className="px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs font-semibold text-slate-300">
            Time Left: <span className="font-mono text-emerald-400">{timeLeft || "--:--"}</span>
          </div>
          <button
            onClick={() => {
              navigator.clipboard.writeText(window.location.href);
              alert("Meeting link copied to clipboard!");
            }}
            className="px-3 py-1.5 bg-indigo-600/10 hover:bg-indigo-600/20 border border-indigo-500/30 text-indigo-300 hover:text-indigo-200 text-xs font-semibold rounded-xl transition-all duration-200 cursor-pointer flex items-center gap-1.5"
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
            Invite link
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex overflow-hidden relative">
        <div className="flex-1 p-6 flex flex-col items-center justify-center overflow-hidden">
          <div className="w-full max-w-5xl h-full flex flex-col md:flex-row gap-6 items-center justify-center">
            {/* Host Video Placeholder */}
            <div className="flex-1 w-full aspect-video md:h-full bg-slate-900 border border-slate-800 rounded-2xl relative overflow-hidden flex items-center justify-center shadow-lg">
              <div className="absolute inset-0 bg-gradient-to-tr from-slate-950 to-slate-900" />
              <div className="z-10 text-center">
                <div className="relative inline-block">
                  <span className="absolute inset-0 rounded-full bg-indigo-500/20 animate-ping duration-1000"></span>
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-2xl font-bold shadow-lg border-2 border-indigo-400/40">
                    {host.substring(0, 2).toUpperCase()}
                  </div>
                </div>
                <div className="mt-3 text-sm font-semibold text-slate-200">{host}</div>
                <div className="text-[10px] text-indigo-400 font-semibold tracking-wider uppercase mt-0.5">Host</div>
              </div>
              <div className="absolute top-4 left-4 z-10 bg-slate-950/60 backdrop-blur px-2.5 py-1 rounded-lg border border-slate-800/80 text-[10px] font-semibold text-indigo-400 flex items-center gap-1.5">
                <div className="flex items-end gap-0.5 h-2">
                  <span className="w-0.5 bg-indigo-500 animate-[bounce_0.8s_infinite_100ms] h-1.5"></span>
                  <span className="w-0.5 bg-indigo-500 animate-[bounce_0.8s_infinite_200ms] h-2.5"></span>
                  <span className="w-0.5 bg-indigo-500 animate-[bounce_0.8s_infinite_300ms] h-2"></span>
                </div>
                Speaking
              </div>
            </div>

            {/* Local User Video */}
            <div className="flex-1 w-full aspect-video md:h-full bg-slate-900 border border-slate-800 rounded-2xl relative overflow-hidden flex items-center justify-center shadow-lg">
              {cameraOn && !streamError ? (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover transform -scale-x-100"
                />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-tr from-slate-950 to-slate-900 flex items-center justify-center">
                  <div className="text-center">
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-slate-800 to-slate-700 flex items-center justify-center text-slate-300 text-2xl font-bold border-2 border-slate-600/40 mx-auto">
                      ME
                    </div>
                    <div className="mt-3 text-sm font-semibold text-slate-300">You</div>
                    <div className="text-[10px] text-slate-500 font-semibold uppercase mt-0.5">Camera Off</div>
                  </div>
                </div>
              )}
              <div className="absolute top-4 left-4 z-10 bg-slate-950/60 backdrop-blur px-2.5 py-1 rounded-lg border border-slate-800/80 text-[10px] font-semibold text-white">
                You
              </div>
              {!micOn && (
                <div className="absolute top-4 right-4 z-10 bg-red-500/80 backdrop-blur p-1.5 rounded-lg text-white">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <line x1="1" y1="1" x2="23" y2="23" />
                    <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
                    <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
                    <line x1="12" y1="19" x2="12" y2="23" />
                    <line x1="8" y1="23" x2="16" y2="23" />
                  </svg>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        {showChat && (
          <aside className="w-80 border-l border-slate-800 bg-slate-900/60 backdrop-blur flex flex-col animate-in slide-in-from-right duration-300 z-10">
            <div className="h-14 border-b border-slate-800/60 flex items-center px-4">
              <button
                onClick={() => setActiveTab("chat")}
                className={`flex-1 py-2 text-center text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                  activeTab === "chat"
                    ? "bg-slate-850 text-indigo-400 border border-slate-800"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Chat
              </button>
              <button
                onClick={() => setActiveTab("people")}
                className={`flex-1 py-2 text-center text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                  activeTab === "people"
                    ? "bg-slate-850 text-indigo-400 border border-slate-800"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                People (2)
              </button>
            </div>

            {activeTab === "chat" ? (
              <>
                <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex flex-col max-w-[85%] ${msg.isMe ? "self-end items-end" : "self-start items-start"}`}
                    >
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-[10px] font-semibold text-slate-400">{msg.isMe ? "You" : msg.sender}</span>
                        <span className="text-[8px] text-slate-500">{msg.timestamp}</span>
                      </div>
                      <div
                        className={`rounded-2xl px-3.5 py-2 text-xs leading-relaxed ${
                          msg.isMe
                            ? "bg-indigo-600 text-white rounded-tr-none"
                            : "bg-slate-800 text-slate-200 rounded-tl-none border border-slate-750"
                        }`}
                      >
                        {msg.text}
                      </div>
                    </div>
                  ))}
                  <div ref={chatEndRef} />
                </div>
                <form onSubmit={handleSendMessage} className="p-4 border-t border-slate-800 bg-slate-950/20 flex gap-2">
                  <input
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="Type a message..."
                    className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                  <button
                    type="submit"
                    className="w-8 h-8 rounded-xl bg-indigo-600 hover:bg-indigo-700 flex items-center justify-center text-white transition-colors cursor-pointer"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <line x1="22" y1="2" x2="11" y2="13" />
                      <polygon points="22 2 15 22 11 13 2 9 22 2" />
                    </svg>
                  </button>
                </form>
              </>
            ) : (
              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between p-2 rounded-xl bg-slate-800/40 border border-slate-800">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-xs font-bold text-indigo-400">
                      {host.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-white">{host}</div>
                      <div className="text-[9px] text-slate-500 font-medium">Host</div>
                    </div>
                  </div>
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-xl bg-slate-800/40 border border-slate-800">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-slate-700/40 border border-slate-750 flex items-center justify-center text-xs font-bold text-slate-300">
                      ME
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-white">You</div>
                      <div className="text-[9px] text-slate-500 font-medium">Participant</div>
                    </div>
                  </div>
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                </div>
              </div>
            )}
          </aside>
        )}
      </main>

      {/* footer controls */}
      <footer className="h-20 bg-slate-950/80 border-t border-slate-850 flex items-center justify-center gap-4 relative z-10 px-6">
        <div className="absolute left-6 text-[10px] font-semibold text-slate-500 tracking-wider hidden sm:block">
          MEETING ID: <span className="font-mono">{meetingId}</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMicOn(!micOn)}
            className={`w-11 h-11 rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer shadow border ${
              micOn
                ? "bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-white"
                : "bg-red-500/10 border-red-500/20 text-red-500 hover:bg-red-500 hover:text-white"
            }`}
            title={micOn ? "Mute Microphone" : "Unmute Microphone"}
          >
            {micOn ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="1" y1="1" x2="23" y2="23" />
                <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
                <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
            )}
          </button>

          <button
            onClick={() => setCameraOn(!cameraOn)}
            className={`w-11 h-11 rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer shadow border ${
              cameraOn
                ? "bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-white"
                : "bg-red-500/10 border-red-500/20 text-red-500 hover:bg-red-500 hover:text-white"
            }`}
            title={cameraOn ? "Turn Camera Off" : "Turn Camera On"}
          >
            {cameraOn ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M23 7l-7 5 7 5V7z" />
                <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m5.66 0H14a2 2 0 0 1 2 2v3.34l1 1L23 7v10" />
                <line x1="1" y1="1" x2="23" y2="23" />
              </svg>
            )}
          </button>

          <button
            onClick={() => setSharingScreen(!sharingScreen)}
            className={`w-11 h-11 rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer shadow border ${
              sharingScreen
                ? "bg-indigo-600 border-indigo-500 text-white"
                : "bg-slate-900 border-slate-855 text-slate-300 hover:bg-slate-800 hover:text-white"
            }`}
            title={sharingScreen ? "Stop Sharing Screen" : "Share Screen"}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
          </button>
        </div>

        <a
          href="/home"
          className="px-5 h-11 rounded-full bg-red-600 hover:bg-red-755 text-white text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-red-500/10 hover:shadow-xl transition-all duration-200"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 2.59 3.4z" />
          </svg>
          Leave Call
        </a>

        <button
          onClick={() => setShowChat(!showChat)}
          className={`absolute right-6 w-11 h-11 rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer shadow border ${
            showChat
              ? "bg-indigo-600/10 border-indigo-500/30 text-indigo-400 hover:bg-indigo-600/20"
              : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200"
          }`}
          title="Toggle Chat Sidebar"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </button>
      </footer>
    </div>
  );
}
