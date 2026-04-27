import { type ChangeEvent, type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import "./styles.css";

type AuthResponse = { token: string };
type TimeView = "day" | "week" | "month";
type Screen = "checkin" | "quotes" | "calendar" | "discover" | "profile";

type Profile = {
  id: string | null;
  name: string | null;
  birthday: string | null;
  age: number | null;
  location: string | null;
  education: string | null;
  gender: string | null;
  personality_type: string | null;
};

type Friend = {
  id: string;
  name: string;
  phone: string;
  mood_color: string;
  latest_score: number | null;
};

type DiscoveryRow = {
  id: string;
  name: string;
  mood_color: string;
  latest_score: number | null;
  altruism_score: number;
};

type Recommendation = {
  quote: string;
  source: string;
  action: string;
  professionalBridge: boolean;
};

type Checkin = {
  fulfillment_score: number;
  risk_band: "low" | "medium" | "high";
  sentiment_summary: string;
  quote: string;
};

type MoodHistoryItem = {
  id: string;
  label: string;
  score: number;
  color: string;
  note: string | null;
};

type NotificationItem = {
  id: string;
  senderName: string;
  type: string;
  createdAt: string;
  read: boolean;
};

const apiBase = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080/api";

const emptyProfile: Profile = {
  id: null,
  name: "",
  birthday: "",
  age: null,
  location: "",
  education: "",
  gender: "",
  personality_type: ""
};

const navItems: Array<{ id: Screen; label: string; icon: string }> = [
  { id: "checkin", label: "Check-in", icon: "●" },
  { id: "quotes", label: "Quotes", icon: "●" },
  { id: "calendar", label: "Calendar", icon: "●" },
  { id: "discover", label: "Discover", icon: "●" },
  { id: "profile", label: "Profile", icon: "●" }
];

const checkinBandLabel: Record<Checkin["risk_band"], string> = {
  low: "gentle zone",
  medium: "steady zone",
  high: "extra-care zone"
};

const mbtiOptions = [
  "INTJ",
  "INTP",
  "ENTJ",
  "ENTP",
  "INFJ",
  "INFP",
  "ENFJ",
  "ENFP",
  "ISTJ",
  "ISFJ",
  "ESTJ",
  "ESFJ",
  "ISTP",
  "ISFP",
  "ESTP",
  "ESFP"
];

const broaderPersonalityOptions = [
  "Big Five - Balanced",
  "Big Five - Openness-led",
  "Big Five - Conscientiousness-led",
  "Big Five - Extraversion-led",
  "Big Five - Agreeableness-led",
  "Big Five - Emotional sensitivity-led",
  "Enneagram 1 - Reformer",
  "Enneagram 2 - Helper",
  "Enneagram 3 - Achiever",
  "Enneagram 4 - Individualist",
  "Enneagram 5 - Investigator",
  "Enneagram 6 - Loyalist",
  "Enneagram 7 - Enthusiast",
  "Enneagram 8 - Challenger",
  "Enneagram 9 - Peacemaker",
  "Attachment - Secure",
  "Attachment - Anxious",
  "Attachment - Avoidant",
  "Attachment - Fearful-avoidant",
  "Still exploring"
];

function moodLabel(score: number | null) {
  if (score === null || score === undefined) return "No recent pulse";
  if (score >= 80) return "Radiant";
  if (score >= 60) return "Steady";
  if (score >= 40) return "Cloudy";
  return "Heavy";
}

function colorToMoodText(color: string) {
  if (color === "#FFD700") return "Radiant";
  if (color === "#F4A261") return "Steady";
  if (color === "#5DA9E9") return "Needs support";
  return "No recent pulse";
}

function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleString();
}

function App() {
  const [screen, setScreen] = useState<Screen>("checkin");
  const [token, setToken] = useState("");
  const [phone, setPhone] = useState("+15550001111");
  const [notice, setNotice] = useState("Welcome.");

  const [profile, setProfile] = useState<Profile>(emptyProfile);
  const [journalText, setJournalText] = useState("");
  const [imageText, setImageText] = useState("");
  const [photoPreview, setPhotoPreview] = useState("");
  const [lovedDay, setLovedDay] = useState(true);
  const [moodScore, setMoodScore] = useState(55);
  const [ocrBusy, setOcrBusy] = useState(false);
  const [pulseResult, setPulseResult] = useState<Checkin | null>(null);
  const [historyView, setHistoryView] = useState<TimeView>("day");
  const [history, setHistory] = useState<Record<TimeView, MoodHistoryItem[]>>({
    day: [],
    week: [],
    month: []
  });
  const [discoverMenu, setDiscoverMenu] = useState<"leaderboard" | "friends">("leaderboard");

  const [friends, setFriends] = useState<Friend[]>([]);
  const [friendPhone, setFriendPhone] = useState("");
  const [friendName, setFriendName] = useState("");
  const [discovery, setDiscovery] = useState<DiscoveryRow[]>([]);
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const contactInputRef = useRef<HTMLInputElement | null>(null);
  const [showScanStep, setShowScanStep] = useState(false);
  const [scanDone, setScanDone] = useState(false);

  const headers = useMemo<Record<string, string>>(() => {
    const nextHeaders: Record<string, string> = {
      "Content-Type": "application/json"
    };
    if (token) nextHeaders.Authorization = `Bearer ${token}`;
    return nextHeaders;
  }, [token]);

  async function signInWithPhone(event: FormEvent) {
    event.preventDefault();
    const response = await fetch(`${apiBase}/auth/phone-signin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone })
    });
    const payload = (await response.json()) as AuthResponse & { error?: string };
    if (!response.ok) {
      setNotice(payload.error ?? "Could not continue with that phone number.");
      return;
    }
    setToken(payload.token);
    setNotice("You are in.");
  }

  async function loadAll() {
    if (!token) return;
    const [profileRes, friendsRes, discoveryRes, recRes, historyRes, notificationsRes] = await Promise.all([
      fetch(`${apiBase}/profile/me`, { headers }),
      fetch(`${apiBase}/social/friends`, { headers }),
      fetch(`${apiBase}/social/discovery`, { headers }),
      fetch(`${apiBase}/support/recommendation`, { headers }),
      fetch(`${apiBase}/pulse/history`, { headers }),
      fetch(`${apiBase}/social/notifications`, { headers })
    ]);

    if (!profileRes.ok || !friendsRes.ok || !discoveryRes.ok || !recRes.ok || !historyRes.ok || !notificationsRes.ok) {
      setNotice("Something did not load. Please try again.");
      return;
    }

    const profileData = (await profileRes.json()) as { profile: Profile };
    const friendsData = (await friendsRes.json()) as { friends: Friend[] };
    const discoveryData = (await discoveryRes.json()) as { discovery: DiscoveryRow[] };
    const recData = (await recRes.json()) as { recommendation: Recommendation };
    const historyData = (await historyRes.json()) as {
      day: Array<{ timestamp: string; score: number; color: string; note: string | null }>;
      week: Array<{ label: string; score: number; color: string; note: string | null }>;
      month: Array<{ label: string; score: number; color: string; note: string | null }>;
    };
    const notificationsData = (await notificationsRes.json()) as { notifications: NotificationItem[] };

    setProfile({ ...emptyProfile, ...profileData.profile });
    setFriends(friendsData.friends);
    setDiscovery(discoveryData.discovery);
    setRecommendation(recData.recommendation);
    setHistory({
      day: historyData.day.map((item) => ({
        id: `day-${item.timestamp}`,
        label: formatTime(item.timestamp),
        score: item.score,
        color: item.color,
        note: item.note
      })),
      week: historyData.week.map((item) => ({
        id: `week-${item.label}`,
        label: item.label,
        score: item.score,
        color: item.color,
        note: item.note
      })),
      month: historyData.month.map((item) => ({
        id: `month-${item.label}`,
        label: item.label,
        score: item.score,
        color: item.color,
        note: item.note
      }))
    });
    setNotifications(notificationsData.notifications);
  }

  async function markNotificationsRead() {
    await fetch(`${apiBase}/social/notifications/read-all`, {
      method: "POST",
      headers
    });
    await loadAll();
  }

  async function saveProfile(event: FormEvent) {
    event.preventDefault();
    const response = await fetch(`${apiBase}/profile/me`, {
      method: "PUT",
      headers,
      body: JSON.stringify({
        ...profile,
        birthDate: profile.birthday,
        personalityType: profile.personality_type
      })
    });
    const payload = await response.json();
    if (!response.ok) {
      setNotice(payload.error ?? "Could not update profile right now.");
      return;
    }
    setProfile({ ...emptyProfile, ...(payload.profile as Profile) });
    setNotice("Profile saved.");
  }

  async function submitPulse(event: FormEvent) {
    event.preventDefault();
    const response = await fetch(`${apiBase}/pulse/checkin`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        journalText,
        imageText: imageText || undefined,
        lovedDay,
        moodScore
      })
    });
    const payload = (await response.json()) as { checkin?: Checkin; error?: string };
    if (!response.ok) {
      setNotice(payload.error ?? "Your check-in could not be saved.");
      return;
    }
    setPulseResult(payload.checkin ?? null);
    setNotice("Check-in saved.");
    await loadAll();
  }

  async function addFriend(event: FormEvent) {
    event.preventDefault();
    const response = await fetch(`${apiBase}/social/friends/add`, {
      method: "POST",
      headers,
      body: JSON.stringify({ phone: friendPhone, nickname: friendName })
    });
    const payload = (await response.json()) as { error?: string };
    if (!response.ok) {
      setNotice(payload.error ?? "Could not add this number.");
      return;
    }
    setFriendPhone("");
    setFriendName("");
    setNotice("Friend added.");
    await loadAll();
  }

  async function sendNudge(friendId: string) {
    const response = await fetch(`${apiBase}/social/nudge`, {
      method: "POST",
      headers,
      body: JSON.stringify({ friendId })
    });
    const payload = (await response.json()) as { message?: string; error?: string };
    if (!response.ok) {
      setNotice(payload.error ?? "Could not send support right now.");
      return;
    }
    setNotice(payload.message ?? "Support sent.");
    await loadAll();
  }

  async function handlePhotoSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setOcrBusy(true);
    try {
      const base64 = await toBase64(file);
      setPhotoPreview(base64);
      const response = await fetch(`${apiBase}/pulse/ocr`, {
        method: "POST",
        headers,
        body: JSON.stringify({ imageBase64: base64 })
      });
      const payload = (await response.json()) as { text?: string; error?: string };
      if (!response.ok) {
        setNotice(payload.error ?? "Could not read that photo.");
        return;
      }
      const extracted = (payload.text ?? "").trim();
      setImageText(extracted);
      setScanDone(true);
      setNotice(extracted ? "Notebook text added." : "No text found. Try another angle.");
    } finally {
      setOcrBusy(false);
      event.target.value = "";
    }
  }

  async function sendDiscoveryThumbsUp(receiverId: string) {
    const response = await fetch(`${apiBase}/social/discovery/nudge`, {
      method: "POST",
      headers,
      body: JSON.stringify({ receiverId })
    });
    const payload = (await response.json()) as { message?: string; error?: string };
    if (!response.ok) {
      setNotice(payload.error ?? "Could not send thumbs-up.");
      return;
    }
    setNotice(payload.message ?? "Thumbs-up sent.");
    await loadAll();
  }

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setNotice("Location is not supported on this device.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        const fallback = `${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`;
        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${coords.latitude}&lon=${coords.longitude}`
          );
          const payload = (await response.json()) as { display_name?: string };
          setProfile((prev) => ({ ...prev, location: payload.display_name ?? fallback }));
        } catch {
          setProfile((prev) => ({ ...prev, location: fallback }));
        }
      },
      () => setNotice("Could not access location. You can still type it manually.")
    );
  }

  function importContact(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      const lines = text.split(/\r?\n/);
      const nameLine = lines.find((line) => line.startsWith("FN:"));
      const phoneLine = lines.find((line) => line.includes("TEL"));
      const importedName = nameLine ? nameLine.replace("FN:", "").trim() : "";
      const importedPhone = phoneLine ? phoneLine.split(":").pop()?.trim() ?? "" : "";
      if (importedName) setFriendName(importedName);
      if (importedPhone) setFriendPhone(importedPhone);
      setNotice(importedPhone ? "Contact imported." : "Could not read phone from contact card.");
      event.target.value = "";
    };
    reader.readAsText(file);
  }

  useEffect(() => {
    loadAll().catch(() => setNotice("Something did not load. Please try again."));
    // Reload app data after auth.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <main className="app-shell">
      <div className="app-surface">
        <header className="app-header">
          <div>
            <h1>Lumina</h1>
            <p>Simple, private emotional check-ins.</p>
          </div>
          <span className="header-orb" />
        </header>

        {!token ? (
          <section className="page auth-page">
            <h2>Welcome</h2>
            <p className="subtle">Use your phone number to create or open your account.</p>
            <form onSubmit={signInWithPhone} className="stack">
              <label>
                Phone
                <input value={phone} onChange={(e) => setPhone(e.target.value)} required />
              </label>
              <button type="submit" className="primary">
                Continue
              </button>
            </form>
          </section>
        ) : (
          <>
            <section className="page">
              {screen === "checkin" ? (
                <>
                  <h2>Daily Check-in</h2>
                  <p className="subtle">Write what mattered today, then reflect.</p>
                  <form onSubmit={submitPulse} className="stack">
                    <label>
                      Mood score ({moodScore}/100)
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={moodScore}
                        onChange={(e) => setMoodScore(Number(e.target.value))}
                      />
                    </label>
                    <label>
                      Journal
                      <textarea
                        rows={5}
                        value={journalText}
                        onChange={(e) => setJournalText(e.target.value)}
                        placeholder="How did your day feel?"
                      />
                    </label>
                    {!showScanStep ? (
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => {
                          setShowScanStep(true);
                          setScanDone(false);
                        }}
                      >
                        Scan notebook page
                      </button>
                    ) : (
                      <div className="flow-card">
                        <div className="flow-head">
                          <p className="flow-title">Notebook scan</p>
                          <p className="flow-sub">Choose a photo first, then review extracted text.</p>
                        </div>
                        <button
                          type="button"
                          className="secondary"
                          onClick={() => cameraInputRef.current?.click()}
                          disabled={ocrBusy}
                        >
                          {ocrBusy ? "Reading notebook..." : "Choose notebook photo"}
                        </button>
                        <input
                          ref={cameraInputRef}
                          type="file"
                          accept="image/*"
                          capture="environment"
                          onChange={handlePhotoSelected}
                          className="hidden"
                        />
                        {photoPreview ? <img className="preview" src={photoPreview} alt="Notebook preview" /> : null}
                        {scanDone ? (
                          <label>
                            Notebook text
                            <textarea
                              rows={4}
                              value={imageText}
                              onChange={(e) => setImageText(e.target.value)}
                              placeholder="Scanned text appears here."
                            />
                          </label>
                        ) : (
                          <p className="subtle">After upload, scanned text appears here.</p>
                        )}
                      </div>
                    )}
                    <label className="toggle">
                      <input type="checkbox" checked={lovedDay} onChange={(e) => setLovedDay(e.target.checked)} />
                      I loved my day
                    </label>
                    <button type="submit" className="primary">
                      Save check-in
                    </button>
                  </form>
                  {pulseResult ? (
                    <article className="card">
                      <p className="score">{pulseResult.fulfillment_score}/100</p>
                      <p className={`chip ${pulseResult.risk_band}`}>{checkinBandLabel[pulseResult.risk_band]}</p>
                      <p>{pulseResult.sentiment_summary}</p>
                      <p className="quote">"{pulseResult.quote}"</p>
                    </article>
                  ) : null}

                  <article className="card">
                    <div className="row">
                      <h3>Mood Timeline</h3>
                      <div className="row-right">
                        {(["day", "week", "month"] as TimeView[]).map((view) => (
                          <button
                            key={view}
                            type="button"
                            className={historyView === view ? "primary compact" : "secondary compact"}
                            onClick={() => setHistoryView(view)}
                          >
                            {view}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="list">
                      {history[historyView].map((entry) => (
                        <article className="row" key={entry.id}>
                          <p className="name">
                            <span className="orb" style={{ backgroundColor: entry.color }} />
                            {entry.label}
                          </p>
                          <span className="badge">{entry.score}</span>
                        </article>
                      ))}
                      {history[historyView].length === 0 ? <p className="subtle">No entries yet.</p> : null}
                    </div>
                  </article>
                </>
              ) : null}

              {screen === "discover" ? (
                <>
                  <h2>Global Discovery</h2>
                  <p className="subtle">Discover community mood and support your circle.</p>
                  <div className="history-tabs">
                    <button
                      type="button"
                      className={`history-tab ${discoverMenu === "leaderboard" ? "active" : ""}`}
                      onClick={() => setDiscoverMenu("leaderboard")}
                    >
                      Leaderboard
                    </button>
                    <button
                      type="button"
                      className={`history-tab ${discoverMenu === "friends" ? "active" : ""}`}
                      onClick={() => setDiscoverMenu("friends")}
                    >
                      Add Friend
                    </button>
                  </div>

                  {discoverMenu === "leaderboard" ? (
                    <div className="list">
                      {discovery.map((row, index) => (
                          <article key={row.id} className="row">
                            <div>
                              <p className="name">
                                #{index + 1}
                                <span className="orb" style={{ backgroundColor: row.mood_color }} />
                                {row.id === profile.id ? "You" : row.name}
                              </p>
                              <p className="row-sub">
                                {colorToMoodText(row.mood_color)}
                                {row.latest_score !== null ? ` · ${row.latest_score}/100` : ""}
                              </p>
                            </div>
                            <div className="row-right">
                              <strong>{row.altruism_score}</strong>
                              <button
                                type="button"
                                className="secondary compact"
                                onClick={() => sendDiscoveryThumbsUp(row.id)}
                                disabled={row.id === profile.id}
                                title={row.id === profile.id ? "You cannot thumbs-up yourself." : "Send daily thumbs-up"}
                              >
                                👍 Daily
                              </button>
                            </div>
                          </article>
                        ))}
                    </div>
                  ) : (
                    <>
                      <form onSubmit={addFriend} className="stack">
                        <label>
                          Friend name
                          <input
                            value={friendName}
                            onChange={(e) => setFriendName(e.target.value)}
                            placeholder="e.g., Maya"
                          />
                        </label>
                        <label>
                          Add friend by phone
                          <input
                            value={friendPhone}
                            onChange={(e) => setFriendPhone(e.target.value)}
                            placeholder="+15550001234"
                          />
                        </label>
                        <button type="submit" className="primary">
                          Add friend
                        </button>
                        <button type="button" className="secondary" onClick={() => contactInputRef.current?.click()}>
                          Import contact card (.vcf)
                        </button>
                        <input
                          ref={contactInputRef}
                          type="file"
                          accept=".vcf,text/vcard"
                          onChange={importContact}
                          className="hidden"
                        />
                      </form>
                      <div className="list">
                        {friends.map((friend) => (
                          <article key={friend.id} className="row">
                            <div>
                              <p className="name">
                                <span className="orb" style={{ backgroundColor: friend.mood_color }} />
                                {friend.name}
                              </p>
                              <p className="row-sub">{moodLabel(friend.latest_score)}</p>
                            </div>
                            <button type="button" className="secondary" onClick={() => sendNudge(friend.id)}>
                              Nudge
                            </button>
                          </article>
                        ))}
                        {friends.length === 0 ? <p className="subtle">No friends yet.</p> : null}
                      </div>
                    </>
                  )}
                </>
              ) : null}

              {screen === "quotes" ? (
                <>
                  <h2>Daily Quote</h2>
                  <p className="subtle">A gentle thought for your next step.</p>
                  {recommendation ? (
                    <article className="card">
                      <p className="quote">"{recommendation.quote}"</p>
                      <p className="subtle">— {recommendation.source}</p>
                      <p>{recommendation.action}</p>
                      {recommendation.professionalBridge ? (
                        <button type="button" className="secondary danger">
                          Connect to a professional
                        </button>
                      ) : null}
                    </article>
                  ) : (
                    <p className="subtle">Complete a check-in to unlock this page.</p>
                  )}

                  <article className="card">
                    <div className="row">
                      <h3>Thumbs-up notifications</h3>
                      <button type="button" className="secondary compact" onClick={markNotificationsRead}>
                        Mark all read
                      </button>
                    </div>
                    <div className="list">
                      {notifications.map((n) => (
                        <article key={n.id} className="row">
                          <div>
                            <p className="name">
                              {n.senderName} sent a {n.type === "discovery_nudge" ? "discovery" : "friend"} thumbs-up
                            </p>
                            <p className="row-sub">{formatTime(n.createdAt)}</p>
                          </div>
                          {!n.read ? <span className="badge">new</span> : null}
                        </article>
                      ))}
                      {notifications.length === 0 ? <p className="subtle">No notifications yet.</p> : null}
                    </div>
                  </article>
                </>
              ) : null}

              {screen === "calendar" ? (
                <>
                  <h2>Mood Calendar</h2>
                  <p className="subtle">Tap between day, week, and month to see color + journal history.</p>
                  <div className="history-tabs">
                    {(["day", "week", "month"] as TimeView[]).map((view) => (
                      <button
                        key={view}
                        type="button"
                        className={`history-tab ${historyView === view ? "active" : ""}`}
                        onClick={() => setHistoryView(view)}
                      >
                        {view}
                      </button>
                    ))}
                  </div>
                  <div className="history-list">
                    {history[historyView].map((entry) => (
                      <article className="history-item" key={entry.id}>
                        <div className="history-left">
                          <span className="history-dot" style={{ backgroundColor: entry.color }} />
                          <div>
                            <p className="name">{entry.label}</p>
                            <p className="row-sub">{entry.note || "No journal note captured."}</p>
                          </div>
                        </div>
                        <span className="badge">{entry.score}</span>
                      </article>
                    ))}
                    {history[historyView].length === 0 ? <p className="subtle">No entries yet.</p> : null}
                  </div>
                </>
              ) : null}

              {screen === "profile" ? (
                <>
                  <h2>Profile</h2>
                  <p className="subtle">Keep this updated so Lumina can adapt to you.</p>
                  <form onSubmit={saveProfile} className="stack">
                    <label>
                      Name
                      <input value={profile.name ?? ""} onChange={(e) => setProfile({ ...profile, name: e.target.value })} />
                    </label>
                    <label>
                      Birthday
                      <input
                        type="date"
                        value={profile.birthday ?? ""}
                        onChange={(e) => setProfile({ ...profile, birthday: e.target.value })}
                      />
                    </label>
                    <p className="subtle">Age: {profile.age ?? "—"}</p>
                    <label>
                      Location
                      <input
                        value={profile.location ?? ""}
                        onChange={(e) => setProfile({ ...profile, location: e.target.value })}
                      />
                    </label>
                    <button type="button" className="secondary" onClick={useCurrentLocation}>
                      Use current location
                    </button>
                    <label>
                      Education
                      <select
                        value={profile.education ?? ""}
                        onChange={(e) => setProfile({ ...profile, education: e.target.value })}
                      >
                        <option value="">Select education</option>
                        <option value="High School">High School</option>
                        <option value="Undergraduate">Undergraduate</option>
                        <option value="Graduate">Graduate</option>
                        <option value="Postgraduate">Postgraduate</option>
                        <option value="Self-taught">Self-taught</option>
                        <option value="Prefer not to say">Prefer not to say</option>
                      </select>
                    </label>
                    <label>
                      Gender
                      <select
                        value={profile.gender ?? ""}
                        onChange={(e) => setProfile({ ...profile, gender: e.target.value })}
                      >
                        <option value="">Select gender</option>
                        <option value="Woman">Woman</option>
                        <option value="Man">Man</option>
                        <option value="Non-binary">Non-binary</option>
                        <option value="Prefer not to say">Prefer not to say</option>
                      </select>
                    </label>
                    <label>
                      Personality type
                      <select
                        value={profile.personality_type ?? ""}
                        onChange={(e) => setProfile({ ...profile, personality_type: e.target.value })}
                      >
                        <option value="">Select type</option>
                        <optgroup label="MBTI">
                          {mbtiOptions.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </optgroup>
                        <optgroup label="Other personality frameworks">
                          {broaderPersonalityOptions.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </optgroup>
                      </select>
                    </label>
                    <button type="submit" className="primary">
                      Save profile
                    </button>
                  </form>
                </>
              ) : null}
            </section>

            <nav className="bottom-nav">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`tab ${screen === item.id ? "active" : ""}`}
                  onClick={() => setScreen(item.id)}
                >
                  <span className="dot">{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              ))}
            </nav>
          </>
        )}

        <footer className="notice">{notice}</footer>
      </div>
    </main>
  );
}

export default App;
