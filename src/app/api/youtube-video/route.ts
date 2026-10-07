import { NextRequest, NextResponse } from "next/server";
import { youtubeDuration } from "@/lib/youtube-video";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id") || "";
  if (!/^[a-zA-Z0-9_-]{11}$/.test(id)) return NextResponse.json({ error: "Invalid video" }, { status: 400 });
  const watchUrl = `https://www.youtube.com/watch?v=${id}`;
  let title = "YouTube video", channel = "YouTube", duration: string | null = null;
  let thumbnail = `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
  try {
    const response = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(watchUrl)}&format=json`, { next: { revalidate: 86400 }, signal: AbortSignal.timeout(5000) });
    if (response.ok) {
      const metadata = await response.json();
      title = String(metadata.title || title).slice(0, 250);
      channel = String(metadata.author_name || channel).slice(0, 160);
      if (typeof metadata.thumbnail_url === "string" && metadata.thumbnail_url.startsWith("https://")) thumbnail = metadata.thumbnail_url;
    }
  } catch { /* Keep a usable card if YouTube metadata is temporarily unavailable. */ }
  const key = process.env.YOUTUBE_API_KEY;
  if (key) {
    try {
      const url = new URL("https://www.googleapis.com/youtube/v3/videos");
      url.searchParams.set("part", "snippet,contentDetails");
      url.searchParams.set("id", id);
      url.searchParams.set("key", key);
      const response = await fetch(url, { next: { revalidate: 86400 }, signal: AbortSignal.timeout(5000) });
      if (response.ok) {
        const video = (await response.json()).items?.[0];
        title = String(video?.snippet?.title || title).slice(0, 250);
        channel = String(video?.snippet?.channelTitle || channel).slice(0, 160);
        duration = youtubeDuration(video?.contentDetails?.duration);
        thumbnail = video?.snippet?.thumbnails?.high?.url || thumbnail;
      }
    } catch { /* The public card remains available without duration. */ }
  }
  return NextResponse.json({ id, title, channel, duration, thumbnail, url: watchUrl }, { headers: { "Cache-Control": "public, max-age=300, s-maxage=86400" } });
}
