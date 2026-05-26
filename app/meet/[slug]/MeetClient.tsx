"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { isParticipantInRoom } from "@/app/actions/livekit";
import {
  CarouselLayout,
  ChatToggle,
  ConnectionStateToast,
  DisconnectButton,
  FocusLayout,
  FocusLayoutContainer,
  GearIcon,
  GridLayout,
  isTrackReference,
  LayoutContextProvider,
  LeaveIcon as LiveKitLeaveIcon,
  LiveKitRoom,
  MediaDeviceSelect,
  ParticipantTile,
  RoomAudioRenderer,
  StartMediaButton,
  TrackToggle,
  useCreateLayoutContext,
  usePinnedTracks,
  useTracks,
} from "@livekit/components-react";
import {
  isEqualTrackRef,
  isWeb,
  type TrackReferenceOrPlaceholder,
  type WidgetState,
} from "@livekit/components-core";
import { RoomEvent, Track } from "livekit-client";
import "@livekit/components-styles";

interface Props {
  meetingId: number;
  slug: string | null;
  title: string;
  host: string;
  hostEmail: string;
  viewerIsHost: boolean;
  roomName: string;
  startTime: string;
  endTime: string;
  livekitToken: string | null;
  livekitUrl: string | null;
  password: string | null;
}

interface ChatMessage {
  id: string;
  sender: string;
  text: string;
  timestamp: string;
  isMe: boolean;
}

interface ReactionBubble {
  id: string;
  emoji: string;
  x: number;
}

const REACTION_EMOJIS = ["👍", "❤️", "😂", "🎉", "😮", "👏"];

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDuration(totalMilliseconds: number) {
  const totalSeconds = Math.max(0, Math.floor(totalMilliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds
      .toString()
      .padStart(2, "0")}`;
  }

  return `${minutes.toString().padStart(2, "0")}:${seconds
    .toString()
    .padStart(2, "0")}`;
}

function buildShareText(
  title: string,
  startTime: string,
  endTime: string,
  password: string | null,
) {
  return [
    "Join this meeting",
    `Title: ${title}`,
    `Time: ${formatTime(startTime)} - ${formatTime(endTime)}`,
    `Link: ${window.location.href}`,
    password ? `Password: ${password}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

async function copyText(text: string, successMessage: string) {
  await navigator.clipboard.writeText(text);
  window.alert(successMessage);
}

function MeetingHeader({
  title,
  host,
  meetingLabel,
  timeLeft,
  badge,
  onCopyLink,
  onShare,
}: {
  title: string;
  host: string;
  meetingLabel: string;
  timeLeft: string;
  badge?: string;
  onCopyLink: () => void;
  onShare: () => void;
}) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-40 px-3 pt-3 sm:px-4 sm:pt-4">
      <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-3">
        <div className="pointer-events-auto meet-topbar min-w-0">
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-white">
              {title}
            </div>
            <div className="truncate text-[11px] text-white/56">
              Host: {host} <span className="mx-1 text-white/28">•</span>{" "}
              {meetingLabel}
            </div>
          </div>
        </div>

        <div className="pointer-events-auto flex items-center gap-2">
          <div className="meet-compact-info hidden sm:flex">
            <span className="text-white/42">{badge || "Elapsed"}</span>
            <span className="font-medium text-white">
              {timeLeft || "--:--"}
            </span>
          </div>
          <button
            onClick={onCopyLink}
            className="meet-chip"
            type="button"
            title="Copy invite link"
          >
            <LinkIcon />
          </button>
          <button
            onClick={onShare}
            className="meet-chip"
            type="button"
            title="Share meeting details"
          >
            <ShareIcon />
          </button>
        </div>
      </div>
    </div>
  );
}

function PreMeetingGate({
  title,
  countdown,
  viewerIsHost,
  hostWaiting,
  earlyJoinAvailable,
  isCheckingEarlyJoin,
  onStartEarly,
  onWait,
}: {
  title: string;
  countdown: string;
  viewerIsHost: boolean;
  hostWaiting?: boolean;
  earlyJoinAvailable: boolean;
  isCheckingEarlyJoin: boolean;
  onStartEarly?: () => void;
  onWait?: () => void;
}) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#202124] px-4 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(138,180,248,0.14),_transparent_30%),linear-gradient(180deg,_#202124,_#1f1f1f)]" />
      <div className="meet-panel relative justify-center items-center z-10 w-full max-w-xl flex flex-col p-8">
        <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#8ab4f8]/15 text-[#8ab4f8]">
          <ClockIcon />
        </div>
        <div className="text-xs font-medium uppercase tracking-[0.18em] text-white/45">
          {viewerIsHost ? "Host controls" : "Waiting room"}
        </div>
        <h1 className="mt-3 text-2xl  text-center font-medium text-white">
          {title}
        </h1>
        {viewerIsHost ? (
          <p className="mt-2 text-sm leading-6 text-white/62 text-center">
            {hostWaiting
              ? "You chose to wait. You can still start the meeting any time before the scheduled start."
              : "You joined before the scheduled start time. Do you want to start this meeting early?"}
          </p>
        ) : earlyJoinAvailable ? (
          <p className="mt-2 text-sm leading-6 text-[#8ab4f8]">
            The host has already joined. You can enter now.
          </p>
        ) : (
          <p className="mt-2 text-sm leading-6 text-white/62">
            This meeting starts at the scheduled time. You can join when the
            countdown reaches zero.
          </p>
        )}

        <div className="mt-6 rounded-3xl border border-white/8 bg-white/5 p-6">
          <div className="text-xs uppercase tracking-[0.18em] text-white/40">
            Starts in
          </div>
          <div className="mt-2 text-4xl font-semibold text-white sm:text-5xl">
            {countdown}
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          {viewerIsHost ? (
            <>
              <button
                type="button"
                onClick={onStartEarly}
                className="rounded-full bg-[#8ab4f8] px-5 py-3 text-sm font-medium text-[#202124] transition hover:bg-[#9ec1fb]"
              >
                Start meeting now
              </button>
              <button
                type="button"
                onClick={onWait}
                className="rounded-full border border-white/12 bg-white/6 px-5 py-3 text-sm font-medium text-white transition hover:bg-white/10"
              >
                {hostWaiting ? "Keep waiting" : "Wait for scheduled time"}
              </button>
            </>
          ) : (
            <></>
            // <div className="rounded-full border border-white/10 bg-white/6 px-5 py-3 text-sm text-white/72">
            //   {isCheckingEarlyJoin
            //     ? "Checking whether the host has started early..."
            //     : "Countdown updates automatically."}
            // </div>
          )}
        </div>
      </div>
    </div>
  );
}

function JoinGate({
  enteredPassword,
  setEnteredPassword,
  passwordError,
  onSubmit,
}: {
  enteredPassword: string;
  setEnteredPassword: (value: string) => void;
  passwordError: string;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#202124] px-4 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.04),_transparent_32%),linear-gradient(180deg,_#202124,_#1f1f1f)]" />
      <div className="meet-panel relative z-10 w-full flex flex-col max-w-xl p-8">
        <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/8 text-white">
          <LockIcon />
        </div>
        <h1 className="text-2xl font-medium text-white">Meeting locked</h1>
        <p className="mt-2 text-sm leading-6 text-white/62">
          Enter the password to join this room.
        </p>
        <form onSubmit={onSubmit} className="mt-7 flex flex-col gap-4">
          <input
            type="password"
            placeholder="Enter password"
            value={enteredPassword}
            onChange={(event) => setEnteredPassword(event.target.value)}
            className="rounded-2xl border border-white/10 bg-white/6 px-4 py-3 text-sm text-white outline-none transition focus:border-white/24"
            autoFocus
          />
          {passwordError ? (
            <p className="text-xs font-medium text-[#f28b82]">
              {passwordError}
            </p>
          ) : null}
          <button
            type="submit"
            className="rounded-full bg-[#8ab4f8] px-4 py-3 text-sm font-medium text-[#202124] transition hover:bg-[#9ec1fb]"
          >
            Join meeting
          </button>
        </form>
      </div>
    </div>
  );
}

function ReactionOverlay({ reactions }: { reactions: ReactionBubble[] }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-30 overflow-hidden">
      {reactions.map((reaction) => (
        <div
          key={reaction.id}
          className="absolute bottom-28 text-4xl animate-float-up sm:bottom-36"
          style={{ left: `${reaction.x}%` }}
        >
          {reaction.emoji}
        </div>
      ))}
    </div>
  );
}

function ReactionPicker({
  open,
  setOpen,
  onSelect,
}: {
  open: boolean;
  setOpen: (value: boolean) => void;
  onSelect: (emoji: string) => void;
}) {
  return (
    <div className="pointer-events-auto relative">
      <button
        type="button"
        className={`meet-control-fab ${open ? "meet-control-fab--accent" : "meet-control-fab--on"}`}
        onClick={() => setOpen(!open)}
        title="Reactions"
      >
        <ReactionIcon />
      </button>
      {open ? (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="meet-popover absolute bottom-14 right-0 z-50 flex gap-2 p-2">
            {REACTION_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white/8 text-xl transition hover:-translate-y-0.5 hover:bg-white/14"
                onClick={() => {
                  onSelect(emoji);
                  setOpen(false);
                }}
              >
                {emoji}
              </button>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

function LiveRoomSettings() {
  return (
    <div className="meet-settings-panel">
      <div className="meet-settings-panel__header">
        <div>
          <h2 className="text-base font-medium text-white">Settings</h2>
          <p className="mt-1 text-sm text-white/56">
            Select microphone and camera sources.
          </p>
        </div>
      </div>

      <div className="meet-settings-panel__section">
        <div className="meet-settings-panel__label">Microphone</div>
        <MediaDeviceSelect
          kind="audioinput"
          requestPermissions
          className="lk-media-device-select meet-settings-list"
        />
      </div>

      <div className="meet-settings-panel__section">
        <div className="meet-settings-panel__label">Camera</div>
        <MediaDeviceSelect
          kind="videoinput"
          requestPermissions
          className="lk-media-device-select meet-settings-list"
        />
      </div>
    </div>
  );
}

function MinimalVideoConference({
  SettingsComponent,
  showReactions,
  setShowReactions,
  addReaction,
}: {
  SettingsComponent?: React.ComponentType;
  showReactions: boolean;
  setShowReactions: (value: boolean) => void;
  addReaction: (emoji: string) => void;
}) {
  const [widgetState, setWidgetState] = useState<WidgetState>({
    showChat: false,
    unreadMessages: 0,
    showSettings: false,
  });
  const lastAutoFocusedScreenShareTrack =
    useRef<TrackReferenceOrPlaceholder | null>(null);
  const layoutContext = useCreateLayoutContext();

  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { updateOnlyOn: [RoomEvent.ActiveSpeakersChanged], onlySubscribed: false },
  );

  const screenShareTracks = tracks
    .filter(isTrackReference)
    .filter((track) => track.publication.source === Track.Source.ScreenShare);

  const focusTrack = usePinnedTracks(layoutContext)?.[0];
  const carouselTracks = tracks.filter(
    (track) => !isEqualTrackRef(track, focusTrack),
  );

  useEffect(() => {
    if (
      screenShareTracks.some((track) => track.publication.isSubscribed) &&
      lastAutoFocusedScreenShareTrack.current === null
    ) {
      layoutContext.pin.dispatch?.({
        msg: "set_pin",
        trackReference: screenShareTracks[0],
      });
      lastAutoFocusedScreenShareTrack.current = screenShareTracks[0];
    } else if (
      lastAutoFocusedScreenShareTrack.current &&
      !screenShareTracks.some(
        (track) =>
          track.publication.trackSid ===
          lastAutoFocusedScreenShareTrack.current?.publication?.trackSid,
      )
    ) {
      layoutContext.pin.dispatch?.({ msg: "clear_pin" });
      lastAutoFocusedScreenShareTrack.current = null;
    }

    if (focusTrack && !isTrackReference(focusTrack)) {
      const updatedFocusTrack = tracks.find(
        (track) =>
          track.participant.identity === focusTrack.participant.identity &&
          track.source === focusTrack.source,
      );
      if (
        updatedFocusTrack !== focusTrack &&
        isTrackReference(updatedFocusTrack)
      ) {
        layoutContext.pin.dispatch?.({
          msg: "set_pin",
          trackReference: updatedFocusTrack,
        });
      }
    }
  }, [focusTrack, layoutContext.pin, screenShareTracks, tracks]);

  return (
    <div className="lk-video-conference">
      {isWeb() ? (
        <LayoutContextProvider
          value={layoutContext}
          onWidgetChange={(state) => setWidgetState(state)}
        >
          <div className="lk-video-conference-inner">
            {!focusTrack ? (
              <div className="lk-grid-layout-wrapper">
                <GridLayout tracks={tracks}>
                  <ParticipantTile />
                </GridLayout>
              </div>
            ) : (
              <div className="lk-focus-layout-wrapper">
                <FocusLayoutContainer>
                  <CarouselLayout tracks={carouselTracks}>
                    <ParticipantTile />
                  </CarouselLayout>
                  <FocusLayout trackRef={focusTrack} />
                </FocusLayoutContainer>
              </div>
            )}
            <div className="meet-live-dock-wrap">
              <div className="meet-dock meet-live-dock">
                <TrackToggle
                  source={Track.Source.Microphone}
                  showIcon
                  title="Toggle mic"
                />
                <TrackToggle
                  source={Track.Source.Camera}
                  showIcon
                  title="Toggle camera"
                />
                <TrackToggle
                  source={Track.Source.ScreenShare}
                  showIcon
                  title="Toggle screen share"
                  captureOptions={{
                    audio: true,
                    selfBrowserSurface: "include",
                  }}
                />
                <ChatToggle title="Toggle chat">
                  <ChatIcon />
                </ChatToggle>
                <ReactionPicker
                  open={showReactions}
                  setOpen={setShowReactions}
                  onSelect={addReaction}
                />
                {SettingsComponent ? (
                  <button
                    type="button"
                    className="lk-button"
                    title="Settings"
                    aria-pressed={widgetState.showSettings ? "true" : "false"}
                    onClick={() =>
                      layoutContext.widget.dispatch?.({
                        msg: "toggle_settings",
                      })
                    }
                  >
                    <GearIcon />
                  </button>
                ) : null}
                <DisconnectButton title="Leave">
                  <LiveKitLeaveIcon />
                </DisconnectButton>
                <StartMediaButton />
              </div>
            </div>
          </div>
          {SettingsComponent ? (
            <div
              className="lk-settings-menu-modal"
              style={{ display: widgetState.showSettings ? "block" : "none" }}
            >
              <SettingsComponent />
            </div>
          ) : null}
        </LayoutContextProvider>
      ) : null}
      <RoomAudioRenderer />
      <ConnectionStateToast />
    </div>
  );
}

function ControlFab({
  active,
  accent,
  title,
  onClick,
  children,
}: {
  active: boolean;
  accent?: boolean;
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`meet-control-fab ${
        accent
          ? "meet-control-fab--accent"
          : active
            ? "meet-control-fab--on"
            : "meet-control-fab--off"
      }`}
    >
      {children}
    </button>
  );
}

function ParticipantCard({
  name,
  subtitle,
  accent,
}: {
  name: string;
  subtitle: string;
  accent?: boolean;
}) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-white/8 bg-white/5 px-4 py-3">
      <div className="flex items-center gap-3">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-medium ${
            accent ? "bg-[#8ab4f8] text-[#202124]" : "bg-[#3c4043] text-white"
          }`}
        >
          {name.slice(0, 2).toUpperCase()}
        </div>
        <div>
          <div className="text-sm font-medium text-white">{name}</div>
          <div className="text-xs text-white/48">{subtitle}</div>
        </div>
      </div>
      <span className="h-2.5 w-2.5 rounded-full bg-[#34a853]" />
    </div>
  );
}

export default function MeetClient({
  meetingId,
  slug,
  title,
  host,
  hostEmail,
  viewerIsHost,
  roomName,
  startTime,
  endTime,
  livekitToken,
  livekitUrl,
  password,
}: Props) {
  const router = useRouter();
  const [useDemoMode, setUseDemoMode] = useState(false);
  const [reactions, setReactions] = useState<ReactionBubble[]>([]);
  const [showReactions, setShowReactions] = useState(false);
  const [enteredPassword, setEnteredPassword] = useState("");
  const [isUnlocked, setIsUnlocked] = useState(!password);
  const [passwordError, setPasswordError] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const [hostEarlyStartConfirmed, setHostEarlyStartConfirmed] = useState(false);
  const [hostWaitingForScheduledTime, setHostWaitingForScheduledTime] =
    useState(false);
  const [attendeeMayJoinEarly, setAttendeeMayJoinEarly] = useState(false);
  const [isCheckingEarlyJoin, setIsCheckingEarlyJoin] = useState(false);

  const hasLiveKitConfig = Boolean(livekitToken && livekitUrl);
  const meetingLabel = `Meeting ID: ${slug || meetingId}`;
  const startTimestamp = new Date(startTime).getTime();
  const isBeforeStart = now < startTimestamp;
  const countdown = formatDuration(Math.max(0, startTimestamp - now));
  const elapsedTime = formatDuration(Math.max(0, now - startTimestamp));

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (
      viewerIsHost ||
      !isUnlocked ||
      !isBeforeStart ||
      attendeeMayJoinEarly ||
      !hasLiveKitConfig
    ) {
      return;
    }

    let isActive = true;

    const checkForHost = async () => {
      setIsCheckingEarlyJoin(true);
      const hostHasJoined = await isParticipantInRoom(roomName, hostEmail);
      if (isActive && hostHasJoined) {
        setAttendeeMayJoinEarly(true);
      }
      if (isActive) {
        setIsCheckingEarlyJoin(false);
      }
    };

    void checkForHost();
    const interval = window.setInterval(() => {
      void checkForHost();
    }, 10000);

    return () => {
      isActive = false;
      window.clearInterval(interval);
    };
  }, [
    attendeeMayJoinEarly,
    hasLiveKitConfig,
    hostEmail,
    isBeforeStart,
    isUnlocked,
    roomName,
    viewerIsHost,
  ]);

  const addReaction = (emoji: string) => {
    const id = Math.random().toString(36).slice(2);
    const x = Math.random() * 60 + 20;
    setReactions((current) => [...current, { id, emoji, x }]);
    window.setTimeout(() => {
      setReactions((current) =>
        current.filter((reaction) => reaction.id !== id),
      );
    }, 2200);
  };

  const handleCopyLink = async () => {
    await copyText(window.location.href, "Meeting link copied to clipboard.");
  };

  const handleShare = async () => {
    await copyText(
      buildShareText(title, startTime, endTime, password),
      "Meeting details copied to clipboard.",
    );
  };

  if (!isUnlocked && password) {
    return (
      <JoinGate
        enteredPassword={enteredPassword}
        setEnteredPassword={(value) => {
          setEnteredPassword(value);
          setPasswordError("");
        }}
        passwordError={passwordError}
        onSubmit={(event) => {
          event.preventDefault();
          if (enteredPassword === password) {
            setIsUnlocked(true);
            setPasswordError("");
            return;
          }
          setPasswordError("Incorrect password. Please try again.");
        }}
      />
    );
  }

  if (isBeforeStart && viewerIsHost && !hostEarlyStartConfirmed) {
    return (
      <PreMeetingGate
        title={title}
        countdown={countdown}
        viewerIsHost
        hostWaiting={hostWaitingForScheduledTime}
        earlyJoinAvailable={false}
        isCheckingEarlyJoin={false}
        onStartEarly={() => setHostEarlyStartConfirmed(true)}
        onWait={() => setHostWaitingForScheduledTime(true)}
      />
    );
  }

  if (isBeforeStart && !viewerIsHost && !attendeeMayJoinEarly) {
    return (
      <PreMeetingGate
        title={title}
        countdown={countdown}
        viewerIsHost={false}
        earlyJoinAvailable={false}
        isCheckingEarlyJoin={isCheckingEarlyJoin}
      />
    );
  }

  if (hasLiveKitConfig && !useDemoMode) {
    return (
      <div className="meet-shell">
        <div className="meet-bg" />
        <MeetingHeader
          title={title}
          host={host}
          meetingLabel={meetingLabel}
          timeLeft={elapsedTime}
          badge="Live room"
          onCopyLink={handleCopyLink}
          onShare={handleShare}
        />
        <div className="relative z-10 h-screen overflow-hidden px-2 pb-2 pt-16 sm:px-3 sm:pb-3 sm:pt-[4.25rem]">
          <div className="meet-stage meet-stage--live">
            <LiveKitRoom
              video
              audio
              token={livekitToken || undefined}
              serverUrl={livekitUrl || undefined}
              onDisconnected={() => router.push("/home")}
              data-lk-theme="meet"
              className="h-full w-full"
            >
              <MinimalVideoConference
                SettingsComponent={LiveRoomSettings}
                showReactions={showReactions}
                setShowReactions={setShowReactions}
                addReaction={addReaction}
              />
            </LiveKitRoom>
          </div>
        </div>
        <ReactionOverlay reactions={reactions} />
      </div>
    );
  }

  return (
    <DemoMeetingPortal
      slug={slug}
      title={title}
      host={host}
      startTime={startTime}
      endTime={endTime}
      hasConfig={hasLiveKitConfig}
      onConfigureDemo={() => setUseDemoMode(false)}
      reactions={reactions}
      addReaction={addReaction}
      showReactions={showReactions}
      setShowReactions={setShowReactions}
      meetingLabel={meetingLabel}
      timeLeft={elapsedTime}
      onCopyLink={handleCopyLink}
      onShare={handleShare}
    />
  );
}

function DemoMeetingPortal({
  slug,
  title,
  host,
  startTime,
  endTime,
  hasConfig,
  onConfigureDemo,
  reactions,
  addReaction,
  showReactions,
  setShowReactions,
  meetingLabel,
  timeLeft,
  onCopyLink,
  onShare,
}: {
  slug: string | null;
  title: string;
  host: string;
  startTime: string;
  endTime: string;
  hasConfig: boolean;
  onConfigureDemo: () => void;
  reactions: ReactionBubble[];
  addReaction: (emoji: string) => void;
  showReactions: boolean;
  setShowReactions: (show: boolean) => void;
  meetingLabel: string;
  timeLeft: string;
  onCopyLink: () => void;
  onShare: () => void;
}) {
  const [micOn, setMicOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(true);
  const [sharingScreen, setSharingScreen] = useState(false);
  const [showChat, setShowChat] = useState(true);
  const [activeTab, setActiveTab] = useState<"chat" | "people">("chat");
  const [streamError, setStreamError] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "seed-1",
      sender: host,
      text: "Welcome in. We can use this space to align before the room goes live.",
      timestamp: formatTime(startTime),
      isMe: false,
    },
    {
      id: "seed-2",
      sender: host,
      text: "Controls stay docked at the bottom and chat floats on the side.",
      timestamp: formatTime(startTime),
      isMe: false,
    },
  ]);
  const [inputText, setInputText] = useState("");

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

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
      } catch {
        setStreamError("Camera unavailable or permission denied.");
      }
    }

    startCamera();
    return () => stopCamera();
  }, [cameraOn, micOn]);

  useEffect(() => {
    if (!streamRef.current) {
      return;
    }
    streamRef.current.getAudioTracks().forEach((track) => {
      track.enabled = micOn;
    });
  }, [micOn]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, showChat, activeTab]);

  const handleSendMessage = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!inputText.trim()) {
      return;
    }
    setMessages((current) => [
      ...current,
      {
        id: Math.random().toString(36).slice(2),
        sender: "You",
        text: inputText.trim(),
        timestamp: formatTime(new Date().toISOString()),
        isMe: true,
      },
    ]);
    setInputText("");

    window.setTimeout(() => {
      setMessages((current) => [
        ...current,
        {
          id: Math.random().toString(36).slice(2),
          sender: host,
          text: "Looks good from my side. Keep going.",
          timestamp: formatTime(new Date().toISOString()),
          isMe: false,
        },
      ]);
      addReaction("👏");
    }, 1200);
  };

  return (
    <div className="meet-shell">
      <div className="meet-bg" />
      {!hasConfig ? (
        <div className="pointer-events-none absolute inset-x-0 top-0 z-50 px-3 pt-14 sm:px-4 sm:pt-16">
          <div className="pointer-events-auto mx-auto max-w-[1600px] rounded-2xl border border-[#fbbc04]/20 bg-[#fbbc04]/10 px-4 py-3 text-xs text-[#fde293]">
            LiveKit is not configured. This view is running in demo mode until
            `NEXT_PUBLIC_LIVEKIT_URL`, `LIVEKIT_API_KEY`, and
            `LIVEKIT_API_SECRET` are added.
          </div>
        </div>
      ) : null}
      <MeetingHeader
        title={title}
        host={host}
        meetingLabel={meetingLabel}
        timeLeft={timeLeft}
        badge="Demo room"
        onCopyLink={onCopyLink}
        onShare={onShare}
      />
      <ReactionOverlay reactions={reactions} />

      <div className="relative z-10 h-screen overflow-hidden px-2 pb-24 pt-16 sm:px-3 sm:pb-28 sm:pt-[4.25rem]">
        <div className="meet-stage relative h-full">
          <div className="flex h-full min-h-0 flex-col lg:flex-row">
            <div className="relative min-h-0 flex-1 p-3 sm:p-4">
              <div className="absolute left-5 top-5 z-20 hidden w-[170px] flex-col gap-2 sm:flex">
                <button
                  type="button"
                  onClick={() => setMicOn((value) => !value)}
                  className={`meet-side-card ${micOn ? "" : "meet-side-card--danger"}`}
                >
                  <span className="meet-side-card__icon">
                    {micOn ? <MicIcon /> : <MicOffIcon />}
                  </span>
                  <span>
                    <span className="meet-side-card__title">Microphone</span>
                    <span className="meet-side-card__meta">
                      {micOn ? "On" : "Off"}
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setCameraOn((value) => !value)}
                  className={`meet-side-card ${cameraOn ? "" : "meet-side-card--danger"}`}
                >
                  <span className="meet-side-card__icon">
                    {cameraOn ? <CameraIcon /> : <CameraOffIcon />}
                  </span>
                  <span>
                    <span className="meet-side-card__title">Camera</span>
                    <span className="meet-side-card__meta">
                      {cameraOn ? "On" : "Off"}
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setSharingScreen((value) => !value)}
                  className={`meet-side-card ${sharingScreen ? "meet-side-card--accent" : ""}`}
                >
                  <span className="meet-side-card__icon">
                    <ScreenShareIcon />
                  </span>
                  <span>
                    <span className="meet-side-card__title">Present now</span>
                    <span className="meet-side-card__meta">
                      {sharingScreen ? "Sharing" : "Share screen"}
                    </span>
                  </span>
                </button>
              </div>

              <div className="meet-video-tile meet-video-tile--host h-full min-h-[360px]">
                <div className="meet-video-tile__scrim" />
                <div className="meet-speaking-pill">
                  <span className="meet-speaking-pill__dot" />
                  Speaking
                </div>
                <div className="relative z-10 flex h-full items-center justify-center">
                  <div className="text-center">
                    <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-[#3c4043] text-3xl font-medium text-white">
                      {host.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="mt-4 text-lg font-medium text-white">
                      {host}
                    </div>
                    <div className="mt-1 text-xs text-white/60">Host</div>
                  </div>
                </div>
                <div className="meet-video-badge">{host}</div>
                {sharingScreen ? (
                  <div className="absolute inset-x-5 bottom-5 z-10 rounded-2xl border border-white/10 bg-[#202124]/92 px-4 py-3 text-sm text-white/78">
                    Screen share is active. Shared content would take focus here
                    in the live room.
                  </div>
                ) : null}
              </div>

              <div className="absolute bottom-5 right-5 z-20 w-[160px] sm:w-[220px]">
                <div className="meet-video-tile aspect-video">
                  {cameraOn && !streamError ? (
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="h-full w-full object-cover [transform:scaleX(-1)]"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center bg-[#2b2c2e]">
                      <div className="text-center">
                        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#3c4043] text-xl font-medium text-white">
                          ME
                        </div>
                        <div className="mt-3 text-sm font-medium text-white">
                          You
                        </div>
                        <div className="mt-1 text-[11px] text-white/52">
                          {streamError || "Camera off"}
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="meet-video-badge">You</div>
                  {!micOn ? (
                    <div className="absolute right-3 top-3 rounded-full bg-[#ea4335] p-2 text-white">
                      <MicOffIcon />
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            <aside
              className={`meet-chat-panel ${
                showChat
                  ? "translate-y-0 opacity-100"
                  : "pointer-events-none translate-y-4 opacity-0 lg:translate-x-6 lg:translate-y-0"
              }`}
            >
              <div className="flex items-center justify-between gap-3 border-b border-white/8 px-4 py-4">
                <div>
                  <div className="text-sm font-medium text-white">
                    In-call messages
                  </div>
                  <div className="text-xs text-white/48">Chat and people</div>
                </div>
                <button
                  type="button"
                  className="rounded-full bg-white/8 p-2 text-white/70 transition hover:bg-white/12 hover:text-white lg:hidden"
                  onClick={() => setShowChat(false)}
                >
                  <CloseIcon />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 px-4 pt-4">
                <button
                  type="button"
                  onClick={() => setActiveTab("chat")}
                  className={`meet-tab ${activeTab === "chat" ? "meet-tab--active" : ""}`}
                >
                  Chat
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("people")}
                  className={`meet-tab ${activeTab === "people" ? "meet-tab--active" : ""}`}
                >
                  People
                </button>
              </div>

              {activeTab === "chat" ? (
                <>
                  <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
                    <div className="flex flex-col gap-4">
                      {messages.map((message) => (
                        <div
                          key={message.id}
                          className={`flex flex-col ${message.isMe ? "items-end" : "items-start"}`}
                        >
                          <div className="mb-1 flex items-center gap-2 text-[11px] text-white/42">
                            <span>{message.isMe ? "You" : message.sender}</span>
                            <span>{message.timestamp}</span>
                          </div>
                          <div
                            className={`max-w-[88%] rounded-3xl px-4 py-3 text-sm leading-6 ${
                              message.isMe
                                ? "bg-[#8ab4f8] text-[#202124]"
                                : "bg-white/8 text-white/82"
                            }`}
                          >
                            {message.text}
                          </div>
                        </div>
                      ))}
                      <div ref={chatEndRef} />
                    </div>
                  </div>
                  <form
                    onSubmit={handleSendMessage}
                    className="border-t border-white/8 px-4 py-4"
                  >
                    <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/6 px-3 py-2">
                      <input
                        type="text"
                        value={inputText}
                        onChange={(event) => setInputText(event.target.value)}
                        placeholder="Send a message to everyone"
                        className="min-w-0 flex-1 bg-transparent px-1 text-sm text-white outline-none placeholder:text-white/34"
                      />
                      <button
                        type="submit"
                        className="flex h-10 w-10 items-center justify-center rounded-full bg-[#8ab4f8] text-[#202124] transition hover:bg-[#9ec1fb]"
                      >
                        <SendIcon />
                      </button>
                    </div>
                  </form>
                </>
              ) : (
                <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-4">
                  <ParticipantCard name={host} subtitle="Host" accent />
                  <ParticipantCard
                    name="You"
                    subtitle={slug ? `Joined via ${slug}` : "Participant"}
                  />
                </div>
              )}
            </aside>
          </div>
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-40 px-4 pb-5 sm:px-6 sm:pb-6">
        <div className="mx-auto flex max-w-[1500px] items-end justify-between gap-3">
          <div className="pointer-events-auto hidden rounded-full border border-white/8 bg-[#202124]/90 px-4 py-2.5 text-xs text-white/50 lg:block">
            {meetingLabel}
          </div>

          <div className="meet-dock pointer-events-auto mx-auto">
            <ControlFab
              active={micOn}
              onClick={() => setMicOn((value) => !value)}
              title="Toggle mic"
            >
              {micOn ? <MicIcon /> : <MicOffIcon />}
            </ControlFab>
            <ControlFab
              active={cameraOn}
              onClick={() => setCameraOn((value) => !value)}
              title="Toggle camera"
            >
              {cameraOn ? <CameraIcon /> : <CameraOffIcon />}
            </ControlFab>
            <ControlFab
              active={sharingScreen}
              accent={sharingScreen}
              onClick={() => setSharingScreen((value) => !value)}
              title="Toggle screen share"
            >
              <ScreenShareIcon />
            </ControlFab>
            <ControlFab
              active={showChat}
              onClick={() => setShowChat((value) => !value)}
              title="Toggle chat"
            >
              <ChatIcon />
            </ControlFab>
            <ReactionPicker
              open={showReactions}
              setOpen={setShowReactions}
              onSelect={addReaction}
            />
            <a
              href="/home"
              title="Leave"
              aria-label="Leave"
              className="ml-1 flex h-12 w-12 items-center justify-center rounded-full bg-[#ea4335] text-sm font-medium text-white transition hover:bg-[#f15d52]"
            >
              <LeaveIcon />
            </a>
          </div>

          <div className="pointer-events-auto hidden items-center gap-2 xl:flex">
            {hasConfig ? (
              <button
                type="button"
                className="meet-chip"
                onClick={onConfigureDemo}
              >
                <SparkIcon />
              </button>
            ) : null}
            <div className="rounded-full border border-white/8 bg-[#202124]/90 px-4 py-2.5 text-xs text-white/50">
              {formatTime(startTime)} - {formatTime(endTime)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ClockIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 3" />
    </svg>
  );
}

function MicIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <path d="M12 19v3" />
      <path d="M8 22h8" />
    </svg>
  );
}

function MicOffIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="m2 2 20 20" />
      <path d="M9 9v3a3 3 0 0 0 5.17 2.08" />
      <path d="M15 6.34V5a3 3 0 0 0-5.74-1.28" />
      <path d="M17 10v2a7 7 0 0 1-.84 3.34" />
      <path d="M7.88 7.88A6.97 6.97 0 0 0 5 12v0a7 7 0 0 0 12.95 3.67" />
      <path d="M12 19v3" />
      <path d="M8 22h8" />
    </svg>
  );
}

function CameraIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="m16 7 5-3v16l-5-3" />
      <rect x="3" y="6" width="13" height="12" rx="2" />
    </svg>
  );
}

function CameraOffIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="m2 2 20 20" />
      <path d="M10.66 6H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h11a2 2 0 0 0 1.64-.86" />
      <path d="m16 7 5-3v11" />
    </svg>
  );
}

function ScreenShareIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20h8" />
      <path d="M12 16v4" />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M22 2 11 13" />
      <path d="m22 2-7 20-4-9-9-4Z" />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="m8.59 13.51 6.83 3.98" />
      <path d="m15.41 6.51-6.82 3.98" />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function ReactionIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M8 14s1.5 2 4 2 4-2 4-2" />
      <path d="M9 9h.01" />
      <path d="M15 9h.01" />
    </svg>
  );
}

function LeaveIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.86 19.86 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.86 19.86 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92Z" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="m18 6-12 12" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

function SparkIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="m12 3 1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3Z" />
    </svg>
  );
}
