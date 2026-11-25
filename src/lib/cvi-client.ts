"use client";

import Daily, { type DailyCall, type DailyEventObjectAppMessage, type DailyEventObjectTrack } from "@daily-co/daily-js";

/** Shape of the Tavus Interaction Protocol messages we care about. */
export interface TavusEvent {
  message_type: string;
  event_type: string;
  conversation_id?: string;
  inference_id?: string;
  turn_idx?: number;
  properties?: Record<string, unknown>;
}

interface Options {
  /** Custom mic (MediaStreamTrack) or `true` for the device mic. */
  audioSource?: MediaStreamTrack | boolean;
  videoSource?: MediaStreamTrack | boolean;
  userName?: string;
  onEvent: (ev: TavusEvent) => void;
  /** Fired for the PAL's (remote) tracks. */
  onRemoteTrack: (kind: "audio" | "video", track: MediaStreamTrack) => void;
  onLocalVideo?: (track: MediaStreamTrack) => void;
  onLeft?: () => void;
  onError?: (msg: string) => void;
}

/**
 * Thin wrapper around a Daily call object joined to a Tavus conversation_url.
 * Several can run at once (the two-agent demo uses two).
 */
export class CviCall {
  private call: DailyCall;
  conversationId = "";

  constructor(private opts: Options) {
    this.call = Daily.createCallObject({
      allowMultipleCallInstances: true,
      audioSource: opts.audioSource ?? true,
      videoSource: opts.videoSource ?? true,
      subscribeToTracksAutomatically: true,
    });

    this.call.on("app-message", (e?: DailyEventObjectAppMessage) => {
      const data = e?.data as TavusEvent | undefined;
      if (data && typeof data === "object" && data.event_type) this.opts.onEvent(data);
    });

    this.call.on("track-started", (e?: DailyEventObjectTrack) => {
      if (!e?.participant || !e.track) return;
      const kind = e.track.kind as "audio" | "video";
      if (e.participant.local) {
        if (kind === "video") this.opts.onLocalVideo?.(e.track);
        return;
      }
      this.opts.onRemoteTrack(kind, e.track);
    });

    this.call.on("left-meeting", () => this.opts.onLeft?.());
    this.call.on("error", (e) => this.opts.onError?.(e?.errorMsg ?? "Call error"));
  }

  async join(url: string, conversationId: string) {
    this.conversationId = conversationId;
    await this.call.join({ url, userName: this.opts.userName ?? "Visitor" });
  }

  send(message: object) {
    this.call.sendAppMessage(message, "*");
  }

  /** Reply to a conversation.tool_call with the matching tool_call_id. */
  sendToolResult(toolCallId: string, output: string | object, status: "success" | "error" = "success") {
    this.send({
      message_type: "conversation",
      event_type: "conversation.tool_result",
      conversation_id: this.conversationId,
      properties: { tool_call_id: toolCallId, output, status },
    });
  }

  setMicEnabled(on: boolean) {
    this.call.setLocalAudio(on);
  }

  setCamEnabled(on: boolean) {
    this.call.setLocalVideo(on);
  }

  async leave() {
    try {
      await this.call.leave();
    } catch {
      /* already left */
    }
    await this.call.destroy();
  }
}

/**
 * Audio router for the two-agent demo: each PAL's voice becomes the other
 * conversation's microphone. Uses Web Audio so the tracks exist before either
 * PAL has spoken (they start silent).
 */
export class AudioBridge {
  ctx = new AudioContext();
  private dests = {
    dispatcherMic: this.ctx.createMediaStreamDestination(),
    homeownerMic: this.ctx.createMediaStreamDestination(),
  };
  /** Both voices mixed, for recording the demo. */
  mix = this.ctx.createMediaStreamDestination();

  micFor(who: "dispatcher" | "homeowner") {
    const d = who === "dispatcher" ? this.dests.dispatcherMic : this.dests.homeownerMic;
    return d.stream.getAudioTracks()[0];
  }

  /** Route a PAL's remote voice into the other PAL's mic. */
  connect(from: "dispatcher" | "homeowner", track: MediaStreamTrack) {
    const src = this.ctx.createMediaStreamSource(new MediaStream([track]));
    src.connect(from === "dispatcher" ? this.dests.homeownerMic : this.dests.dispatcherMic);
    src.connect(this.mix);
  }

  async resume() {
    if (this.ctx.state !== "running") await this.ctx.resume();
  }

  close() {
    this.ctx.close();
  }
}
