import { FormEvent, useEffect, useMemo, useState } from "react";
import "./styles.css";

type AuthResponse = {
  token: string;
  userId: string;
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
  if (score === null || score === undefined) {
    return "No pulse yet";
  }
  if (score >= 80) return "Radiant";
  if (score >= 60) return "Steady";
  if (score >= 40) return "Cloudy";
  return "Stormy";
}

function App() {
  const [token, setToken] = useState<string>("");
  const [phone, setPhone] = useState("+15550001111");
  const [otp, setOtp] = useState("123456");
  const [profile, setProfile] = useState<Profile>(emptyProfile);
  const [journalText, setJournalText] = useState("");
  const [imageText, setImageText] = useState("");
  const [lovedDay, setLovedDay] = useState(true);
  const [pulseResult, setPulseResult] = useState<Checkin | null>(null);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [discovery, setDiscovery] = useState<DiscoveryRow[]>([]);
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const [friendPhone, setFriendPhone] = useState("");
  const [status, setStatus] = useState("Welcome to Lumina.");

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
    setStatus("Authenticated. Fetching your space...");
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
    setStatus("Lumina synced.");
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

  useEffect(() => {
    loadAll().catch(() => setStatus("Unable to load data."));
    // Token changes should refresh the full dashboard.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <main className="app-shell">
      <header className="hero">
        <h1>Lumina</h1>
        <p>Bring light to your feelings, one pulse at a time.</p>
      </header>

      {!token ? (
        <section className="card">
          <h2>1) Sign in with phone</h2>
          <form onSubmit={requestOtp} className="grid">
            <label>
              Phone
              <input value={phone} onChange={(e) => setPhone(e.target.value)} required />
            </label>
            <button type="submit" className="btn-primary">
              Request OTP
            </button>
          </form>
          <form onSubmit={verifyOtp} className="grid">
            <label>
              OTP
              <input value={otp} onChange={(e) => setOtp(e.target.value)} required />
            </label>
            <button type="submit" className="btn-primary">
              Verify & Enter
            </button>
          </form>
        </section>
      ) : (
        <>
          <section className="card">
            <h2>2) Profile blueprint</h2>
            <form onSubmit={saveProfile} className="grid two">
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
                Personality Type (optional)
                <input
                  value={profile.personality_type ?? ""}
                  onChange={(e) => setProfile({ ...profile, personality_type: e.target.value })}
                />
              </label>
              <button type="submit" className="btn-primary">
                Save profile
              </button>
            </form>
          </section>

          <section className="card">
            <h2>3) Daily Pulse check-in</h2>
            <form onSubmit={submitPulse} className="grid">
              <label>
                Journal text
                <textarea
                  rows={4}
                  value={journalText}
                  onChange={(e) => setJournalText(e.target.value)}
                  placeholder="How meaningful did today feel?"
                />
              </label>
              <label>
                Notebook image OCR text (optional)
                <textarea
                  rows={3}
                  value={imageText}
                  onChange={(e) => setImageText(e.target.value)}
                  placeholder="Paste extracted text for MVP demo."
                />
              </label>
              <label>
                <input type="checkbox" checked={lovedDay} onChange={(e) => setLovedDay(e.target.checked)} /> Did you
                love your day today?
              </label>
              <button type="submit" className="btn-primary">
                Analyze pulse
              </button>
            </form>
            {pulseResult ? (
              <div className="notice">
                <strong>Fulfillment Score:</strong> {pulseResult.fulfillment_score}/100
                <br />
                <span className={`pill ${pulseResult.risk_band}`}>{pulseResult.risk_band} risk</span>
                <br />
                <strong>Summary:</strong> {pulseResult.sentiment_summary}
                <br />
                <em>"{pulseResult.quote}"</em>
              </div>
            ) : null}
          </section>

          <section className="card">
            <h2>4) Silent connection</h2>
            <form onSubmit={addFriend} className="grid">
              <label>
                Friend phone
                <input
                  value={friendPhone}
                  onChange={(e) => setFriendPhone(e.target.value)}
                  placeholder="+15550001234"
                />
              </label>
              <button type="submit" className="btn-primary">
                Add friend
              </button>
            </form>
            <div className="friend-list">
              {friends.map((friend) => (
                <article key={friend.id} className="friend-item">
                  <div>
                    <span className="orb" style={{ backgroundColor: friend.mood_color }} />
                    <strong>{friend.name}</strong>
                    <div className="tiny">{moodLabel(friend.latest_score)}</div>
                  </div>
                  <button type="button" className="btn-secondary" onClick={() => sendNudge(friend.id)}>
                    👍 Nudge
                  </button>
                </article>
              ))}
              {friends.length === 0 ? <p className="tiny">No friends added yet.</p> : null}
            </div>
          </section>

          <section className="card">
            <h2>5) Global discovery (altruism)</h2>
            <div className="leaderboard">
              {discovery.map((row, index) => (
                <div key={row.id} className="leaderboard-item">
                  <span>
                    #{index + 1} <span className="orb" style={{ backgroundColor: row.mood_color }} /> {row.name}
                  </span>
                  <strong>{row.altruism_score}</strong>
                </div>
              ))}
            </div>
          </section>

          <section className="card">
            <h2>6) Growth & support</h2>
            {recommendation ? (
              <div className="notice">
                <p>"{recommendation.quote}"</p>
                <p>
                  <em>{recommendation.source}</em>
                </p>
                <p>{recommendation.action}</p>
                {recommendation.professionalBridge ? (
                  <button type="button" className="btn-secondary danger">
                    Connect to Professional
                  </button>
                ) : null}
              </div>
            ) : (
              <p className="tiny">Complete a pulse check-in to receive insights.</p>
            )}
          </section>
        </>
      )}

      <footer className="tiny">{status}</footer>
    </main>
  );
}

export default App;
