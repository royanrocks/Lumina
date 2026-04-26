import { type ChangeEvent, type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import "./styles.css";

type AuthResponse = { token: string };

type Profile = {
  name: string | null;
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

type Screen = "checkin" | "connections" | "discover" | "quotes" | "profile";

const apiBase = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080/api";

const emptyProfile: Profile = {
  name: "",
  age: null,
  location: "",
  education: "",
  gender: "",
  personality_type: ""
};

const navItems: Array<{ id: Screen; label: string; icon: string }> = [
  { id: "checkin", label: "Check-in", icon: "●" },
  { id: "connections", label: "Silent", icon: "●" },
  { id: "discover", label: "Discover", icon: "●" },
  { id: "quotes", label: "Quotes", icon: "●" },
  { id: "profile", label: "Profile", icon: "●" }
];

function moodLabel(score: number | null) {
  if (score === null || score === undefined) return "No recent pulse";
  if (score >= 80) return "Radiant";
  if (score >= 60) return "Steady";
  if (score >= 40) return "Cloudy";
  return "Heavy";
}

function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function App() {
  const [screen, setScreen] = useState<Screen>("checkin");
  const [token, setToken] = useState("");
  const [phone, setPhone] = useState("+15550001111");
  const [otp, setOtp] = useState("123456");
  const [notice, setNotice] = useState("Welcome.");

  const [profile, setProfile] = useState<Profile>(emptyProfile);
  const [journalText, setJournalText] = useState("");
  const [imageText, setImageText] = useState("");
  const [photoPreview, setPhotoPreview] = useState("");
  const [lovedDay, setLovedDay] = useState(true);
  const [ocrBusy, setOcrBusy] = useState(false);
  const [pulseResult, setPulseResult] = useState<Checkin | null>(null);

  const [friends, setFriends] = useState<Friend[]>([]);
  const [friendPhone, setFriendPhone] = useState("");
  const [discovery, setDiscovery] = useState<DiscoveryRow[]>([]);
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);

  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  const headers = useMemo<Record<string, string>>(() => {
    const nextHeaders: Record<string, string> = {
      "Content-Type": "application/json"
    };
    if (token) nextHeaders.Authorization = `Bearer ${token}`;
    return nextHeaders;
  }, [token]);

  async function requestOtp(event: FormEvent) {
    event.preventDefault();
    const response = await fetch(`${apiBase}/auth/request-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone })
    });
    const payload = (await response.json()) as { devOtp?: string; error?: string };
    if (!response.ok) {
      setNotice(payload.error ?? "Could not send your code.");
      return;
    }
    setNotice(`Code sent. For this demo, use ${payload.devOtp}.`);
  }

  async function verifyOtp(event: FormEvent) {
    event.preventDefault();
    const response = await fetch(`${apiBase}/auth/verify-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, otp })
    });
    const payload = (await response.json()) as AuthResponse & { error?: string };
    if (!response.ok) {
      setNotice(payload.error ?? "That code did not match.");
      return;
    }
    setToken(payload.token);
    setNotice("You are in.");
  }

  async function loadAll() {
    if (!token) return;
    const [profileRes, friendsRes, discoveryRes, recRes] = await Promise.all([
      fetch(`${apiBase}/profile/me`, { headers }),
      fetch(`${apiBase}/social/friends`, { headers }),
      fetch(`${apiBase}/social/discovery`, { headers }),
      fetch(`${apiBase}/support/recommendation`, { headers })
    ]);

    if (!profileRes.ok || !friendsRes.ok || !discoveryRes.ok || !recRes.ok) {
      setNotice("Something did not load. Please try again.");
      return;
    }

    const profileData = (await profileRes.json()) as { profile: Profile };
    const friendsData = (await friendsRes.json()) as { friends: Friend[] };
    const discoveryData = (await discoveryRes.json()) as { discovery: DiscoveryRow[] };
    const recData = (await recRes.json()) as { recommendation: Recommendation };

    setProfile({ ...emptyProfile, ...profileData.profile });
    setFriends(friendsData.friends);
    setDiscovery(discoveryData.discovery);
    setRecommendation(recData.recommendation);
  }

  async function saveProfile(event: FormEvent) {
    event.preventDefault();
    const response = await fetch(`${apiBase}/profile/me`, {
      method: "PUT",
      headers,
      body: JSON.stringify({
        ...profile,
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
        lovedDay
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
      body: JSON.stringify({ phone: friendPhone })
    });
    const payload = (await response.json()) as { error?: string };
    if (!response.ok) {
      setNotice(payload.error ?? "Could not add this number.");
      return;
    }
    setFriendPhone("");
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
      setNotice(extracted ? "Notebook text added." : "No text found. Try another angle.");
    } finally {
      setOcrBusy(false);
      event.target.value = "";
    }
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
            <h2>Sign in</h2>
            <p className="subtle">Enter your phone to continue.</p>
            <form onSubmit={requestOtp} className="stack">
              <label>
                Phone
                <input value={phone} onChange={(e) => setPhone(e.target.value)} required />
              </label>
              <button type="submit" className="primary">
                Send code
              </button>
            </form>
            <form onSubmit={verifyOtp} className="stack">
              <label>
                Verification code
                <input value={otp} onChange={(e) => setOtp(e.target.value)} required />
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
                      Journal
                      <textarea
                        rows={5}
                        value={journalText}
                        onChange={(e) => setJournalText(e.target.value)}
                        placeholder="How did your day feel?"
                      />
                    </label>
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => cameraInputRef.current?.click()}
                      disabled={ocrBusy}
                    >
                      {ocrBusy ? "Reading notebook..." : "Scan notebook page"}
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
                    <label>
                      Notebook text
                      <textarea
                        rows={4}
                        value={imageText}
                        onChange={(e) => setImageText(e.target.value)}
                        placeholder="Scanned text appears here."
                      />
                    </label>
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
                      <p className={`pill ${pulseResult.risk_band}`}>{pulseResult.risk_band} risk</p>
                      <p>{pulseResult.sentiment_summary}</p>
                      <p className="quote">"{pulseResult.quote}"</p>
                    </article>
                  ) : null}
                </>
              ) : null}

              {screen === "connections" ? (
                <>
                  <h2>Silent Connection</h2>
                  <p className="subtle">Show support without pressure.</p>
                  <form onSubmit={addFriend} className="stack">
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
                  </form>
                  <div className="list">
                    {friends.map((friend) => (
                      <article key={friend.id} className="row">
                        <div>
                          <p className="name">
                            <span className="orb" style={{ backgroundColor: friend.mood_color }} />
                            {friend.name}
                          </p>
                          <p className="subtle">{moodLabel(friend.latest_score)}</p>
                        </div>
                        <button type="button" className="secondary" onClick={() => sendNudge(friend.id)}>
                          Nudge
                        </button>
                      </article>
                    ))}
                    {friends.length === 0 ? <p className="subtle">No friends yet.</p> : null}
                  </div>
                </>
              ) : null}

              {screen === "discover" ? (
                <>
                  <h2>Global Discovery</h2>
                  <p className="subtle">A leaderboard of quiet support.</p>
                  <div className="list">
                    {discovery.map((row, index) => (
                      <article key={row.id} className="row">
                        <p className="name">
                          #{index + 1}
                          <span className="orb" style={{ backgroundColor: row.mood_color }} />
                          {row.name}
                        </p>
                        <strong>{row.altruism_score}</strong>
                      </article>
                    ))}
                  </div>
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
                      Age
                      <input
                        type="number"
                        value={profile.age ?? ""}
                        onChange={(e) => setProfile({ ...profile, age: e.target.value ? Number(e.target.value) : null })}
                      />
                    </label>
                    <label>
                      Location
                      <input
                        value={profile.location ?? ""}
                        onChange={(e) => setProfile({ ...profile, location: e.target.value })}
                      />
                    </label>
                    <label>
                      Education
                      <input
                        value={profile.education ?? ""}
                        onChange={(e) => setProfile({ ...profile, education: e.target.value })}
                      />
                    </label>
                    <label>
                      Gender
                      <input value={profile.gender ?? ""} onChange={(e) => setProfile({ ...profile, gender: e.target.value })} />
                    </label>
                    <label>
                      Personality type
                      <input
                        value={profile.personality_type ?? ""}
                        onChange={(e) => setProfile({ ...profile, personality_type: e.target.value })}
                      />
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
