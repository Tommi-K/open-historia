import React from "react";

const formatBytes = (bytes) => {
  if (!bytes) return "0 B";

  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(value >= 100 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
};

const StartupScreen = ({
  elapsedMs = 0,
  loadedBytes = 0,
  progress = 0,
  stage = "Preparing the world",
  steps = [],
  timeBudgetMs = 30_000,
  timedOut = false,
}) => {
  const secondsLeft = Math.max(0, Math.ceil((timeBudgetMs - elapsedMs) / 1000));

  return (
    /* Applied the loading screen asset as a cover background image */
    <div
    className="startup-shell"
    style={{
      backgroundImage: "url('/loading_screen.jpg')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
          width: "100vw",
          height: "100vh"
    }}
    >
    <div className="startup-aurora startup-aurora-left" />
    <div className="startup-aurora startup-aurora-right" />
    <div className="startup-grid" />

    {/* Added inline styles for transparency and optional glassmorphism blur */}
    <div
    className="startup-panel"
    style={{
      backgroundColor: "rgba(0, 0, 0, 0.65)", // Black with 65% opacity
          backdropFilter: "blur(10px)", // Optional: Blurs the background image behind the panel
          WebkitBackdropFilter: "blur(10px)", // Safari support
          padding: "2rem",
          borderRadius: "1rem"
    }}
    >

    {/* Replaced the rings and PH text with the image logo */}
    <div className="startup-orbit" style={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
    <img
    src="/logo.png"
    alt="Pax Historia Logo"
    style={{ width: "12rem", height: "12rem", objectFit: "contain" }}
    />
    <div className="startup-scanline" />
    </div>

    <h1 className="startup-title">
    {timedOut ? "Continuing with live loading" : "Preparing the world"}
    </h1>

    <div className="startup-progress-card">
    <div className="startup-progress-meta">
    <span>{stage}</span>
    <span>{progress}%</span>
    </div>
    <div className="startup-progress-track">
    <div
    className="startup-progress-fill"
    style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
    />
    </div>
    </div>

    <div className="startup-status-row">
    <span>
    {timedOut ? "Background loading enabled" : `${secondsLeft}s remaining`}
    </span>
    <span>{formatBytes(loadedBytes)} cached so far</span>
    </div>

    <div className="startup-steps">
    {steps.map((step) => (
      <div
      key={step.id}
      className={`startup-step startup-step-${step.status}`}
      >
      <span className="startup-step-indicator" />
      <span>{step.label}</span>
      </div>
    ))}
    </div>
    </div>
    </div>
  );
};

export default StartupScreen;
