import { describe, expect, it } from "vitest";
import { SRT_TIMING_RE, decodeSrtBytes, hasSrtTimingLine, parseSrtTimestamp, tokenizeSrt } from "@/lib/telemetry/srt-cues";

describe("decodeSrtBytes", () => {
  it("decodes UTF-8 with a BOM and strips it", () => {
    const text = "1\n00:00:00,000 --> 00:00:01,000\nHello\n";
    const bytes = new Uint8Array([0xef, 0xbb, 0xbf, ...Buffer.from(text, "utf8")]);
    const result = decodeSrtBytes(bytes);
    expect(result.encoding).toBe("utf-8");
    expect(result.text.startsWith("1\n")).toBe(true);
    expect(result.replacementRatio).toBe(0);
    expect(hasSrtTimingLine(result.text)).toBe(true);
  });

  it("decodes UTF-16LE with a BOM", () => {
    const text = "1\n00:00:00,000 --> 00:00:01,000\nHello\n";
    const bytes = new Uint8Array([0xff, 0xfe, ...Buffer.from(text, "utf16le")]);
    const result = decodeSrtBytes(bytes);
    expect(result.encoding).toBe("utf-16le");
    expect(result.text.startsWith("1\n")).toBe(true);
    expect(hasSrtTimingLine(result.text)).toBe(true);
  });

  it("decodes UTF-16BE with a BOM", () => {
    const le = Buffer.from("Hello", "utf16le");
    const be = Buffer.alloc(le.length);
    for (let i = 0; i < le.length; i += 2) {
      be[i] = le[i + 1];
      be[i + 1] = le[i];
    }
    const bytes = new Uint8Array([0xfe, 0xff, ...be]);
    const result = decodeSrtBytes(bytes);
    expect(result.encoding).toBe("utf-16be");
    expect(result.text).toBe("Hello");
  });

  it("normalizes CRLF and lone CR to LF", () => {
    const bytes = new Uint8Array(Buffer.from("a\r\nb\rc\n", "utf8"));
    expect(decodeSrtBytes(bytes).text).toBe("a\nb\nc\n");
  });

  it("reports a high replacement ratio for binary garbage", () => {
    const bytes = new Uint8Array(200).fill(0x80); // lone continuation bytes: invalid UTF-8
    expect(decodeSrtBytes(bytes).replacementRatio).toBeGreaterThan(0.01);
  });

  it("reports zero replacement ratio for clean ASCII text", () => {
    const bytes = new Uint8Array(Buffer.from("just plain text", "utf8"));
    expect(decodeSrtBytes(bytes).replacementRatio).toBe(0);
  });
});

describe("hasSrtTimingLine / SRT_TIMING_RE", () => {
  it("matches the required timestamp formats", () => {
    expect(SRT_TIMING_RE.test("00:00:01,000 --> 00:00:02,000")).toBe(true);
    expect(SRT_TIMING_RE.test("01:10:00,250 --> 01:10:05,000")).toBe(true);
  });

  it("finds a timing line among unrelated content", () => {
    expect(hasSrtTimingLine("1\n00:00:00,000 --> 00:00:02,000\nHello\n")).toBe(true);
  });

  it("returns false for text with no timing line", () => {
    expect(hasSrtTimingLine("just some random text\nwith multiple lines\n")).toBe(false);
  });
});

describe("parseSrtTimestamp", () => {
  it("required timestamp vectors", () => {
    expect(parseSrtTimestamp("00:00:01,000")).toBe(1);
    expect(parseSrtTimestamp("00:01:10,500")).toBe(70.5);
    expect(parseSrtTimestamp("01:10:00,250")).toBe(4200.25);
    expect(parseSrtTimestamp("00:00:01.5")).toBe(1.5);
    expect(parseSrtTimestamp("00:61:00,000")).toBeNull();
  });
});

describe("tokenizeSrt", () => {
  it("tokenizes a standard multi-cue file", () => {
    const text = "1\n00:00:00,000 --> 00:00:01,000\nfirst\n\n2\n00:00:01,000 --> 00:00:02,000\nsecond\n";
    const cues = tokenizeSrt(text);
    expect(cues).toHaveLength(2);
    expect(cues[0]).toMatchObject({ index: 1, payload: "first" });
    expect(cues[1]).toMatchObject({ index: 2, payload: "second" });
  });

  it("keeps interior blank lines in a multiline payload", () => {
    const text = "1\n00:00:00,000 --> 00:00:01,000\nline one\n\nline two\n";
    const cues = tokenizeSrt(text);
    expect(cues[0].payload).toBe("line one\n\nline two");
  });

  it("marks bad timing without merging into the previous cue's payload", () => {
    const text = "1\n00:00:00,000 --> 00:00:01,000\nfirst\n\n2\nnot --> a timestamp\nsecond\n";
    const cues = tokenizeSrt(text);
    expect(cues).toHaveLength(2);
    expect(cues[0].payload).toBe("first");
    expect(cues[1].timing).toEqual({ error: "BAD_TIMESTAMP" });
  });

  it("flags end time before start time", () => {
    const text = "1\n00:00:05,000 --> 00:00:01,000\npayload\n";
    const cues = tokenizeSrt(text);
    expect(cues[0].timing).toEqual({ error: "END_BEFORE_START" });
  });

  it("handles missing cue index lines", () => {
    const text = "00:00:00,000 --> 00:00:01,000\nfirst\n\n00:00:01,000 --> 00:00:02,000\nsecond\n";
    const cues = tokenizeSrt(text);
    expect(cues.map((c) => c.index)).toEqual([null, null]);
    expect(cues.map((c) => c.payload)).toEqual(["first", "second"]);
  });

  it("handles two blank lines between cues", () => {
    const text = "1\n00:00:00,000 --> 00:00:01,000\nfirst\n\n\n2\n00:00:01,000 --> 00:00:02,000\nsecond\n";
    const cues = tokenizeSrt(text);
    expect(cues).toHaveLength(2);
    expect(cues[1].payload).toBe("second");
  });

  it("handles CRLF-normalized input the same as LF", () => {
    const text = "1\r\n00:00:00,000 --> 00:00:01,000\r\nfirst\r\n".replace(/\r\n/g, "\n");
    const cues = tokenizeSrt(text);
    expect(cues[0].payload).toBe("first");
  });

  it("assigns sequential ordinals starting at 0", () => {
    const text = "1\n00:00:00,000 --> 00:00:01,000\na\n\n2\n00:00:01,000 --> 00:00:02,000\nb\n\n3\n00:00:02,000 --> 00:00:03,000\nc\n";
    const cues = tokenizeSrt(text);
    expect(cues.map((c) => c.ordinal)).toEqual([0, 1, 2]);
  });
});
