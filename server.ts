import express from "express";
import { createServer as createViteServer } from "vite";
import fs from "fs";
import path from "path";
import multer from "multer";
import * as mm from "music-metadata";
import NodeID3 from "node-id3";
import { v4 as uuidv4 } from "uuid";
import { GoogleGenAI } from "@google/genai";
import cors from "cors";

// Mock implementation of a local JSON DB
const dbPath = path.resolve(process.cwd(), "db.json");

interface Track {
  id: string;
  filename: string;
  path: string;
  title: string;
  artist: string;
  album: string;
  year: string;
  genre: string;
  bpm: string;
  key: string;
  customTags: string[];
  isDuplicateOf?: string;
  duplicateGroup?: string;
}

interface DB {
  tracks: Track[];
  history: {
    id: string;
    timestamp: string;
    moves: { oldPath: string; newPath: string }[];
  }[];
  playlists: { id: string; name: string; trackIds: string[] }[];
}

let db: DB = { tracks: [], history: [], playlists: [] };

function loadDB() {
  if (fs.existsSync(dbPath)) {
    try {
      db = JSON.parse(fs.readFileSync(dbPath, "utf-8"));
    } catch (e) {
      console.error("Failed to load db.json, starting fresh.");
    }
  }
}

function saveDB() {
  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), "utf-8");
}

loadDB();

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const upload = multer({ dest: "uploads/" });

async function startServer() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  // API ROUTES

  app.get("/api/library", (req, res) => {
    res.json(db);
  });

  app.post("/api/library/scan", async (req, res) => {
    const { directory } = req.body;
    if (!directory || !fs.existsSync(directory)) {
      return res.status(400).json({ error: "Invalid directory path" });
    }

    const scanDir = async (dir: string) => {
      let results: string[] = [];
      const list = fs.readdirSync(dir);
      for (const file of list) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat && stat.isDirectory()) {
          results = results.concat(await scanDir(filePath));
        } else if (file.toLowerCase().endsWith(".mp3")) {
          results.push(filePath);
        }
      }
      return results;
    };

    try {
      const files = await scanDir(directory);
      const newTracks: Track[] = [];

      for (const file of files) {
        // Skip if already in DB
        if (db.tracks.some((t) => t.path === file)) continue;

        try {
          const metadata = await mm.parseFile(file);
          const tags = NodeID3.read(file) as any;

          const title = metadata.common.title || path.parse(file).name;
          const artist = metadata.common.artist || "Unknown Artist";
          const album = metadata.common.album || "Unknown Album";
          const year = metadata.common.year ? metadata.common.year.toString() : "Unknown Year";
          const genre = metadata.common.genre ? metadata.common.genre.join(", ") : "Unknown Genre";
          const bpm = metadata.common.bpm ? metadata.common.bpm.toString() : tags.bpm || "";
          const key = tags.initialKey || ""; // TKEY frame

          newTracks.push({
            id: uuidv4(),
            filename: path.basename(file),
            path: file,
            title,
            artist,
            album,
            year,
            genre,
            bpm,
            key,
            customTags: [],
          });
        } catch (e) {
          console.error(`Failed to read metadata for ${file}`, e);
        }
      }

      // Very basic duplicate detection based on title and artist
      const grouped = new Map<string, Track[]>();
      db.tracks.concat(newTracks).forEach((t) => {
        const key = `${t.title}-${t.artist}`.toLowerCase();
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key)!.push(t);
      });

      grouped.forEach((v, k) => {
        if (v.length > 1) {
          const groupId = uuidv4();
          v.forEach((t, index) => {
            if (index > 0) t.isDuplicateOf = v[0].id;
            t.duplicateGroup = groupId;
          });
        }
      });

      db.tracks = [...db.tracks, ...newTracks];
      saveDB();
      res.json({ message: `Scanned and added ${newTracks.length} new tracks.`, tracks: db.tracks });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Preview Dry Run
  app.post("/api/organize/preview", (req, res) => {
    const { baseDir } = req.body;
    if (!baseDir) return res.status(400).json({ error: "No base directory provided" });

    const preview = db.tracks.filter(t => !t.isDuplicateOf).map((t) => {
      const yearInt = parseInt(t.year);
      let decade = "Unknown Decade";
      if (!isNaN(yearInt)) {
        decade = `${Math.floor(yearInt / 10) * 10}s`;
      }
      
      // Clean genre for folder name
      const safeGenre = t.genre.replace(/[/\\?%*:|"<>]/g, "-").split(",")[0].trim() || "Unknown Genre";
      const safeFilename = t.filename.replace(/[/\\?%*:|"<>]/g, "-");

      const newPath = path.join(baseDir, decade, safeGenre, safeFilename);
      return { id: t.id, oldPath: t.path, newPath };
    }).filter(t => t.oldPath !== t.newPath);

    res.json(preview);
  });

  // Execute Organize
  app.post("/api/organize/execute", async (req, res) => {
    const { moves } = req.body; // { id, oldPath, newPath }
    if (!moves || !Array.isArray(moves)) return res.status(400).json({ error: "Invalid moves" });

    const executedMoves: { oldPath: string; newPath: string }[] = [];

    for (const move of moves) {
      try {
        if (fs.existsSync(move.oldPath)) {
          const dir = path.dirname(move.newPath);
          fs.mkdirSync(dir, { recursive: true });
          fs.renameSync(move.oldPath, move.newPath);
          executedMoves.push({ oldPath: move.oldPath, newPath: move.newPath });
          
          // Update DB track
          const track = db.tracks.find(t => t.id === move.id);
          if (track) track.path = move.newPath;
        }
      } catch (e) {
        console.error(`Failed to move ${move.oldPath}`, e);
      }
    }

    if (executedMoves.length > 0) {
      db.history.push({
        id: uuidv4(),
        timestamp: new Date().toISOString(),
        moves: executedMoves,
      });
      saveDB();
    }

    res.json({ message: `Organized ${executedMoves.length} files.`, db });
  });

  // Undo Organize
  app.post("/api/organize/undo", (req, res) => {
    const { historyId } = req.body;
    const historyEntry = db.history.find(h => h.id === historyId);
    if (!historyEntry) return res.status(404).json({ error: "History entry not found" });

    const undoneMoves: any[] = [];
    // Go backwards in the history
    for (const move of historyEntry.moves.reverse()) {
      try {
        if (fs.existsSync(move.newPath)) {
          const dir = path.dirname(move.oldPath);
          fs.mkdirSync(dir, { recursive: true });
          fs.renameSync(move.newPath, move.oldPath);
          undoneMoves.push(move);
          
          // Update DB track
          const track = db.tracks.find(t => t.path === move.newPath);
          if (track) track.path = move.oldPath;
        }
      } catch (e) {
        console.error(`Failed to undo move ${move.newPath}`, e);
      }
    }

    db.history = db.history.filter(h => h.id !== historyId);
    saveDB();

    res.json({ message: `Reverted ${undoneMoves.length} files.`, db });
  });

  // Add custom tags
  app.post("/api/tracks/:id/tags", (req, res) => {
    const { tags } = req.body;
    const track = db.tracks.find((t) => t.id === req.params.id);
    if (track) {
      track.customTags = tags;
      saveDB();
      res.json(track);
    } else {
      res.status(404).json({ error: "Track not found" });
    }
  });

  // Update track logic metadata (Title/Artist/etc) inside the file
  app.post("/api/tracks/:id/metadata", (req, res) => {
     const track = db.tracks.find((t) => t.id === req.params.id);
     if (!track) return res.status(404).json({ error: "Track not found" });
     
     const { title, artist, album, genre, year } = req.body;
     const newTags = { title: title || track.title, artist: artist || track.artist, album: album || track.album, genre: genre || track.genre, year: year || track.year };
     
     try {
       NodeID3.update(newTags, track.path);
       track.title = newTags.title;
       track.artist = newTags.artist;
       track.album = newTags.album;
       track.genre = newTags.genre;
       track.year = newTags.year;
       saveDB();
       res.json(track);
     } catch(e) {
       res.status(500).json({ error: "Failed to update ID3" });
     }
  });

  // AI Enrich missing data
  app.post("/api/ai/enrich", async (req, res) => {
    const { trackId } = req.body;
    const track = db.tracks.find((t) => t.id === trackId);
    if (!track) return res.status(404).json({ error: "Track not found" });

    try {
      const prompt = `Based on the song title "${track.title}" by artist "${track.artist}", respond strictly with a valid JSON strictly following this structure: {"genre": "String (e.g., House, Techno, Pop)", "year": "YYYY (e.g., 1995)"}. Estimate if unsure. Return only JSON.`;
      const response = await ai.models.generateContent({
        model: 'gemini-3.1-pro-preview',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
      });
      let text = response.text || "{}";
      text = text.replace(/\`\`\`json/g, "").replace(/\`\`\`/g, "").trim();
      const result = JSON.parse(text);
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Playlists
  app.post("/api/playlists", (req, res) => {
    const { name, trackIds } = req.body;
    const pl = { id: uuidv4(), name: name || "New Playlist", trackIds: trackIds || [] };
    db.playlists.push(pl);
    saveDB();
    res.json(pl);
  });

  app.put("/api/playlists/:id", (req, res) => {
     const { name, trackIds } = req.body;
     const idx = db.playlists.findIndex(p => p.id === req.params.id);
     if (idx >= 0) {
        db.playlists[idx].name = name || db.playlists[idx].name;
        db.playlists[idx].trackIds = trackIds || db.playlists[idx].trackIds;
        saveDB();
        res.json(db.playlists[idx]);
     } else {
        res.status(404).json({error: "Not found"});
     }
  });

  // Rekordbox Export
  app.get("/api/playlists/:id/export", (req, res) => {
    const pl = db.playlists.find((p) => p.id === req.params.id);
    if (!pl) return res.status(404).json({ error: "Playlist not found" });

    let m3u8 = "#EXTM3U\n";
    for (const tid of pl.trackIds) {
      const track = db.tracks.find((t) => t.id === tid);
      if (track) {
        // #EXTINF:duration,Artist - Title
        m3u8 += `#EXTINF:-1,${track.artist} - ${track.title}\n`;
        m3u8 += `${track.path}\n`;
      }
    }

    res.setHeader("Content-disposition", `attachment; filename=${pl.name.replace(/[^a-z0-9]/gi, '_')}.m3u8`);
    res.setHeader("Content-type", "audio/x-mpegurl");
    res.send(m3u8);
  });

  // Stream Audio
  app.get("/api/stream", (req, res) => {
    const trackPath = req.query.path as string;
    if (!trackPath || !fs.existsSync(trackPath)) {
      return res.status(404).send("File not found");
    }

    const stat = fs.statSync(trackPath);
    res.writeHead(200, {
      "Content-Type": "audio/mpeg",
      "Content-Length": stat.size,
    });
    fs.createReadStream(trackPath).pipe(res);
  });

  // Fetch track cover art (using ID3)
  app.get("/api/tracks/:id/cover", (req, res) => {
     const track = db.tracks.find(t => t.id === req.params.id);
     if (track && fs.existsSync(track.path)) {
        const tags = NodeID3.read(track.path);
        if (tags && tags.image && (tags.image as any).imageBuffer) {
           res.contentType((tags.image as any).mime);
           return res.send((tags.image as any).imageBuffer);
        }
     }
     res.status(404).send("No cover found");
  });

  // Setup Vite / Static Serving
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

  const PORT = Number(process.env.PORT) || 3000;
  app.listen(PORT, "0.0.0.0" as any, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
