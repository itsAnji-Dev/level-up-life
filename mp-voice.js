window.MPVoice = (() => {
  let localStream = null;
  let micEnabled = false;
  let activeConfig = null;

  function initVoice(cfg) {
    activeConfig = cfg;
    const statusEl = document.getElementById("voice-status-text");
    if (statusEl) statusEl.textContent = `Squad Channel Ready (${cfg.roomId.slice(0, 10)})`;
  }

  async function toggleMic() {
    const statusEl = document.getElementById("voice-status-text");
    if (!micEnabled) {
      try {
        localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        micEnabled = true;
        if (statusEl) statusEl.textContent = "Transmitting to Squad";
      } catch (err) {
        if (statusEl) statusEl.textContent = "Mic permission blocked";
        micEnabled = false;
      }
    } else {
      leaveVoice();
      if (statusEl) statusEl.textContent = "Muted";
    }
    return micEnabled;
  }

  function leaveVoice() {
    if (localStream) {
      localStream.getTracks().forEach((t) => t.stop());
      localStream = null;
    }
    micEnabled = false;
  }

  return { initVoice, toggleMic, leaveVoice };
})();
