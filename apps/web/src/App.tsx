import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import "./styles.css";

type AuthResponse = {
  token: string;
};

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
  id: string;
  fulfillment_score: number;
  risk_band: "low" | "medium" | "high";
  sentiment_summary: string;
  love_today: boolean;
  mood_color: string;
  created_at: string;
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

function moodLabel(score: number | null) {
  if (score === null || score === undefined) return "No pulse yet";
  if (score >= 80) return "Radiant";
  if (score >= 60) return "Steady";
  if (score >= 40) return "Cloudy";
  return "Stormy";
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
  const [token, setToken] = useState<string>("");
  const [phone, setPhone] = useState("+15550001111");
  const [otp, setOtp] = useState("123456");
  const [profile, setProfile] = useState<Profile>(emptyProfile);
  const [journalText, setJournalText] = useState("");
  const [imageText, setImageText] = useState("");
  const [photoPreview, setPhotoPreview] = useState<string>("");
  const [lovedDay, setLovedDay] = useState(true);
  const [pulseResult, setPulseResult] = useState<Checkin | null>(null);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [discovery, setDiscovery] = useState<DiscoveryRow[]>([]);
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const [friendPhone, setFriendPhone] = useState("");
  const [status, setStatus] = useState("Welcome to Lumina.");
  const [ocrBusy, setOcrBusy] = useState(false);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  const headers = useMemo<Record<string, string>>(() => {
    const nextHeaders: Record<string, string> = {
      "Content-Type": "application/json"
    };
    if (token) {
      nextHeaders.Authorization = `Bearer ${token}`;
    }
    return nextHeaders;
  }, [token]);

  async function requestOtp(event: FormEvent) {
    event.preventDefault();
    setStatus("Requesting OTP...");
    const response = await fetch(`${apiBase}/auth/request-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone })
    });
    const payload = await response.json();
    if (!response.ok) {
      setStatus(payload.error ?? "Failed to request OTP.");
      return;
    }
    setStatus(`OTP generated. Dev code: ${payload.devOtp}`);
  }

  async function verifyOtp(event: FormEvent) {
    event.preventDefault();
    setStatus("Verifying OTP...");
    const response = await fetch(`${apiBase}/auth/verify-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, otp })
    });
    const payload = (await response.json()) as AuthResponse & { error?: string };
    if (!response.ok) {
      setStatus(payload.error ?? "OTP verification failed.");
      return;
    }
    setToken(payload.token);
    setStatus("Authenticated. Your space is loading.");
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
      setStatus("Unable to load data.");
      return;
    }

    const profileData = (await profileRes.json()) as { profile: Profile };
    const friendsData = (await friendsRes.json()) as { friends: Friend[] };
    const discoveryData = (await discoveryRes.json()) as { discovery: DiscoveryRow[] };
    const recData = (await recRes.json()) as { recommendation: Recommendation };

    setProfile({
      ...emptyProfile,
      ...profileData.profile
    });
    setFriends(friendsData.friends);
    setDiscovery(discoveryData.discovery);
    setRecommendation(recData.recommendation);
    setStatus("Synced.");
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
      setStatus(payload.error ?? "Failed to save profile.");
      return;
    }
    setProfile({
      ...emptyProfile,
      ...(payload.profile as Profile)
    });
    setStatus("Profile updated.");
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
    const payload = await response.json();
    if (!response.ok) {
      setStatus(payload.error ?? "Pulse check-in failed.");
      return;
    }
    setPulseResult(payload.checkin as Checkin);
    setStatus("Pulse check-in complete.");
    await loadAll();
  }

  async function addFriend(event: FormEvent) {
    event.preventDefault();
    const response = await fetch(`${apiBase}/social/friends/add`, {
      method: "POST",
      headers,
      body: JSON.stringify({ phone: friendPhone })
    });
    const payload = await response.json();
    if (!response.ok) {
      setStatus(payload.error ?? "Unable to add friend.");
      return;
    }
    setStatus("Friend added.");
    setFriendPhone("");
    await loadAll();
  }

  async function sendNudge(friendId: string) {
    const response = await fetch(`${apiBase}/social/nudge`, {
      method: "POST",
      headers,
      body: JSON.stringify({ friendId })
    });
    const payload = await response.json();
    if (!response.ok) {
      setStatus(payload.error ?? "Unable to send nudge.");
      return;
    }
    setStatus(payload.message || "Nudge sent.");
    await loadAll();
  }

  async function handlePhotoSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setStatus("Processing notebook photo...");
    setOcrBusy(true);
    try {
      const base64 = await toBase64(file);
      setPhotoPreview(base64);

      const response = await fetch(`${apiBase}/pulse/ocr`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          imageBase64: base64
        })
      });
      const payload = (await response.json()) as { text?: string; error?: string };
      if (!response.ok) {
        setStatus(payload.error ?? "Failed to extract notebook text.");
        return;
      }
      setImageText((payload.text ?? "").trim());
      setStatus(payload.text ? "Notebook scanned. You can edit extracted text." : "No text found. Try a clearer photo.");
    } finally {
      setOcrBusy(false);
      event.target.value = "";
    }
  }

  useEffect(() => {
    loadAll().catch(() => setStatus("Unable to load data."));
    // Refresh app data once authenticated.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const navItems: Array<{ id: Screen; label: string; icon: string }> = [
    { id: "checkin", label: "Check-in", icon: "☀️" },
    { id: "connections", label: "Silent", icon: "💛" },
    { id: "discover", label: "Discovery", icon: "🌍" },
    { id: "quotes", label: "Quotes", icon: "📖" },
    { id: "profile", label: "Profile", icon: "👤" }
  ];

  const highlightScore = pulseResult?.fulfillment_score ?? friends[0]?.latest_score ?? null;

  return (
    <main className="mobile-shell">
      <div className="phone-frame">
        <header className="top-hero">
          <div>
            <h1>Lumina</h1>
            <p>Bring light to your feelings.</p>
          </div>
          <div className="hero-orb" style={{ backgroundColor: highlightScore === null ? "#FFEFAE" : pulseResult?.mood_color ?? "#FFD700" }} />
        </header>

        {!token ? (
          <section className="screen-card auth-card">
            <img
              className="artwork"
              src="https://images.unsplash.com/photo-1490730141103-6cac27aaab94?auto=format&fit=crop&w=900&q=80"
              alt="Sunrise and hopeful sky"
            />
            <h2>Welcome in</h2>
            <p className="muted">Phone login keeps onboarding simple and low-pressure.</p>
            <form onSubmit={requestOtp} className="form-stack">
              <label>
                Phone Number
                <input value={phone} onChange={(e) => setPhone(e.target.value)} required />
              </label>
              <button type="submit" className="primary-btn">
                Request OTP
              </button>
            </form>
            <form onSubmit={verifyOtp} className="form-stack">
              <label>
                OTP
                <input value={otp} onChange={(e) => setOtp(e.target.value)} required />
              </label>
              <button type="submit" className="primary-btn">
                Enter Lumina
              </button>
            </form>
          </section>
        ) : (
          <>
            <section className="screen-card">
              {screen === "checkin" ? (
                <>
                  <img
                    className="artwork"
                    src="https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=900&q=80"
                    alt="Notebook by morning light"
                  />
                  <h2>Daily Check-in</h2>
                  <p className="muted">Type freely or scan your notebook page with camera OCR.</p>

                  <form onSubmit={submitPulse} className="form-stack">
                    <label>
                      Journal
                      <textarea
                        rows={5}
                        value={journalText}
                        onChange={(e) => setJournalText(e.target.value)}
                        placeholder="How meaningful did today feel?"
                      />
                    </label>

                    <div className="camera-row">
                      <button
                        type="button"
                        className="secondary-btn"
                        onClick={() => cameraInputRef.current?.click()}
                        disabled={ocrBusy}
                      >
                        {ocrBusy ? "Scanning..." : "Open Camera & Scan Notebook"}
                      </button>
                      <input
                        ref={cameraInputRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={handlePhotoSelected}
                        className="hidden-input"
                      />
                    </div>

                    {photoPreview ? <img className="snapshot" src={photoPreview} alt="Notebook capture preview" /> : null}

                    <label>
                      Extracted Notebook Text
                      <textarea
                        rows={4}
                        value={imageText}
                        onChange={(e) => setImageText(e.target.value)}
                        placeholder="OCR output appears here."
                      />
                    </label>

                    <label className="check-row">
                      <input type="checkbox" checked={lovedDay} onChange={(e) => setLovedDay(e.target.checked)} />
                      Did you love your day today?
                    </label>

                    <button type="submit" className="primary-btn">
                      Analyze with AI
                    </button>
                  </form>

                  {pulseResult ? (
                    <article className="result-card">
                      <p className="score">{pulseResult.fulfillment_score}/100</p>
                      <p className={`risk ${pulseResult.risk_band}`}>{pulseResult.risk_band} risk</p>
                      <p>{pulseResult.sentiment_summary}</p>
                      <p className="quote">"{pulseResult.quote}"</p>
                    </article>
                  ) : null}
                </>
              ) : null}

              {screen === "connections" ? (
                <>
                  <img
                    className="artwork"
                    src="https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=900&q=80"
                    alt="Friends supporting each other"
                  />
                  <h2>Silent Connection</h2>
                  <p className="muted">No chat noise. Just visible care, one nudge at a time.</p>

                  <form onSubmit={addFriend} className="form-stack">
                    <label>
                      Add friend by phone
                      <input
                        value={friendPhone}
                        onChange={(e) => setFriendPhone(e.target.value)}
                        placeholder="+15550001234"
                      />
                    </label>
                    <button type="submit" className="primary-btn">
                      Add Friend
                    </button>
                  </form>

                  <div className="list-stack">
                    {friends.map((friend) => (
                      <article key={friend.id} className="list-row">
                        <div>
                          <p className="name-row">
                            <span className="orb-dot" style={{ backgroundColor: friend.mood_color }} /> {friend.name}
                          </p>
                          <p className="muted">{moodLabel(friend.latest_score)}</p>
                        </div>
                        <button type="button" className="secondary-btn" onClick={() => sendNudge(friend.id)}>
                          👍 Nudge
                        </button>
                      </article>
                    ))}
                    {friends.length === 0 ? <p className="muted">No friends added yet.</p> : null}
                  </div>
                </>
              ) : null}

              {screen === "discover" ? (
                <>
                  <img
                    className="artwork"
                    src="https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=900&q=80"
                    alt="Global network feeling"
                  />
                  <h2>Global Discovery</h2>
                  <p className="muted">People rise by supporting others with consistent nudges.</p>

                  <div className="list-stack">
                    {discovery.map((row, index) => (
                      <article key={row.id} className="list-row">
                        <div>
                          <p className="name-row">
                            #{index + 1} <span className="orb-dot" style={{ backgroundColor: row.mood_color }} />{" "}
                            {row.name}
                          </p>
                        </div>
                        <strong>{row.altruism_score}</strong>
                      </article>
                    ))}
                    {discovery.length === 0 ? <p className="muted">No discovery data yet.</p> : null}
                  </div>
                </>
              ) : null}

              {screen === "quotes" ? (
                <>
                  <img
                    className="artwork"
                    src="https://images.unsplash.com/photo-1504198453319-5ce911bafcde?auto=format&fit=crop&w=900&q=80"
                    alt="Book and warm light"
                  />
                  <h2>Daily Quote</h2>
                  <p className="muted">Actionable support tuned to your recent emotional trend.</p>

                  {recommendation ? (
                    <article className="result-card quote-panel">
                      <p className="quote">"{recommendation.quote}"</p>
                      <p className="muted">— {recommendation.source}</p>
                      <p>{recommendation.action}</p>
                      {recommendation.professionalBridge ? (
                        <button type="button" className="secondary-btn danger-btn">
                          Connect to Professional
                        </button>
                      ) : null}
                    </article>
                  ) : (
                    <p className="muted">Complete your first check-in to unlock recommendations.</p>
                  )}
                </>
              ) : null}

              {screen === "profile" ? (
                <>
                  <img
                    className="artwork"
                    src="https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=900&q=80"
                    alt="Calm portrait in soft light"
                  />
                  <h2>Your Profile</h2>
                  <p className="muted">This shapes how Lumina checks in with you.</p>
                  <form onSubmit={saveProfile} className="form-stack">
                    <label>
                      Name
                      <input
                        value={profile.name ?? ""}
                        onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                      />
                    </label>
                    <label>
                      Age
                      <input
                        type="number"
                        value={profile.age ?? ""}
                        onChange={(e) =>
                          setProfile({
                            ...profile,
                            age: e.target.value ? Number(e.target.value) : null
                          })
                        }
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
                      <input
                        value={profile.gender ?? ""}
                        onChange={(e) => setProfile({ ...profile, gender: e.target.value })}
                      />
                    </label>
                    <label>
                      Personality Type (Optional)
                      <input
                        value={profile.personality_type ?? ""}
                        onChange={(e) => setProfile({ ...profile, personality_type: e.target.value })}
                      />
                    </label>
                    <button type="submit" className="primary-btn">
                      Save Profile
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
                  className={`nav-btn ${screen === item.id ? "active" : ""}`}
                  onClick={() => setScreen(item.id)}
                >
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              ))}
            </nav>
          </>
        )}

        <footer className="status-bar">{status}</footer>
      </div>
    </main>
  );
}

export default App;
