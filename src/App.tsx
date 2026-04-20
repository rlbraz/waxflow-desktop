import { useState, useEffect, useRef, ReactNode } from "react";
import { ThemeProvider, useTheme } from "./components/theme-provider";
import { Move, Disc3, FolderDown, ArrowUpDown, Wand2, Music2, FolderSync, Plus, RefreshCw, X, Tag, Library, Play, Pause, Save, FolderOpen, Headphones, Settings, Undo, Youtube } from "lucide-react";

// --- Types ---
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

interface Playlist {
  id: string;
  name: string;
  trackIds: string[];
}

interface DB {
  tracks: Track[];
  history: any[];
  playlists: Playlist[];
}

interface PreviewItem {
  id: string;
  oldPath: string;
  newPath: string;
}

export default function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="dj-app-theme">
      <MainApp />
    </ThemeProvider>
  );
}

function MainApp() {
  const [db, setDb] = useState<DB>({ tracks: [], history: [], playlists: [] });
  // Removed User state
  const [activeTab, setActiveTab] = useState<"library" | "playlists" | "duplicates" | "organize">("library");
  
  // Audio Player State
  const [playingTrack, setPlayingTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Load Initial Library
  useEffect(() => {
    fetchLibrary();
  }, []);

  const fetchLibrary = async () => {
    try {
      const res = await fetch("/api/library");
      const data = await res.json();
      setDb(data);
    } catch (e) {
      console.error("Failed to load library", e);
    }
  };

  const handlePlayPause = (track: Track) => {
    if (playingTrack?.id === track.id) {
      if (isPlaying) {
        audioRef.current?.pause();
        setIsPlaying(false);
      } else {
        audioRef.current?.play().catch(e => console.error("Playback error:", e));
        setIsPlaying(true);
      }
    } else {
      setPlayingTrack(track);
      setIsPlaying(true);
      // Let the effect handle playing after source updates
    }
  };

  useEffect(() => {
    if (playingTrack && audioRef.current && isPlaying) {
      audioRef.current.src = `/api/stream?path=${encodeURIComponent(playingTrack.path)}`;
      audioRef.current.play().catch(e => {
         console.error("Playback error:", e);
         setIsPlaying(false);
      });
    }
  }, [playingTrack]);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <div className="w-64 border-r border-border bg-card flex flex-col">
        <div className="p-6 pb-2">
          <h1 className="text-xl font-extrabold tracking-tight text-primary flex items-center gap-2 uppercase">
            <Disc3 className="w-6 h-6 text-primary" />
            WaxFlow
          </h1>
          <p className="text-[11px] text-muted-foreground mt-1 uppercase tracking-widest font-semibold">DJ Music Organizer</p>
        </div>
        
        <nav className="flex-1 space-y-1">
          <SidebarNavButton icon={<Library />} label="Biblioteca" active={activeTab === "library"} onClick={() => setActiveTab("library")} />
          <SidebarNavButton icon={<FolderDown />} label="Playlists" active={activeTab === "playlists"} onClick={() => setActiveTab("playlists")} />
          <SidebarNavButton icon={<FilesIcon />} label="Duplicatas" active={activeTab === "duplicates"} onClick={() => setActiveTab("duplicates")} />
          <SidebarNavButton icon={<FolderSync />} label="Organizar Pack" active={activeTab === "organize"} onClick={() => setActiveTab("organize")} />
        </nav>

        <div className="p-4 border-t border-border">
           <a href="https://www.youtube.com/@brazdj" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-red-500 w-full px-3 py-2 transition-colors">
            <Youtube className="w-4 h-4" />
            YouTube Channel
          </a>
          <ThemeToggle />
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b border-border bg-background flex items-center px-6 justify-between">
           <h2 className="text-lg font-semibold uppercase tracking-wide text-muted-foreground text-sm">{activeTab}</h2>
        </header>

        <main className="flex-1 overflow-auto p-6 relative">
           {activeTab === "library" && <LibraryView tracks={db.tracks} onPlay={handlePlayPause} playingTrack={playingTrack} isPlaying={isPlaying} onRefresh={fetchLibrary} />}
           {activeTab === "organize" && <OrganizeView tracks={db.tracks} history={db.history} onRefresh={fetchLibrary} />}
           {activeTab === "playlists" && <PlaylistsView playlists={db.playlists} tracks={db.tracks} onRefresh={fetchLibrary} onPlay={handlePlayPause} playingTrack={playingTrack} />}
           {activeTab === "duplicates" && <DuplicatesView tracks={db.tracks} onRefresh={fetchLibrary} />}
        </main>
      </div>
      {/* Persistent Audio Player */}
      {playingTrack && (
        <div className="fixed bottom-0 left-0 right-0 h-20 bg-black border-t border-border shadow-2xl flex items-center px-6 z-50 animate-in slide-in-from-bottom-2">
           <audio ref={audioRef} onEnded={() => setIsPlaying(false)} onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)} />
           <div className="flex-1 flex items-center gap-4">
              <div className="w-12 h-12 bg-muted rounded flex items-center justify-center overflow-hidden shrink-0">
                  <img src={`/api/tracks/${playingTrack.id}/cover`} alt="Cover" onError={(e) => (e.currentTarget.style.display = 'none')} className="w-full h-full object-cover" />
                  <Music2 className="w-6 h-6 text-muted-foreground absolute -z-10" />
              </div>
              <div className="min-w-0">
                 <p className="font-semibold text-sm truncate">{playingTrack.title || 'Unknown Title'}</p>
                 <p className="text-xs text-muted-foreground truncate">{playingTrack.artist || 'Unknown Artist'}</p>
              </div>
           </div>
           
           <div className="flex-1 flex items-center justify-center">
              <button 
                onClick={() => handlePlayPause(playingTrack)}
                className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:scale-105 transition-transform"
              >
                 {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 translate-x-0.5" />}
              </button>
           </div>
           
           <div className="flex-1 flex items-center justify-end">
              <div className="flex gap-2 text-xs font-mono text-muted-foreground">
                 <span className="bg-muted px-2 py-1 rounded">BPM: {playingTrack.bpm || '--'}</span>
                 <span className="bg-muted px-2 py-1 rounded">KEY: {playingTrack.key || '--'}</span>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}

// --- Icons ---
function FilesIcon() {
  return <Move className="w-4 h-4" /> // Replace with real later
}


// --- Components ---
function SidebarNavButton({ icon, label, active, onClick }: { icon: ReactNode, label: string, active: boolean, onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-6 py-2.5 transition-colors text-[13px] border-r-[3px] font-medium ${
        active ? "bg-primary/10 text-foreground border-primary" : "text-muted-foreground hover:text-foreground border-transparent hover:bg-muted"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  return (
    <button
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground w-full px-3 py-2"
    >
      <Settings className="w-4 h-4" />
      Toggle Theme
    </button>
  );
}

// --- Views ---
function LibraryView({ tracks, onPlay, playingTrack, isPlaying, onRefresh }: any) {
  const [scanning, setScanning] = useState(false);
  const [scanPath, setScanPath] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [editingTrack, setEditingTrack] = useState<Track | null>(null);

  const handleScan = async () => {
    if(!scanPath) return;
    setScanning(true);
    try {
      await fetch('/api/library/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ directory: scanPath })
      });
      onRefresh();
    } catch (e) {
      console.error(e);
    }
    setScanning(false);
  };

  const handleAIEnrich = async (t: Track) => {
    try {
      const res = await fetch('/api/ai/enrich', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ trackId: t.id })
      });
      const data = await res.json();
      
      // Update metadata
      await fetch(`/api/tracks/${t.id}/metadata`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ genre: data.genre, year: data.year })
      });
      onRefresh();
    } catch(e) {
       console.error("AI enrich failed", e);
    }
  };

  const filteredTracks = tracks.filter((t: Track) => !t.isDuplicateOf).filter((t: Track) => 
     t.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
     t.artist.toLowerCase().includes(searchTerm.toLowerCase()) ||
     t.genre.toLowerCase().includes(searchTerm.toLowerCase()) ||
     t.customTags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-6 pb-20">
      {/* Scan Bar */}
      <div className="flex gap-4 p-4 rounded-lg bg-card border border-border items-center">
        <FolderOpen className="w-5 h-5 text-muted-foreground shrink-0" />
        <input 
          type="text" 
          placeholder="Enter local absolute path to scan (e.g. C:\Music\DJ_Pack_1)" 
          className="flex-1 bg-transparent border-none focus:outline-none text-sm placeholder:text-muted-foreground"
          value={scanPath}
          onChange={(e) => setScanPath(e.target.value)}
        />
        <input 
          type="file" 
          id="directoryInput"
          // @ts-ignore
          webkitdirectory="true" 
          directory="true" 
          className="hidden"
          onChange={(e) => {
            const files = e.target.files;
            if (files && files.length > 0) {
              const file = files[0] as any;
              if (file.path) {
                const relativePath = file.webkitRelativePath;
                let dirPath = "";
                if (relativePath) {
                   const rootDirName = relativePath.split('/')[0];
                   const index = file.path.indexOf(relativePath);
                   if (index > -1) {
                      dirPath = file.path.substring(0, index + rootDirName.length);
                   } else {
                      // fallback for windows paths
                      const normalizedPath = file.path.replace(/\\/g, '/');
                      const indexWin = normalizedPath.indexOf(relativePath);
                      if(indexWin > -1) {
                         dirPath = file.path.substring(0, indexWin + rootDirName.length);
                      } else {
                         dirPath = file.path.replace(file.name, '');
                      }
                   }
                } else {
                   dirPath = file.path.replace(file.name, '');
                }
                setScanPath(dirPath);
              } else {
                alert("O seu navegador restringe o acesso ao caminho absoluto da pasta por motivos de segurança. Por favor, digite ou cole o caminho manualmente.");
              }
            }
          }}
        />
        <button 
          onClick={() => document.getElementById('directoryInput')?.click()}
          className="bg-secondary text-secondary-foreground px-4 py-2 rounded font-medium text-sm flex items-center gap-2 hover:bg-secondary/80 transition-colors"
        >
          Procurar...
        </button>
        <button 
          onClick={handleScan} disabled={scanning}
          className="bg-primary text-primary-foreground px-4 py-2 rounded font-medium text-sm disabled:opacity-50 flex items-center gap-2"
        >
          {scanning ? <RefreshCw className="w-4 h-4 animate-spin" /> : <FolderDown className="w-4 h-4" />}
          Scan Directory
        </button>
      </div>

      <div className="flex justify-between items-center">
         <input 
            type="text"
            placeholder="Search library, tags, genres..."
            className="w-80 px-4 py-2 rounded border border-border bg-background text-[13px] focus:outline-none focus:border-primary transition-colors text-foreground"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
         />
         <div className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{filteredTracks.length} tracks selected</div>
      </div>

      {/* Table */}
      <div className="rounded border border-border bg-card">
        <table className="w-full text-[13px] text-left">
          <thead className="text-[11px] uppercase tracking-wider text-muted-foreground bg-card border-b border-border">
            <tr>
              <th className="px-4 py-3 font-medium w-12"></th>
              <th className="px-4 py-3 font-medium">Title</th>
              <th className="px-4 py-3 font-medium">Artist</th>
              <th className="px-4 py-3 font-medium cursor-pointer flex-row">BPM / Key</th>
              <th className="px-4 py-3 font-medium">Genre / Year</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filteredTracks.map((t: Track) => (
              <tr key={t.id} className="hover:bg-muted/50 group transition-colors">
                <td className="px-4 py-3">
                   <button onClick={() => onPlay(t)} className="opacity-0 group-hover:opacity-100 p-1 bg-primary text-primary-foreground rounded-full transition-opacity">
                      {playingTrack?.id === t.id && isPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3 translate-x-px" />}
                   </button>
                </td>
                <td className="px-4 py-3 font-medium">
                   {t.title}
                   {t.customTags.length > 0 && <div className="flex gap-1 mt-1">{t.customTags.map(tag => <span key={tag} className="text-[10px] px-1.5 py-0.5 bg-accent text-accent-foreground rounded">{tag}</span>)}</div>}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{t.artist}</td>
                <td className="px-4 py-3">
                   <div className="flex gap-2 font-mono text-xs">
                     <span className={t.bpm ? "" : "opacity-30"}>{t.bpm || '--'}</span>
                     <span className="text-muted-foreground">/</span>
                     <span className={t.key ? "" : "opacity-30"}>{t.key || '--'}</span>
                   </div>
                </td>
                <td className="px-4 py-3">
                   {t.genre} {t.year && t.year !== "Unknown Year" ? `(${t.year})` : ""}
                   {(!t.genre || t.genre === "Unknown Genre" || !t.year || t.year === "Unknown Year") && (
                      <button onClick={() => handleAIEnrich(t)} className="ml-2 px-2 py-0.5 text-[10px] bg-primary/20 text-primary rounded border border-primary/30 hover:bg-primary/30 transition flex items-center inline-flex gap-1">
                         <Wand2 className="w-3 h-3" /> AI Suggest
                      </button>
                   )}
                </td>
                <td className="px-4 py-3 text-right">
                   <button onClick={() => setEditingTrack(t)} className="p-1.5 text-muted-foreground hover:bg-accent rounded transition">
                      <Settings className="w-4 h-4" />
                   </button>
                </td>
              </tr>
            ))}
            {filteredTracks.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">No tracks found. Scan a directory to begin.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {editingTrack && <TrackEditorModal track={editingTrack} onClose={() => setEditingTrack(null)} onRefresh={onRefresh} />}
    </div>
  );
}

function TrackEditorModal({ track, onClose, onRefresh }: { track: Track, onClose: () => void, onRefresh: () => void }) {
  const [title, setTitle] = useState(track.title);
  const [artist, setArtist] = useState(track.artist);
  const [genre, setGenre] = useState(track.genre);
  const [year, setYear] = useState(track.year);
  const [tags, setTags] = useState(track.customTags.join(", "));
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch(`/api/tracks/${track.id}/metadata`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ title, artist, genre, year })
      });
      await fetch(`/api/tracks/${track.id}/tags`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ tags: tags.split(',').map(t => t.trim()).filter(Boolean) })
      });
      onRefresh();
      onClose();
    } catch(e) {
      console.error(e);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
       <div className="bg-card w-full max-w-lg rounded-xl border border-border shadow-2xl p-6">
          <h2 className="text-xl font-bold mb-4">Edit Metadata</h2>
          
          <div className="space-y-4">
             <div>
                <label className="text-xs font-medium text-muted-foreground">Title</label>
                <input value={title} onChange={e => setTitle(e.target.value)} className="w-full mt-1 bg-background border border-border rounded px-3 py-2 text-sm focus:ring-1 focus:outline-none" />
             </div>
             <div>
                <label className="text-xs font-medium text-muted-foreground">Artist</label>
                <input value={artist} onChange={e => setArtist(e.target.value)} className="w-full mt-1 bg-background border border-border rounded px-3 py-2 text-sm focus:ring-1 focus:outline-none" />
             </div>
             <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Genre</label>
                  <input value={genre} onChange={e => setGenre(e.target.value)} className="w-full mt-1 bg-background border border-border rounded px-3 py-2 text-sm focus:ring-1 focus:outline-none" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Year</label>
                  <input value={year} onChange={e => setYear(e.target.value)} className="w-full mt-1 bg-background border border-border rounded px-3 py-2 text-sm focus:ring-1 focus:outline-none" />
                </div>
             </div>
             <div>
                <label className="text-xs font-medium text-primary">Custom Tags (comma separated)</label>
                <input value={tags} onChange={e => setTags(e.target.value)} className="w-full mt-1 bg-primary/10 border border-primary/30 rounded px-3 py-2 text-sm focus:ring-1 focus:outline-none font-mono" placeholder="e.g. Peak Time, Vocals, Needs EQ" />
             </div>
          </div>

          <div className="mt-6 flex justify-end gap-3">
             <button onClick={onClose} className="px-4 py-2 rounded text-sm text-muted-foreground hover:bg-muted">Cancel</button>
             <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-primary text-primary-foreground rounded text-sm font-medium">{saving ? "Saving..." : "Save Changes"}</button>
          </div>
       </div>
    </div>
  )
}

function OrganizeView({ tracks, history, onRefresh }: any) {
  const [baseDir, setBaseDir] = useState("");
  const [preview, setPreview] = useState<PreviewItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [organizing, setOrganizing] = useState(false);

  const fetchPreview = async () => {
    if(!baseDir) return;
    setLoading(true);
    try {
      const res = await fetch("/api/organize/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baseDir })
      });
      setPreview(await res.json());
    } catch(e) { console.error(e) }
    setLoading(false);
  };

  const handleExecute = async () => {
    setOrganizing(true);
    try {
      await fetch("/api/organize/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ moves: preview })
      });
      setPreview([]);
      setBaseDir("");
      onRefresh();
    } catch(e) { console.error(e) }
    setOrganizing(false);
  };

  const handleUndo = async (historyId: string) => {
    try {
       await fetch("/api/organize/undo", {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify({ historyId })
       });
       onRefresh();
    } catch(e) { console.error(e) }
  };

  return (
    <div className="space-y-6 pb-20 max-w-4xl">
       <div className="bg-card border border-border p-6 rounded-lg">
          <h3 className="text-lg font-bold flex items-center gap-2 mb-4"><FolderSync className="w-5 h-5 text-primary" /> Auto-Organize Files</h3>
          <p className="text-sm text-muted-foreground mb-4">
             Move your local MP3s into structured folders mapping <strong>[Decade] / [Genre] / Track.mp3</strong>. 
             Review the dry-run below before applying changes to your disk.
          </p>
          
          <div className="flex gap-4 items-end">
             <div className="flex-1">
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Target Base Directory</label>
                <input 
                  type="text" 
                  placeholder="e.g. C:\Music\Organized" 
                  className="w-full bg-background border border-input rounded px-3 py-2 text-sm"
                  value={baseDir}
                  onChange={(e) => setBaseDir(e.target.value)}
                />
             </div>
             <button onClick={fetchPreview} disabled={!baseDir || loading} className="px-4 py-2 bg-secondary text-secondary-foreground font-medium rounded text-sm disabled:opacity-50">
                {loading ? "Generating..." : "Generate Dry Run"}
             </button>
          </div>
       </div>

       {preview.length > 0 && (
         <div className="border border-primary/30 rounded-lg overflow-hidden bg-card animate-in fade-in slide-in-from-bottom-4">
            <div className="p-4 bg-primary/10 border-b border-primary/30 flex justify-between items-center">
               <div>
                 <h4 className="font-semibold text-primary">Dry Run Preview</h4>
                 <p className="text-xs text-muted-foreground">{preview.length} files will be moved.</p>
               </div>
               <div className="flex gap-2">
                 <button onClick={() => setPreview([])} className="px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted rounded">Cancel</button>
                 <button onClick={handleExecute} disabled={organizing} className="px-4 py-1.5 bg-primary text-black font-bold text-xs rounded flex gap-2 items-center">
                    {organizing ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} Apply Changes
                 </button>
               </div>
            </div>
            <div className="max-h-[400px] overflow-auto">
               <table className="w-full text-xs text-left">
                  <thead className="bg-muted text-muted-foreground"><tr><th className="p-3">Current Path</th><th className="p-3">Target Path</th></tr></thead>
                  <tbody className="divide-y divide-border font-mono text-[10px]">
                     {preview.slice(0, 100).map(p => (
                        <tr key={p.id}>
                           <td className="p-3 text-red-400/80 break-all">{p.oldPath}</td>
                           <td className="p-3 text-emerald-400/80 break-all">{p.newPath}</td>
                        </tr>
                     ))}
                     {preview.length > 100 && <tr><td colSpan={2} className="p-3 text-center text-muted-foreground">... and {preview.length - 100} more files</td></tr>}
                  </tbody>
               </table>
            </div>
         </div>
       )}

       {history && history.length > 0 && (
         <div className="bg-card border border-border p-6 rounded-lg mt-8">
            <h3 className="text-lg font-bold mb-4">Rollback History</h3>
            <div className="space-y-3">
               {history.map((h: any) => (
                  <div key={h.id} className="flex justify-between items-center p-3 border border-border rounded bg-muted/20">
                     <div>
                        <p className="text-sm font-medium">Session: {new Date(h.timestamp).toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">{h.moves.length} files organized.</p>
                     </div>
                     <button onClick={() => handleUndo(h.id)} className="flex items-center gap-2 px-3 py-1.5 bg-destructive/10 text-destructive text-xs font-semibold rounded hover:bg-destructive/20 transition">
                        <Undo className="w-3 h-3" /> Rollback
                     </button>
                  </div>
               ))}
            </div>
         </div>
       )}
    </div>
  );
}

function PlaylistsView({ playlists, tracks, onRefresh, onPlay, playingTrack }: any) {
  const [newPlaylistName, setNewPlaylistName] = useState("");

  const handleCreate = async () => {
    if(!newPlaylistName) return;
    try {
      await fetch('/api/playlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newPlaylistName, trackIds: [] })
      });
      setNewPlaylistName("");
      onRefresh();
    } catch(e) { console.error(e) }
  };

  const exportM3u8 = (pl: Playlist) => {
    window.open(`/api/playlists/${pl.id}/export`, "_blank");
  };

  return (
    <div className="space-y-6">
       <div className="flex justify-between items-center">
         <div className="flex gap-2">
           <input 
              value={newPlaylistName}
              onChange={e => setNewPlaylistName(e.target.value)}
              placeholder="Recordbox Set Name..." 
              className="px-3 py-2 bg-background border border-input rounded text-sm" 
           />
           <button onClick={handleCreate} className="bg-primary text-primary-foreground px-4 rounded text-sm font-medium flex items-center gap-2"><Plus className="w-4 h-4"/> Create</button>
         </div>
       </div>

       <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {playlists.map((pl: Playlist) => (
            <div key={pl.id} className="bg-card border border-border rounded-lg p-4 flex flex-col h-48">
               <div className="flex justify-between items-start mb-2">
                 <h3 className="font-bold text-lg">{pl.name}</h3>
                 <button onClick={() => exportM3u8(pl)} className="text-xs bg-primary/10 text-primary px-2 py-1 rounded border border-primary/20 hover:bg-primary/20 transition">Rekordbox M3U8</button>
               </div>
               <p className="text-xs text-muted-foreground mb-4">{pl.trackIds.length} tracks</p>
               
               <div className="flex-1 overflow-auto text-xs text-muted-foreground space-y-1">
                  {pl.trackIds.slice(0, 5).map(tid => {
                     const t = tracks.find((tr: Track) => tr.id === tid);
                     return t ? <div key={tid} className="truncate">• {t.artist} - {t.title}</div> : null;
                  })}
                  {pl.trackIds.length > 5 && <div>... and {pl.trackIds.length - 5} more</div>}
               </div>
            </div>
          ))}
          {playlists.length === 0 && <p className="text-muted-foreground text-sm col-span-3">No playlists yet. Create one for your next gig!</p>}
       </div>
    </div>
  );
}

function DuplicatesView({ tracks, onRefresh }: any) {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Duplicatas</h2>
      <p className="text-muted-foreground">O sistema detecta e consolida possíveis duplicatas automaticamente baseado em nome do artista e título da música (visíveis na organização).</p>
      <div className="bg-card p-8 rounded border border-border text-center text-sm text-muted-foreground">
        Aba de processamento manual em desenvolvimento.
      </div>
    </div>
  );
}

