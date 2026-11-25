"use client";

import { forwardRef, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { AudioBridge, CviCall, type TavusEvent } from "@/lib/cvi-client";
import { TOOL_NAMES, STOCK_FACES } from "@/lib/tavus-config";
import type { Lead } from "@/lib/types";
import { LeadPanel, type FeedItem } from "./LeadPanel";
import { Hero } from "./Hero";

const DEBUG = typeof window !== "undefined" && /[?&](debug|record)\b/.test(window.location.search);

type Status = "idle" | "connecting" | "live" | "ended" | "error";
type Who = "dispatcher" | "homeowner" | "you";
interface Line {
  id: string;
  who: Who;
  text: string;
}

async function createConversation(role: "dispatcher" | "homeowner", demo: boolean) {
  const res = await fetch("/api/conversation", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role, demo }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "Could not start the conversation");
  return json as { conversation_id: string; conversation_url: string };
}

function endConversation(id: string) {
  if (!id) return;
  navigator.sendBeacon?.("/api/conversation/end", new Blob([JSON.stringify({ conversation_id: id })], { type: "application/json" }));
}

export function Experience({ demoAvailable }: { demoAvailable: boolean }) {
  const [status, setStatus] = useState<Status>("idle");
  const [mode, setMode] = useState<"live" | "demo">("live");
  const [error, setError] = useState("");
  const [lead, setLead] = useState<Partial<Lead>>({});
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [speaking, setSpeaking] = useState<{ dispatcher: boolean; homeowner: boolean }>({ dispatcher: false, homeowner: false });
  const [micOn, setMicOn] = useState(true);
  const [elapsed, setElapsed] = useState(0);

  const calls = useRef<{ dispatcher?: CviCall; homeowner?: CviCall }>({});
  const bridge = useRef<AudioBridge | null>(null);
  const seenTools = useRef(new Set<string>());
  const endTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recorder = useRef<{ rec: MediaRecorder; chunks: Blob[]; stream: MediaStream } | null>(null);
  const firstGreetingDone = useRef<(() => void) | null>(null);

  const dispatcherVideo = useRef<HTMLVideoElement>(null);
  const homeownerVideo = useRef<HTMLVideoElement>(null);
  const selfVideo = useRef<HTMLVideoElement>(null);
  const dispatcherAudio = useRef<HTMLAudioElement>(null);
  const homeownerAudio = useRef<HTMLAudioElement>(null);

  const log = useCallback((item: Omit<FeedItem, "id" | "t">) => {
    setFeed((f) => [...f, { ...item, id: crypto.randomUUID(), t: Date.now() }].slice(-40));
  }, []);

  // Expose status for automation (Playwright recorder) and styling.
  useEffect(() => {
    document.body.dataset.callStatus = status;
  }, [status]);

  useEffect(() => {
    if (status !== "live") return;
    const start = Date.now();
    const i = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(i);
  }, [status]);

  const stopRecording = useCallback(async () => {
    const r = recorder.current;
    if (!r) return;
    recorder.current = null;
    await new Promise<void>((resolve) => {
      r.rec.onstop = () => resolve();
      r.rec.stop();
    });
    const blob = new Blob(r.chunks, { type: "audio/webm" });
    const res = await fetch("/api/dev/recording", { method: "POST", body: blob });
    document.body.dataset.recording = res.ok ? "saved" : "failed";
  }, []);

  const hangUp = useCallback(async () => {
    if (endTimer.current) clearTimeout(endTimer.current);
    const { dispatcher, homeowner } = calls.current;
    calls.current = {};
    await new Promise((r) => setTimeout(r, recorder.current ? 1500 : 0)); // let the outro land on tape
    await stopRecording();
    for (const c of [dispatcher, homeowner]) {
      if (!c) continue;
      endConversation(c.conversationId);
      await c.leave();
    }
    bridge.current?.close();
    bridge.current = null;
    setSpeaking({ dispatcher: false, homeowner: false });
    setStatus((s) => (s === "error" ? s : "ended"));
  }, [stopRecording]);

  // Hang up if the tab closes mid-call.
  useEffect(() => {
    const onUnload = () => {
      Object.values(calls.current).forEach((c) => c && endConversation(c.conversationId));
    };
    window.addEventListener("pagehide", onUnload);
    return () => window.removeEventListener("pagehide", onUnload);
  }, []);

  const handleToolCall = useCallback(
    async (call: CviCall, ev: TavusEvent, isDemo: boolean) => {
      const p = ev.properties ?? {};
      const toolCallId = String(p.tool_call_id ?? "");
      const name = String(p.name ?? "");
      const key = toolCallId || `${name}:${ev.inference_id}`;
      if (seenTools.current.has(key)) return;
      seenTools.current.add(key);

      let args: Record<string, string> = {};
      try {
        args = typeof p.arguments === "string" ? JSON.parse(p.arguments) : ((p.arguments as Record<string, string>) ?? {});
      } catch {
        /* keep empty */
      }

      log({ kind: "tool_call", name, detail: args });
      setPending((s) => ({ ...s, [name]: true }));
      // Optimistically show the fields the PAL extracted while the server scores/books.
      if (name === TOOL_NAMES.qualify) setLead((l) => ({ ...l, ...args }));

      try {
        const res = await fetch("/api/tools", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ conversation_id: call.conversationId, name, args }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error);
        setLead(json.lead);
        if (toolCallId) call.sendToolResult(toolCallId, json.output);
        log({ kind: "tool_result", name, detail: json.output });
      } catch (err) {
        if (toolCallId) call.sendToolResult(toolCallId, "The system is unavailable right now.", "error");
        log({ kind: "error", name, detail: String(err) });
      } finally {
        setPending((s) => ({ ...s, [name]: false }));
      }

      if (name === TOOL_NAMES.summary && isDemo) {
        // Let the goodbyes play out, then end both conversations.
        endTimer.current = setTimeout(() => hangUp(), 14000);
      }
    },
    [hangUp, log],
  );

  const onEvent = useCallback(
    (who: "dispatcher" | "homeowner", call: CviCall, isDemo: boolean) => (ev: TavusEvent) => {
      const role = ev.properties?.role as string | undefined;
      if (DEBUG && ev.event_type !== "conversation.utterance.streaming") {
        console.debug(`[${who}] ${ev.event_type}${role ? ` (${role})` : ""}`, JSON.stringify(ev.properties ?? {}).slice(0, 200));
      }
      switch (ev.event_type) {
        case "conversation.tool_call":
          if (who === "dispatcher") handleToolCall(call, ev, isDemo);
          break;
        case "conversation.utterance": {
          if (role === "replica") return; // legacy duplicate of role "pal"
          const text = String(ev.properties?.speech ?? "").trim();
          if (!text) return;
          let speaker: Who;
          if (role === "pal" || role === "replica") speaker = who;
          else if (isDemo) return; // in the demo, each PAL's own transcript is the source of truth
          else speaker = "you";
          setLines((ls) => [...ls, { id: crypto.randomUUID(), who: speaker, text }].slice(-30));
          break;
        }
        case "conversation.replica.started_speaking":
          // Two-party call: whoever starts talking has the floor.
          setSpeaking(isDemo ? { dispatcher: who === "dispatcher", homeowner: who === "homeowner" } : (s) => ({ ...s, [who]: true }));
          break;
        case "conversation.replica.stopped_speaking":
          setSpeaking((s) => ({ ...s, [who]: false }));
          if (who === "dispatcher") firstGreetingDone.current?.();
          break;
      }
    },
    [handleToolCall],
  );

  const attach = (el: HTMLMediaElement | null, track: MediaStreamTrack) => {
    if (!el) return;
    el.srcObject = new MediaStream([track]);
    el.play().catch(() => {});
  };

  /**
   * Records the demo's audio (both PAL voices, mixed by the AudioBridge). The automation
   * script records the page video and muxes the two; window.__recStart aligns them.
   */
  const startRecordingIfAsked = async (mix: MediaStreamTrack) => {
    if (!new URLSearchParams(location.search).has("record")) return;
    const stream = new MediaStream([mix]);
    const rec = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus", audioBitsPerSecond: 128_000 });
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    rec.start(1000);
    (window as unknown as { __recStart: number }).__recStart = Date.now();
    recorder.current = { rec, chunks, stream };
    document.body.dataset.recording = "on";
  };

  const reset = () => {
    setError("");
    setLead({});
    setFeed([]);
    setLines([]);
    setPending({});
    setElapsed(0);
    seenTools.current.clear();
  };

  /** Visitor talks to the dispatcher with their own camera and mic. */
  const startLive = async () => {
    reset();
    setMode("live");
    setStatus("connecting");
    try {
      const convo = await createConversation("dispatcher", false);
      const call: CviCall = new CviCall({
        userName: "Website visitor",
        onEvent: (ev) => handler(ev),
        onRemoteTrack: (kind, track) => attach(kind === "video" ? dispatcherVideo.current : dispatcherAudio.current, track),
        onLocalVideo: (track) => attach(selfVideo.current, track),
        onLeft: () => setStatus((s) => (s === "live" ? "ended" : s)),
        onError: (m) => {
          setError(m);
          setStatus("error");
        },
      });
      const handler = onEvent("dispatcher", call, false);
      calls.current = { dispatcher: call };
      log({ kind: "info", name: "conversation", detail: `Created ${convo.conversation_id}` });
      await call.join(convo.conversation_url, convo.conversation_id);
      setStatus("live");
    } catch (err) {
      setError((err as Error).message);
      setStatus("error");
      hangUp();
    }
  };

  /** Two Tavus PALs on one page: each one's voice is piped into the other's mic. */
  const startDemo = async () => {
    reset();
    setMode("demo");
    setStatus("connecting");
    try {
      bridge.current = new AudioBridge();
      await bridge.current.resume();
      const b = bridge.current;
      await startRecordingIfAsked(b.mix.stream.getAudioTracks()[0]);

      const [dConvo, hConvo] = await Promise.all([createConversation("dispatcher", true), createConversation("homeowner", true)]);
      log({ kind: "info", name: "conversation", detail: `Dispatcher ${dConvo.conversation_id} · Homeowner ${hConvo.conversation_id}` });

      const dispatcher: CviCall = new CviCall({
        userName: "Caller",
        audioSource: b.micFor("dispatcher"),
        videoSource: false,
        onEvent: (ev) => dHandler(ev),
        onRemoteTrack: (kind, track) => {
          if (kind === "video") return attach(dispatcherVideo.current, track);
          attach(dispatcherAudio.current, track);
          b.connect("dispatcher", track);
        },
      });
      const homeowner: CviCall = new CviCall({
        userName: "Dispatcher",
        audioSource: b.micFor("homeowner"),
        videoSource: false,
        onEvent: (ev) => hHandler(ev),
        onRemoteTrack: (kind, track) => {
          if (kind === "video") return attach(homeownerVideo.current, track);
          attach(homeownerAudio.current, track);
          b.connect("homeowner", track);
        },
      });
      const dHandler = onEvent("dispatcher", dispatcher, true);
      const hHandler = onEvent("homeowner", homeowner, true);
      calls.current = { dispatcher, homeowner };

      // Dispatcher joins and greets first; the homeowner "dials in" right after.
      const greeted = new Promise<void>((resolve) => {
        firstGreetingDone.current = resolve;
        setTimeout(resolve, 15000);
      });
      await dispatcher.join(dConvo.conversation_url, dConvo.conversation_id);
      setStatus("live");
      await greeted;
      firstGreetingDone.current = null;
      await homeowner.join(hConvo.conversation_url, hConvo.conversation_id);
      // Safety net so a runaway demo never burns minutes.
      endTimer.current = setTimeout(() => hangUp(), 5 * 60 * 1000);
    } catch (err) {
      setError((err as Error).message);
      setStatus("error");
      hangUp();
    }
  };

  // Auto-start the demo for the recorder: /?demo=1&autostart=1
  const autostarted = useRef(false);
  useEffect(() => {
    const q = new URLSearchParams(location.search);
    if (q.has("demo") && q.has("autostart") && !autostarted.current) {
      autostarted.current = true;
      const go = () => startDemo();
      window.addEventListener("click", go, { once: true }); // getDisplayMedia needs a user gesture
      document.body.dataset.ready = "1";
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleMic = () => {
    const next = !micOn;
    setMicOn(next);
    calls.current.dispatcher?.setMicEnabled(next);
  };

  const active = status === "connecting" || status === "live";
  const showStage = status !== "idle";

  return (
    <>
      {!showStage && <Hero onStart={startLive} onDemo={startDemo} demoAvailable={demoAvailable} />}

      {showStage && (
        <section className="mx-auto w-full max-w-[1320px] px-4 pb-10 pt-4 md:px-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <StatusPill status={status} elapsed={elapsed} />
              <span className="text-sm text-muted">
                {mode === "demo" ? "Two-agent demo: a Tavus homeowner calls a Tavus dispatcher" : `Talking with ${STOCK_FACES.dispatcher.name}, dispatcher`}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {mode === "live" && active && (
                <button onClick={toggleMic} className="btn-ghost" aria-pressed={!micOn}>
                  {micOn ? "Mute" : "Unmute"}
                </button>
              )}
              {active ? (
                <button onClick={hangUp} className="btn-danger">
                  End call
                </button>
              ) : (
                <>
                  <button onClick={startLive} className="btn-primary">
                    Talk again
                  </button>
                  {demoAvailable && (
                    <button onClick={startDemo} className="btn-ghost">
                      Replay two-agent demo
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
            <div className="flex min-w-0 flex-col gap-4">
              <div className={mode === "demo" ? "grid gap-4 sm:grid-cols-2" : ""}>
                <VideoTile
                  ref={dispatcherVideo}
                  label={STOCK_FACES.dispatcher.name}
                  poster={STOCK_FACES.dispatcher.poster}
                  role="Dispatcher · Tavus PAL"
                  speaking={speaking.dispatcher}
                  status={status}
                  tall={mode === "live"}
                >
                  {mode === "live" && (
                    <video
                      ref={selfVideo}
                      muted
                      playsInline
                      className="absolute bottom-3 right-3 aspect-video w-32 rounded-lg border border-white/30 object-cover shadow-lg md:w-44"
                    />
                  )}
                </VideoTile>
                {mode === "demo" && (
                  <VideoTile ref={homeownerVideo} label={STOCK_FACES.homeowner.name} poster={STOCK_FACES.homeowner.poster} role="Homeowner · Tavus PAL" speaking={speaking.homeowner} status={status} />
                )}
              </div>
              <Transcript lines={lines} mode={mode} />
              {error && <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
            </div>
            <LeadPanel lead={lead} pending={pending} feed={feed} live={status === "live"} />
          </div>
          <audio ref={dispatcherAudio} autoPlay />
          <audio ref={homeownerAudio} autoPlay />
        </section>
      )}
    </>
  );
}

function StatusPill({ status, elapsed }: { status: Status; elapsed: number }) {
  const map: Record<Status, [string, string]> = {
    idle: ["Ready", "bg-slate-400"],
    connecting: ["Connecting", "bg-amber-400 animate-pulse"],
    live: ["Live", "bg-emerald-500 animate-pulse"],
    ended: ["Call ended", "bg-slate-400"],
    error: ["Error", "bg-red-500"],
  };
  const [label, dot] = map[status];
  const mm = String(Math.floor(elapsed / 60)).padStart(1, "0");
  const ss = String(elapsed % 60).padStart(2, "0");
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-3 py-1 font-mono text-xs uppercase tracking-wider text-ink">
      <span className={`h-2 w-2 rounded-full ${dot}`} />
      {label}
      {status === "live" && <span className="text-muted">{`${mm}:${ss}`}</span>}
    </span>
  );
}

const VideoTile = forwardRef<
  HTMLVideoElement,
  { label: string; role: string; poster: string; speaking: boolean; status: Status; tall?: boolean; children?: ReactNode }
>(function VideoTile({ label, role, poster, speaking, status, tall, children }, ref) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl bg-pine-deep shadow-[0_20px_60px_-20px_rgba(6,27,45,0.6)] ring-2 transition-[box-shadow,ring-color] duration-300 ${
        speaking ? "ring-brass" : "ring-transparent"
      } ${tall ? "aspect-video" : "aspect-[4/3] sm:aspect-[3/4] lg:aspect-[4/5]"}`}
    >
      <video ref={ref} autoPlay playsInline muted className="absolute inset-0 h-full w-full object-cover" />
      {(status === "ended" || status === "error") && (
        <div className="absolute inset-0 grid place-items-center bg-pine-deep">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={poster} alt="" className="absolute inset-0 h-full w-full object-cover opacity-30 blur-[2px] grayscale" />
          <span className="relative rounded-full bg-black/50 px-4 py-2 font-mono text-xs uppercase tracking-widest text-white/85 backdrop-blur">
            {status === "ended" ? "Call ended" : "Disconnected"}
          </span>
        </div>
      )}
      {status === "connecting" && (
        <div className="absolute inset-0 grid place-items-center">
          <div className="flex flex-col items-center gap-3 text-white/80">
            <span className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-brass" />
            <span className="font-mono text-xs uppercase tracking-widest">Connecting {label}</span>
          </div>
        </div>
      )}
      <div className="absolute left-3 top-3 flex items-center gap-2 rounded-full bg-black/45 px-3 py-1.5 text-white backdrop-blur">
        <span className={`flex h-3 items-end gap-[2px] ${speaking ? "" : "opacity-40"}`} aria-hidden>
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className={`w-[3px] rounded-full bg-brass ${speaking ? "eq-bar" : "h-1"}`} style={{ animationDelay: `${i * 0.12}s` }} />
          ))}
        </span>
        <span className="text-sm font-semibold">{label}</span>
        <span className="hidden text-xs text-white/70 sm:inline">{role}</span>
      </div>
      {children}
    </div>
  );
});

function Transcript({ lines, mode }: { lines: Line[]; mode: "live" | "demo" }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight, behavior: "smooth" });
  }, [lines]);
  const name: Record<Who, string> = {
    dispatcher: STOCK_FACES.dispatcher.name,
    homeowner: STOCK_FACES.homeowner.name,
    you: "You",
  };
  return (
    <div className="rounded-2xl border border-line bg-white">
      <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
        <h3 className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted">Transcript</h3>
        <span className="font-mono text-[11px] text-muted">conversation.utterance</span>
      </div>
      <div ref={ref} className="max-h-44 space-y-2 overflow-y-auto px-4 py-3 text-[15px] leading-snug">
        {lines.length === 0 && (
          <p className="text-muted">{mode === "demo" ? "Waiting for the agents to start talking…" : "Say hi when the dispatcher appears."}</p>
        )}
        {lines.map((l) => (
          <p key={l.id} className="animate-in">
            <span className={`mr-2 font-semibold ${l.who === "dispatcher" ? "text-pine" : "text-brass-ink"}`}>{name[l.who]}</span>
            <span className="text-body">{l.text}</span>
          </p>
        ))}
      </div>
    </div>
  );
}
