import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from "react";
import "./styles.css";
const apiBase = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080/api";
const emptyProfile = {
    name: "",
    age: null,
    location: "",
    education: "",
    gender: "",
    personality_type: ""
};
function moodLabel(score) {
    if (score === null || score === undefined) {
        return "No pulse yet";
    }
    if (score >= 80)
        return "Radiant";
    if (score >= 60)
        return "Steady";
    if (score >= 40)
        return "Cloudy";
    return "Stormy";
}
function App() {
    const [token, setToken] = useState("");
    const [phone, setPhone] = useState("+15550001111");
    const [otp, setOtp] = useState("123456");
    const [profile, setProfile] = useState(emptyProfile);
    const [journalText, setJournalText] = useState("");
    const [imageText, setImageText] = useState("");
    const [lovedDay, setLovedDay] = useState(true);
    const [pulseResult, setPulseResult] = useState(null);
    const [friends, setFriends] = useState([]);
    const [discovery, setDiscovery] = useState([]);
    const [recommendation, setRecommendation] = useState(null);
    const [friendPhone, setFriendPhone] = useState("");
    const [status, setStatus] = useState("Welcome to Lumina.");
    const headers = useMemo(() => {
        const nextHeaders = {
            "Content-Type": "application/json"
        };
        if (token) {
            nextHeaders.Authorization = `Bearer ${token}`;
        }
        return nextHeaders;
    }, [token]);
    async function requestOtp(event) {
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
    async function verifyOtp(event) {
        event.preventDefault();
        setStatus("Verifying OTP...");
        const response = await fetch(`${apiBase}/auth/verify-otp`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ phone, otp })
        });
        const payload = (await response.json());
        if (!response.ok) {
            setStatus(payload.error ?? "OTP verification failed.");
            return;
        }
        setToken(payload.token);
        setStatus("Authenticated. Fetching your space...");
    }
    async function loadAll() {
        if (!token)
            return;
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
        const profileData = (await profileRes.json());
        const friendsData = (await friendsRes.json());
        const discoveryData = (await discoveryRes.json());
        const recData = (await recRes.json());
        setProfile({
            ...emptyProfile,
            ...profileData.profile
        });
        setFriends(friendsData.friends);
        setDiscovery(discoveryData.discovery);
        setRecommendation(recData.recommendation);
        setStatus("Lumina synced.");
    }
    async function saveProfile(event) {
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
            ...payload.profile
        });
        setStatus("Profile updated.");
    }
    async function submitPulse(event) {
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
        setPulseResult(payload.checkin);
        setStatus("Pulse check-in complete.");
        await loadAll();
    }
    async function addFriend(event) {
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
    async function sendNudge(friendId) {
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
    return (_jsxs("main", { className: "app-shell", children: [_jsxs("header", { className: "hero", children: [_jsx("h1", { children: "Lumina" }), _jsx("p", { children: "Bring light to your feelings, one pulse at a time." })] }), !token ? (_jsxs("section", { className: "card", children: [_jsx("h2", { children: "1) Sign in with phone" }), _jsxs("form", { onSubmit: requestOtp, className: "grid", children: [_jsxs("label", { children: ["Phone", _jsx("input", { value: phone, onChange: (e) => setPhone(e.target.value), required: true })] }), _jsx("button", { type: "submit", className: "btn-primary", children: "Request OTP" })] }), _jsxs("form", { onSubmit: verifyOtp, className: "grid", children: [_jsxs("label", { children: ["OTP", _jsx("input", { value: otp, onChange: (e) => setOtp(e.target.value), required: true })] }), _jsx("button", { type: "submit", className: "btn-primary", children: "Verify & Enter" })] })] })) : (_jsxs(_Fragment, { children: [_jsxs("section", { className: "card", children: [_jsx("h2", { children: "2) Profile blueprint" }), _jsxs("form", { onSubmit: saveProfile, className: "grid two", children: [_jsxs("label", { children: ["Name", _jsx("input", { value: profile.name ?? "", onChange: (e) => setProfile({ ...profile, name: e.target.value }) })] }), _jsxs("label", { children: ["Age", _jsx("input", { type: "number", value: profile.age ?? "", onChange: (e) => setProfile({
                                                    ...profile,
                                                    age: e.target.value ? Number(e.target.value) : null
                                                }) })] }), _jsxs("label", { children: ["Location", _jsx("input", { value: profile.location ?? "", onChange: (e) => setProfile({ ...profile, location: e.target.value }) })] }), _jsxs("label", { children: ["Education", _jsx("input", { value: profile.education ?? "", onChange: (e) => setProfile({ ...profile, education: e.target.value }) })] }), _jsxs("label", { children: ["Gender", _jsx("input", { value: profile.gender ?? "", onChange: (e) => setProfile({ ...profile, gender: e.target.value }) })] }), _jsxs("label", { children: ["Personality Type (optional)", _jsx("input", { value: profile.personality_type ?? "", onChange: (e) => setProfile({ ...profile, personality_type: e.target.value }) })] }), _jsx("button", { type: "submit", className: "btn-primary", children: "Save profile" })] })] }), _jsxs("section", { className: "card", children: [_jsx("h2", { children: "3) Daily Pulse check-in" }), _jsxs("form", { onSubmit: submitPulse, className: "grid", children: [_jsxs("label", { children: ["Journal text", _jsx("textarea", { rows: 4, value: journalText, onChange: (e) => setJournalText(e.target.value), placeholder: "How meaningful did today feel?" })] }), _jsxs("label", { children: ["Notebook image OCR text (optional)", _jsx("textarea", { rows: 3, value: imageText, onChange: (e) => setImageText(e.target.value), placeholder: "Paste extracted text for MVP demo." })] }), _jsxs("label", { children: [_jsx("input", { type: "checkbox", checked: lovedDay, onChange: (e) => setLovedDay(e.target.checked) }), " Did you love your day today?"] }), _jsx("button", { type: "submit", className: "btn-primary", children: "Analyze pulse" })] }), pulseResult ? (_jsxs("div", { className: "notice", children: [_jsx("strong", { children: "Fulfillment Score:" }), " ", pulseResult.fulfillment_score, "/100", _jsx("br", {}), _jsxs("span", { className: `pill ${pulseResult.risk_band}`, children: [pulseResult.risk_band, " risk"] }), _jsx("br", {}), _jsx("strong", { children: "Summary:" }), " ", pulseResult.sentiment_summary, _jsx("br", {}), _jsxs("em", { children: ["\"", pulseResult.quote, "\""] })] })) : null] }), _jsxs("section", { className: "card", children: [_jsx("h2", { children: "4) Silent connection" }), _jsxs("form", { onSubmit: addFriend, className: "grid", children: [_jsxs("label", { children: ["Friend phone", _jsx("input", { value: friendPhone, onChange: (e) => setFriendPhone(e.target.value), placeholder: "+15550001234" })] }), _jsx("button", { type: "submit", className: "btn-primary", children: "Add friend" })] }), _jsxs("div", { className: "friend-list", children: [friends.map((friend) => (_jsxs("article", { className: "friend-item", children: [_jsxs("div", { children: [_jsx("span", { className: "orb", style: { backgroundColor: friend.mood_color } }), _jsx("strong", { children: friend.name }), _jsx("div", { className: "tiny", children: moodLabel(friend.latest_score) })] }), _jsx("button", { type: "button", className: "btn-secondary", onClick: () => sendNudge(friend.id), children: "\uD83D\uDC4D Nudge" })] }, friend.id))), friends.length === 0 ? _jsx("p", { className: "tiny", children: "No friends added yet." }) : null] })] }), _jsxs("section", { className: "card", children: [_jsx("h2", { children: "5) Global discovery (altruism)" }), _jsx("div", { className: "leaderboard", children: discovery.map((row, index) => (_jsxs("div", { className: "leaderboard-item", children: [_jsxs("span", { children: ["#", index + 1, " ", _jsx("span", { className: "orb", style: { backgroundColor: row.mood_color } }), " ", row.name] }), _jsx("strong", { children: row.altruism_score })] }, row.id))) })] }), _jsxs("section", { className: "card", children: [_jsx("h2", { children: "6) Growth & support" }), recommendation ? (_jsxs("div", { className: "notice", children: [_jsxs("p", { children: ["\"", recommendation.quote, "\""] }), _jsx("p", { children: _jsx("em", { children: recommendation.source }) }), _jsx("p", { children: recommendation.action }), recommendation.professionalBridge ? (_jsx("button", { type: "button", className: "btn-secondary danger", children: "Connect to Professional" })) : null] })) : (_jsx("p", { className: "tiny", children: "Complete a pulse check-in to receive insights." }))] })] })), _jsx("footer", { className: "tiny", children: status })] }));
}
export default App;
