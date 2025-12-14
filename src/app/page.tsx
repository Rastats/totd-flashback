// src/app/page.tsx

import Link from "next/link";

export default function HomePage() {
  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: "48px 16px", fontFamily: "system-ui" }}>
      {/* Hero */}
      <section style={{ textAlign: "center", marginBottom: 48 }}>
        <h1 style={{ fontSize: 48, marginBottom: 16, background: "linear-gradient(135deg, #60a5fa, #a855f7)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
          TOTD Flashback
        </h1>
        <p style={{ fontSize: 20, opacity: 0.9, marginBottom: 8 }}>
          Trackmania Charity Speedrun Marathon
        </p>
        <p style={{ fontSize: 16, opacity: 0.7, marginBottom: 24 }}>
          Celebrating TOTD #2000 & Rastats&apos; 26th birthday 🎂
        </p>

        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <Link href="/signup/player" style={{
            padding: "14px 28px",
            background: "linear-gradient(135deg, #60a5fa, #3b82f6)",
            borderRadius: 8,
            color: "#fff",
            fontWeight: 600,
            textDecoration: "none",
          }}>
            🎮 Join as Player
          </Link>
          <Link href="/signup/caster" style={{
            padding: "14px 28px",
            background: "linear-gradient(135deg, #a855f7, #7c3aed)",
            borderRadius: 8,
            color: "#fff",
            fontWeight: 600,
            textDecoration: "none",
          }}>
            🎙️ Join as Caster
          </Link>
        </div>
      </section>

      {/* Event Info */}
      <section style={{
        padding: 24,
        background: "#12121a",
        borderRadius: 12,
        border: "1px solid #2a2a3a",
        marginBottom: 32,
      }}>
        <h2 style={{ fontSize: 24, marginBottom: 16 }}>📅 Event Details</h2>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
          <div style={{ padding: 16, background: "#1a1a2e", borderRadius: 8 }}>
            <div style={{ opacity: 0.7, fontSize: 14, marginBottom: 4 }}>Start</div>
            <div style={{ fontSize: 18, fontWeight: 500 }}>Dec 21, 2025 • 21:00 CET</div>
            <div style={{ fontSize: 13, opacity: 0.6 }}>Right after GranaDy&apos;s BIG Cup</div>
          </div>
          <div style={{ padding: 16, background: "#1a1a2e", borderRadius: 8 }}>
            <div style={{ opacity: 0.7, fontSize: 14, marginBottom: 4 }}>End</div>
            <div style={{ fontSize: 18, fontWeight: 500 }}>Dec 24, 2025 • 18:00 CET</div>
            <div style={{ fontSize: 13, opacity: 0.6 }}>69 hours total</div>
          </div>
          <div style={{ padding: 16, background: "#1a1a2e", borderRadius: 8 }}>
            <div style={{ opacity: 0.7, fontSize: 14, marginBottom: 4 }}>Teams</div>
            <div style={{ fontSize: 18, fontWeight: 500 }}>4 Teams</div>
            <div style={{ fontSize: 13, opacity: 0.6 }}>Staff-assigned for full coverage</div>
          </div>
          <div style={{ padding: 16, background: "#1a1a2e", borderRadius: 8 }}>
            <div style={{ opacity: 0.7, fontSize: 14, marginBottom: 4 }}>Charity</div>
            <div style={{ fontSize: 18, fontWeight: 500 }}>Save the Children UK</div>
            <div style={{ fontSize: 13, opacity: 0.6 }}>Via Tiltify</div>
          </div>
        </div>
      </section>

      {/* Stream */}
      <section style={{
        padding: 24,
        background: "linear-gradient(135deg, #1a1a2e, #2a1a3a)",
        borderRadius: 12,
        border: "1px solid #4a2a5a",
        textAlign: "center",
        marginBottom: 32,
      }}>
        <h2 style={{ fontSize: 20, marginBottom: 12 }}>📺 Official Restream</h2>
        <a
          href="https://twitch.tv/rastats"
          target="_blank"
          rel="noreferrer"
          style={{
            color: "#a855f7",
            fontSize: 18,
            fontWeight: 500,
          }}
        >
          twitch.tv/rastats
        </a>
        <p style={{ opacity: 0.7, marginTop: 8, fontSize: 14 }}>
          Live commentary from our casters throughout the event
        </p>
      </section>

      {/* Concept */}
      <section style={{
        padding: 24,
        background: "#12121a",
        borderRadius: 12,
        border: "1px solid #2a2a3a",
        marginBottom: 32,
      }}>
        <h2 style={{ fontSize: 24, marginBottom: 16 }}>🎯 The Goal</h2>
        <p style={{ lineHeight: 1.7, marginBottom: 16 }}>
          Finish <strong>every Track of the Day</strong> going backwards from the newest (TOTD #2000) to the oldest (TOTD #1).
          Teams race against time while viewers can donate to trigger <strong>penalties</strong> that spice up the challenge!
        </p>
        <p style={{ lineHeight: 1.7, opacity: 0.8 }}>
          Donations also unlock <strong>shields</strong> to protect your favorite team.
          All proceeds go to Save the Children UK.
        </p>
      </section>

      {/* Donation System */}
      <section style={{
        padding: 24,
        background: "linear-gradient(135deg, #1a1a2e, #2a1a1a)",
        borderRadius: 12,
        border: "1px solid #4a3a2a",
        marginBottom: 32,
      }}>
        <h2 style={{ fontSize: 24, marginBottom: 16, color: "#f59e0b" }}>💰 How Donations Work</h2>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 20 }}>
          <div>
            <h3 style={{ fontSize: 16, marginBottom: 8, color: "#f87171" }}>⚠️ Trigger Penalties</h3>
            <p style={{ lineHeight: 1.6, opacity: 0.9, fontSize: 14 }}>
              Choose a penalty (£5–£500) and target any team. If they&apos;re not shielded, the penalty activates!
            </p>
          </div>

          <div>
            <h3 style={{ fontSize: 16, marginBottom: 8, color: "#4ade80" }}>🛡️ Unlock Shields</h3>
            <p style={{ lineHeight: 1.6, opacity: 0.9, fontSize: 14 }}>
              Your donation adds to your chosen team&apos;s total. At milestones (£100/£500), shields activate automatically!
            </p>
          </div>

          <div>
            <h3 style={{ fontSize: 16, marginBottom: 8, color: "#60a5fa" }}>👥 Support a Team</h3>
            <p style={{ lineHeight: 1.6, opacity: 0.9, fontSize: 14 }}>
              Use the Donate Now button and pick your teams. The donation amount encodes your choices automatically!
            </p>
          </div>
        </div>

        <div style={{
          marginTop: 20,
          padding: 16,
          background: "#0a0a12",
          borderRadius: 8,
          textAlign: "center",
        }}>
          <p style={{ opacity: 0.8, marginBottom: 12 }}>
            All donations go to <strong>Save the Children UK</strong> via Tiltify
          </p>
          <a
            href="https://donate.tiltify.com/0ce3def0-c80a-4581-b888-a8c89c1d16c9/details"
            target="_blank"
            rel="noreferrer"
            style={{
              display: "inline-block",
              padding: "12px 24px",
              background: "linear-gradient(135deg, #f59e0b, #d97706)",
              borderRadius: 8,
              color: "#fff",
              fontWeight: 600,
              textDecoration: "none",
              boxShadow: "0 2px 8px rgba(245, 158, 11, 0.3)",
            }}
          >
            ❤️ Donate Now
          </a>
        </div>
      </section>

      {/* Quick Links */}
      <section style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
        gap: 16,
        marginBottom: 32,
      }}>
        <Link href="/penalties" style={{
          padding: 20,
          background: "#1a1a2e",
          borderRadius: 8,
          border: "1px solid #3a2a2a",
          textDecoration: "none",
          color: "inherit",
          transition: "transform 0.2s, border-color 0.2s",
        }}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>⚠️</div>
          <div style={{ fontWeight: 500, marginBottom: 4 }}>Penalties</div>
          <div style={{ fontSize: 13, opacity: 0.7, marginBottom: 8 }}>10 penalties from 5€ to 500€</div>
          <div style={{ fontSize: 12, color: "#f87171" }}>View details →</div>
        </Link>

        <Link href="/shields" style={{
          padding: 20,
          background: "#1a1a2e",
          borderRadius: 8,
          border: "1px solid #2a3a2a",
          textDecoration: "none",
          color: "inherit",
          transition: "transform 0.2s, border-color 0.2s",
        }}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>🛡️</div>
          <div style={{ fontWeight: 500, marginBottom: 4 }}>Shields</div>
          <div style={{ fontSize: 13, opacity: 0.7, marginBottom: 8 }}>Small (100€) & Big (500€) shields</div>
          <div style={{ fontSize: 12, color: "#4ade80" }}>View details →</div>
        </Link>

        <Link href="/how-to-join" style={{
          padding: 20,
          background: "#1a1a2e",
          borderRadius: 8,
          border: "1px solid #2a2a4a",
          textDecoration: "none",
          color: "inherit",
          transition: "transform 0.2s, border-color 0.2s",
        }}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>📋</div>
          <div style={{ fontWeight: 500, marginBottom: 4 }}>How to Join</div>
          <div style={{ fontSize: 13, opacity: 0.7, marginBottom: 8 }}>Requirements & rules</div>
          <div style={{ fontSize: 12, color: "#60a5fa" }}>View details →</div>
        </Link>
      </section>
    </main>
  );
}
