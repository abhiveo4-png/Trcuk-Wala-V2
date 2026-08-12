import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route: YouTube Song Search
  app.get("/api/youtube-search", async (req, res) => {
    try {
      const query = (req.query.q as string || "").trim();
      if (!query) {
        return res.json({ tracks: [] });
      }

      const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query + " song")}`;
      const response = await fetch(searchUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept-Language": "en-US,en;q=0.9,hi;q=0.8",
        },
      });

      const html = await response.text();
      const match = html.match(/var ytInitialData = ({.*?});<\/script>/s) || html.match(/window\["ytInitialData"\] = ({.*?});/s);

      const tracks: any[] = [];

      if (match && match[1]) {
        try {
          const data = JSON.parse(match[1]);
          const contents =
            data?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents;

          if (Array.isArray(contents)) {
            for (const section of contents) {
              const items = section?.itemSectionRenderer?.contents;
              if (Array.isArray(items)) {
                for (const item of items) {
                  const vr = item?.videoRenderer;
                  if (vr && vr.videoId && vr.title?.runs?.[0]?.text) {
                    const videoId = vr.videoId;
                    const title = vr.title.runs[0].text;
                    const artist =
                      vr.ownerText?.runs?.[0]?.text ||
                      vr.shortBylineText?.runs?.[0]?.text ||
                      "YouTube Music";
                    const durationStr = vr.lengthText?.simpleText || "3:30";

                    // Calculate seconds
                    const parts = durationStr.split(":").map((p: string) => parseInt(p, 10));
                    let secs = 210;
                    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
                      secs = parts[0] * 60 + parts[1];
                    } else if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
                      secs = parts[0] * 3600 + parts[1] * 60 + parts[2];
                    }

                    tracks.push({
                      id: `yt-${videoId}-${Date.now()}`,
                      youtubeId: videoId,
                      title: title,
                      artist: artist,
                      movie: "YouTube Track",
                      duration: durationStr,
                      durationSeconds: secs,
                      thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
                      description: `Searched: ${query}`,
                    });

                    if (tracks.length >= 12) break;
                  }
                }
              }
              if (tracks.length >= 12) break;
            }
          }
        } catch (parseErr) {
          console.error("Error parsing ytInitialData:", parseErr);
        }
      }

      // Fallback if parsing returned 0 items
      if (tracks.length === 0) {
        // Provide mock fallback or simple result
        res.json({ tracks: [] });
      } else {
        res.json({ tracks });
      }
    } catch (err) {
      console.error("YouTube search error:", err);
      res.status(500).json({ error: "Failed to search YouTube", tracks: [] });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
