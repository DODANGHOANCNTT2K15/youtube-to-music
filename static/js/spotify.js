let tracks = [];
const tracksDataElement = document.getElementById("tracks-data");
if (tracksDataElement) {
    try {
        tracks = JSON.parse(tracksDataElement.textContent || "[]");
    } catch (error) {
        console.error("Failed to parse tracks data:", error);
        tracks = [];
    }
}
let playlists = {};
const playlistsDataElement = document.getElementById("playlists-data");
if (playlistsDataElement) {
    try {
        playlists = JSON.parse(playlistsDataElement.textContent || "{}");
    } catch (error) {
        console.error("Failed to parse playlists data:", error);
        playlists = {};
    }
}
const addMusicForm = document.getElementById("addMusicForm");
const musicUrlInput = document.getElementById("musicUrl");
const addMusicButton = document.getElementById("addMusicButton");
const addMusicStatus = document.getElementById("addMusicStatus");
const audioPlayer = document.getElementById("audioPlayer");
const mainPlayButton = document.getElementById("mainPlayButton");
const playPauseButton = document.getElementById("playPauseButton");
const previousButton = document.getElementById("previousButton");
const nextButton = document.getElementById("nextButton");
const progressBar = document.getElementById("progressBar");
const progressFill = document.getElementById("progressFill");
const progressThumb = document.getElementById("progressThumb");
const currentTime = document.getElementById("currentTime");
const totalTime = document.getElementById("totalTime");
const volumeIcon = document.getElementById("volumeIcon");
const volumeBar = document.getElementById("volumeBar");
const volumeFill = document.getElementById("volumeFill");
const volumeThumb = document.getElementById("volumeThumb");
const addPlaylistButton = document.getElementById("addPlaylistButton");
const playlistModal = document.getElementById("playlistModal");
const playlistNameInput = document.getElementById("playlistNameInput");
const confirmPlaylistButton = document.getElementById("confirmPlaylistButton");
const cancelPlaylistButton = document.getElementById("cancelPlaylistButton");
const playlistList = document.getElementById("playlistList");
const playlistOptionsButton = document.getElementById("playlistOptionsButton");
const addToPlaylistModal = document.getElementById("addToPlaylistModal");
const addToPlaylistList = document.getElementById("addToPlaylistList");
const cancelAddToPlaylistButton = document.getElementById("cancelAddToPlaylistButton");
const deletePlaylistModal = document.getElementById("deletePlaylistModal");
const deletePlaylistMessage = document.getElementById("deletePlaylistMessage");
const cancelDeletePlaylistButton = document.getElementById("cancelDeletePlaylistButton");
const confirmDeletePlaylistButton = document.getElementById("confirmDeletePlaylistButton");
const shuffleButton = document.querySelector('.control-button[aria-label="Shuffle"]');
const repeatButton = document.querySelector('.control-button[aria-label="Repeat"]');
const subtitleList = document.getElementById("subtitleList");

let currentTrackIndex = 0;
let currentPlaylistName = "Added Music";
let currentTrackIdToAdd = null;
let currentPlaylistToDelete = null;
let currentPlaylistIndexes = tracks.map((_, index) => index);
let isSeeking = false;
let isVolumeDragging = false;
let isMuted = false;
let isShuffle = false;
let repeatMode = "off";
let subtitleCues = [];
let activeSubtitleIndex = -1;
let subtitleRequestToken = 0;

function formatTime(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60).toString().padStart(2, "0");
    return `${minutes}:${remainingSeconds}`;
}

function setText(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value || "";
}

function setImage(id, src) {
    const element = document.getElementById(id);
    if (element && src) element.src = src;
}

function setPlayButtons(isPlaying) {
    const label = isPlaying ? "⏸" : "▶";
    if (mainPlayButton) mainPlayButton.textContent = label;
    if (playPauseButton) playPauseButton.textContent = label;
}

function setActiveTrack(index) {
    document.querySelectorAll(".song-row[data-track-index]").forEach((element) => {
        element.classList.toggle("is-active", Number(element.dataset.trackIndex) === index);
    });
}

function getPlaylistIndexes(name) {
    const ids = new Set((playlists[name] || []).map((id) => String(id)));
    return tracks
        .map((track, index) => ids.has(String(track.id ?? "")) ? index : -1)
        .filter((index) => index !== -1);
}

function setActivePlaylist(button) {
    document.querySelectorAll(".playlist-item").forEach((item) => {
        item.classList.toggle("is-active", item === button);
    });
    if (button?.dataset.playlistName) {
        showPlaylist(button.dataset.playlistName);
        refreshPlaylistButtons();
    }
}

function parseDuration(durationString) {
    const parts = (durationString || "").split(":").map((value) => Number(value));
    if (parts.some(isNaN)) return 0;
    if (parts.length === 3) {
        return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
    if (parts.length === 2) {
        return parts[0] * 60 + parts[1];
    }
    return parts[0] || 0;
}

function calculatePlaylistDuration(indexes) {
    return indexes.reduce((total, index) => {
        const track = tracks[index];
        return total + (track ? parseDuration(track.duration) : 0);
    }, 0);
}

function updatePlaylistCountAndDuration() {
    setText("playlistCount", `${currentPlaylistIndexes.length} songs`);
    setText("heroDuration", formatTime(calculatePlaylistDuration(currentPlaylistIndexes)));
}

function renderPlaylistButton(name) {
    if (!playlistList) return null;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "playlist-item";
    button.dataset.playlistName = name;
    button.textContent = name;
    button.addEventListener("click", () => setActivePlaylist(button));
    playlistList.appendChild(button);
    return button;
}

function showPlaylist(name) {
    currentPlaylistName = name;
    const playlistIds = new Set((playlists[name] || []).map((id) => String(id)));
    currentPlaylistIndexes = [];

    setText("playlistTitle", name);

    let visibleRowNumber = 1;
    document.querySelectorAll(".song-row[data-track-index]").forEach((element) => {
        const trackId = String(element.dataset.trackId || "");
        const index = Number(element.dataset.trackIndex);
        const isVisible = playlistIds.has(trackId);
        element.hidden = !isVisible;
        element.style.display = isVisible ? "" : "none";
        if (isVisible) {
            currentPlaylistIndexes.push(index);
            const rowNumber = element.querySelector(".row-number");
            if (rowNumber) rowNumber.textContent = visibleRowNumber;
            visibleRowNumber += 1;
        }
    });

    updatePlaylistCountAndDuration();

    if (playlistOptionsButton) {
        playlistOptionsButton.style.display = name === "Added Music" ? "none" : "inline-grid";
    }
    updateRowActions();

    if (currentPlaylistIndexes.length && !currentPlaylistIndexes.includes(currentTrackIndex)) {
        loadTrack(currentPlaylistIndexes[0], false);
    }
}

function updateRowActions() {
    const hasCustomPlaylists = Object.keys(playlists).some((name) => name !== "Added Music");

    document.querySelectorAll('[data-row-action="add"]').forEach((button) => {
        button.disabled = !hasCustomPlaylists;
    });

    document.querySelectorAll('[data-row-action="remove"]').forEach((button) => {
        const trackId = button.dataset.trackId;
        const inPlaylist = (playlists[currentPlaylistName] || []).includes(trackId);
        // Allow delete from storage when viewing Added Music; otherwise only show remove when in that playlist
        const canRemove = currentPlaylistName === "Added Music" ? true : inPlaylist;
        button.style.display = canRemove ? "inline-flex" : "none";
        // Update label for clarity
        if (currentPlaylistName === "Added Music") {
            button.textContent = "Delete";
            button.classList.add("remove-from-storage");
        } else {
            button.textContent = "Remove";
            button.classList.remove("remove-from-storage");
        }
    });
}

function updateVolumeUI(value) {
    if (!volumeFill) return;
    const percent = Math.round(value * 100);
    volumeFill.style.width = `${percent}%`;
    if (volumeThumb) volumeThumb.style.left = `${percent}%`;
    if (!volumeIcon) return;
    volumeIcon.classList.toggle("is-muted", isMuted || value === 0);
    volumeIcon.classList.toggle("is-low", !isMuted && value > 0 && value < 0.5);
}

function refreshPlaylistButtons() {
    if (!playlistList) return;
    const activeName = currentPlaylistName;
    playlistList.innerHTML = "";
    Object.keys(playlists).forEach((name) => {
        const button = renderPlaylistButton(name);
        if (button && name === activeName) {
            button.classList.add("is-active");
        }
    });
    if (playlistOptionsButton) {
        playlistOptionsButton.style.display = activeName === "Added Music" ? "none" : "inline-grid";
    }
}

function openAddToPlaylistModal(trackId) {
    if (!addToPlaylistModal || !addToPlaylistList) return;
    currentTrackIdToAdd = trackId;
    addToPlaylistList.innerHTML = "";
    const playlistNames = Object.keys(playlists).filter((name) => name !== "Added Music");
    if (!playlistNames.length) {
        addToPlaylistList.innerHTML = '<div class="modal-text">Tạo playlist trước khi thêm bài hát.</div>';
    } else {
        playlistNames.forEach((name) => {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "modal-button";
            button.textContent = name;
            if ((playlists[name] || []).includes(trackId)) {
                button.disabled = true;
                button.textContent = `${name} (Added)`;
            } else {
                button.addEventListener("click", () => addTrackToPlaylist(trackId, name));
            }
            addToPlaylistList.appendChild(button);
        });
    }
    addToPlaylistModal.classList.remove("hidden");
}

function closeAddToPlaylistModal() {
    if (!addToPlaylistModal) return;
    addToPlaylistModal.classList.add("hidden");
}

async function addTrackToPlaylist(trackId, playlistName) {
    try {
        const response = await fetch(`/playlists/${encodeURIComponent(playlistName)}/tracks`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ track_id: trackId })
        });
        const data = await response.json();
        if (!response.ok || !data.success) {
            throw new Error(data.error || "Không thể thêm bài hát vào playlist.");
        }
        playlists = data.playlists;
        refreshPlaylistButtons();
        updateRowActions();
        closeAddToPlaylistModal();
    } catch (error) {
        alert(error.message);
    }
}

function openDeletePlaylistModal() {
    if (!deletePlaylistModal || !deletePlaylistMessage) return;
    currentPlaylistToDelete = currentPlaylistName;
    deletePlaylistMessage.textContent = `Bạn có chắc muốn xóa playlist "${currentPlaylistName}" không?`;
    deletePlaylistModal.classList.remove("hidden");
}

function closeDeletePlaylistModal() {
    if (!deletePlaylistModal) return;
    deletePlaylistModal.classList.add("hidden");
    currentPlaylistToDelete = null;
}

async function confirmDeletePlaylist() {
    if (!currentPlaylistToDelete) return;
    try {
        const response = await fetch(`/playlists/${encodeURIComponent(currentPlaylistToDelete)}`, {
            method: "DELETE"
        });
        const data = await response.json();
        if (!response.ok || !data.success) {
            throw new Error(data.error || "Không thể xóa playlist.");
        }
        playlists = data.playlists;
        currentPlaylistName = "Added Music";
        refreshPlaylistButtons();
        showPlaylist("Added Music");
        closeDeletePlaylistModal();
    } catch (error) {
        alert(error.message);
    }
}

async function removeTrackFromPlaylist(trackId) {
    if (!audioPlayer || currentPlaylistName === "Added Music") return;
    try {
        const response = await fetch(`/playlists/${encodeURIComponent(currentPlaylistName)}/tracks/${encodeURIComponent(trackId)}`, {
            method: "DELETE"
        });
        const data = await response.json();
        if (!response.ok || !data.success) {
            throw new Error(data.error || "Không thể xoá bài hát khỏi playlist.");
        }
        playlists = data.playlists;
        showPlaylist(currentPlaylistName);
    } catch (error) {
        alert(error.message);
    }
}

async function deleteTrack(trackId) {
    if (!trackId) return;
    try {
        const response = await fetch(`/tracks/${encodeURIComponent(trackId)}`, {
            method: "DELETE"
        });
        const data = await response.json();
        if (!response.ok || !data.success) {
            throw new Error(data.error || "Không thể xóa bài hát.");
        }
        playlists = data.playlists;
        // Refresh library and playlist view
        refreshPlaylistButtons();
        showPlaylist("Added Music");
    } catch (error) {
        alert(error.message);
    }
}

function setVolume(value) {
    if (!audioPlayer) return;
    audioPlayer.volume = Math.min(Math.max(value, 0), 1);
    if (isMuted && audioPlayer.volume > 0) {
        isMuted = false;
        audioPlayer.muted = false;
    }
    updateVolumeUI(audioPlayer.muted ? 0 : audioPlayer.volume);
}

function toggleMute() {
    if (!audioPlayer) return;
    isMuted = !isMuted;
    audioPlayer.muted = isMuted;
    updateVolumeUI(isMuted ? 0 : audioPlayer.volume);
}

function setVolumeFromEvent(event) {
    if (!volumeBar || !audioPlayer) return;
    const percent = getVolumePercent(event);
    setVolume(percent);
}

function getVolumePercent(event) {
    const clientX = event.touches?.[0]?.clientX ?? event.changedTouches?.[0]?.clientX ?? event.clientX;
    const rect = volumeBar.getBoundingClientRect();
    return Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
}

function startVolumeDrag(event) {
    if (!volumeBar || !audioPlayer) return;
    event.preventDefault();
    isVolumeDragging = true;
    volumeBar.classList.add("is-dragging");
    setVolumeFromEvent(event);
    window.addEventListener("mousemove", dragVolume);
    window.addEventListener("mouseup", endVolumeDrag);
    window.addEventListener("touchmove", dragVolume, { passive: false });
    window.addEventListener("touchend", endVolumeDrag);
}

function dragVolume(event) {
    if (!isVolumeDragging) return;
    event.preventDefault();
    setVolumeFromEvent(event);
}

function endVolumeDrag(event) {
    if (!isVolumeDragging) return;
    setVolumeFromEvent(event);
    isVolumeDragging = false;
    volumeBar.classList.remove("is-dragging");
    window.removeEventListener("mousemove", dragVolume);
    window.removeEventListener("mouseup", endVolumeDrag);
    window.removeEventListener("touchmove", dragVolume);
    window.removeEventListener("touchend", endVolumeDrag);
}

async function createPlaylist(name) {
    try {
        const response = await fetch("/playlists", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name })
        });
        const data = await response.json();
        if (!response.ok || !data.success) {
            throw new Error(data.error || "Không thể tạo playlist.");
        }
        playlists = data.playlists;
        refreshPlaylistButtons();
        const newButton = document.querySelector(`[data-playlist-name="${CSS.escape(name)}"]`);
        if (newButton) {
            setActivePlaylist(newButton);
        }
    } catch (error) {
        alert(error.message);
    }
}

function openPlaylistModal() {
    if (!playlistModal) return;
    playlistModal.classList.remove("hidden");
    if (playlistNameInput) {
        playlistNameInput.value = "";
        playlistNameInput.focus();
    }
}

function closePlaylistModal() {
    if (!playlistModal) return;
    playlistModal.classList.add("hidden");
}

function updateTrackInfo(track) {
    setImage("heroCover", track.thumbnail);
    setImage("nowCover", track.thumbnail);
    setImage("playerCover", track.thumbnail);
    setText("heroArtist", track.artist);
    setText("heroDuration", track.duration);
    setText("nowTitle", track.title);
    setText("nowArtist", track.artist);
    setText("playerTitle", track.title);
    setText("playerArtist", track.artist);
    setText("totalTime", track.duration || "0:00");
    setText("lyricsTitle", "Subtitles");
    setText("lyricsDescription", "Phụ đề sẽ tự chạy theo thời gian phát nhạc.");
    setText("lyricsStatus", track.has_lyrics ? "Đang tải phụ đề..." : "Không có sub.");
}

function clearSubtitles(message = "") {
    subtitleCues = [];
    activeSubtitleIndex = -1;
    if (subtitleList) subtitleList.innerHTML = "";
    if (message) setText("lyricsStatus", message);
}

function renderSubtitles(cues) {
    if (!subtitleList) return;

    subtitleList.innerHTML = "";
    cues.forEach((cue, index) => {
        const line = document.createElement("div");
        line.className = "subtitle-line";
        line.dataset.subtitleIndex = String(index);
        line.textContent = cue.text;
        line.addEventListener("click", () => {
            if (audioPlayer) audioPlayer.currentTime = cue.start;
        });
        subtitleList.appendChild(line);
    });
}

async function loadSubtitles(track) {
    const token = ++subtitleRequestToken;
    clearSubtitles(track.has_lyrics ? "Đang tải phụ đề..." : "Không có sub.");

    if (!track.id || !track.has_lyrics) return;

    try {
        const response = await fetch(`/subtitles/${encodeURIComponent(track.id)}?lang=vi,en`);
        const data = await response.json();

        if (token !== subtitleRequestToken) return;

        if (!response.ok || !data.success) {
            throw new Error(data.error || "Không tải được phụ đề");
        }

        subtitleCues = data.cues || [];
        renderSubtitles(subtitleCues);
        setText("lyricsStatus", subtitleCues.length ? `${data.name || data.language} • ${subtitleCues.length} dòng` : "Không có sub.");
    } catch (error) {
        if (token !== subtitleRequestToken) return;
        clearSubtitles("Không có sub.");
    }
}

function updateSubtitle(currentSeconds) {
    if (!subtitleCues.length || !subtitleList) return;

    const nextIndex = subtitleCues.findIndex((cue) => currentSeconds >= cue.start && currentSeconds < cue.end);
    if (nextIndex === activeSubtitleIndex) return;

    const previousLine = subtitleList.querySelector(".subtitle-line.is-active");
    if (previousLine) previousLine.classList.remove("is-active");

    activeSubtitleIndex = nextIndex;
    if (nextIndex === -1) return;

    const activeLine = subtitleList.querySelector(`[data-subtitle-index="${nextIndex}"]`);
    if (activeLine) {
        activeLine.classList.add("is-active");
        activeLine.scrollIntoView({ block: "center", behavior: "smooth" });
    }
}

function loadTrack(index, autoplay = false) {
    if (!tracks.length || !audioPlayer) return;

    currentTrackIndex = (index + tracks.length) % tracks.length;
    const track = tracks[currentTrackIndex];

    updateTrackInfo(track);
    loadSubtitles(track);
    setActiveTrack(currentTrackIndex);
    progressFill.style.width = "0%";
    currentTime.textContent = "0:00";

    if (track.audio_url) {
        audioPlayer.src = track.audio_url;
        audioPlayer.load();
    } else {
        audioPlayer.removeAttribute("src");
        setPlayButtons(false);
        return;
    }

    if (autoplay) {
        audioPlayer.play().catch(() => setPlayButtons(false));
    }
}

function getRandomPlaylistIndex() {
    if (currentPlaylistIndexes.length <= 1) return currentTrackIndex;

    const choices = currentPlaylistIndexes.filter((index) => index !== currentTrackIndex);
    return choices[Math.floor(Math.random() * choices.length)];
}

function togglePlay() {
    if (!audioPlayer || !tracks.length) return;

    if (!audioPlayer.src) {
        loadTrack(currentTrackIndex, true);
        return;
    }

    if (audioPlayer.paused) {
        audioPlayer.play().catch(() => setPlayButtons(false));
        mainPlayButton.style.paddingLeft = "7px";
        mainPlayButton.style.paddingBottom = "7px";
        playPauseButton.style.paddingLeft = "7px";
        playPauseButton.style.paddingBottom = "5px";
    } else {
        audioPlayer.pause();
        mainPlayButton.style.paddingLeft = "12px";
        mainPlayButton.style.paddingBottom = "7px";
        playPauseButton.style.paddingLeft = "9px";
        playPauseButton.style.paddingBottom = "3px";
    }
}

function playNext() {
    if (!currentPlaylistIndexes.length) return;
    if (isShuffle) {
        loadTrack(getRandomPlaylistIndex(), true);
        return;
    }

    const position = currentPlaylistIndexes.indexOf(currentTrackIndex);
    const nextPosition = position === -1 ? 0 : (position + 1) % currentPlaylistIndexes.length;
    loadTrack(currentPlaylistIndexes[nextPosition], true);

    if (audioPlayer.paused) {
        audioPlayer.play().catch(() => setPlayButtons(false));
        mainPlayButton.style.paddingLeft = "7px";
        mainPlayButton.style.paddingBottom = "7px";
        playPauseButton.style.paddingLeft = "7px";
        playPauseButton.style.paddingBottom = "5px";
    } else {
        audioPlayer.pause();
        mainPlayButton.style.paddingLeft = "12px";
        mainPlayButton.style.paddingBottom = "7px";
        playPauseButton.style.paddingLeft = "9px";
        playPauseButton.style.paddingBottom = "3px";
    }
}

function playPrevious() {
    if (audioPlayer && audioPlayer.currentTime > 3) {
        audioPlayer.currentTime = 0;
        return;
    }

    if (!currentPlaylistIndexes.length) return;
    const position = currentPlaylistIndexes.indexOf(currentTrackIndex);
    const previousPosition = position === -1 ? 0 : (position - 1 + currentPlaylistIndexes.length) % currentPlaylistIndexes.length;
    loadTrack(currentPlaylistIndexes[previousPosition], true);

    if (audioPlayer.paused) {
        audioPlayer.play().catch(() => setPlayButtons(false));
        mainPlayButton.style.paddingLeft = "7px";
        mainPlayButton.style.paddingBottom = "7px";
        playPauseButton.style.paddingLeft = "7px";
        playPauseButton.style.paddingBottom = "5px";
    } else {
        audioPlayer.pause();
        mainPlayButton.style.paddingLeft = "12px";
        mainPlayButton.style.paddingBottom = "7px";
        playPauseButton.style.paddingLeft = "9px";
        playPauseButton.style.paddingBottom = "3px";
    }
}

function handleTrackEnded() {
    if (repeatMode === "one") {
        audioPlayer.currentTime = 0;
        audioPlayer.play().catch(() => setPlayButtons(false));
        return;
    }

    const position = currentPlaylistIndexes.indexOf(currentTrackIndex);
    const isLastTrack = position === currentPlaylistIndexes.length - 1;

    if (repeatMode === "off" && isLastTrack && !isShuffle) {
        setPlayButtons(false);
        return;
    }

    playNext();
}

function toggleShuffle() {
    isShuffle = !isShuffle;
    if (shuffleButton) shuffleButton.classList.toggle("active", isShuffle);
}

function toggleRepeat() {
    if (repeatMode === "off") {
        repeatMode = "all";
    } else if (repeatMode === "all") {
        repeatMode = "one";
    } else {
        repeatMode = "off";
    }

    if (repeatButton) {
        repeatButton.classList.toggle("active", repeatMode !== "off");
        repeatButton.textContent = repeatMode === "one" ? "↻1" : "↻";
        repeatButton.setAttribute("aria-label", repeatMode === "off" ? "Repeat" : `Repeat ${repeatMode}`);
    }
}

function updateProgress() {
    if (!audioPlayer || isSeeking) return;

    const duration = audioPlayer.duration;
    const position = audioPlayer.currentTime;
    const percent = duration ? (position / duration) * 100 : 0;

    const clampedPercent = Math.min(percent, 100);
    progressFill.style.width = `${clampedPercent}%`;
    if (progressThumb) progressThumb.style.left = `${clampedPercent}%`;
    currentTime.textContent = formatTime(position);
    if (duration) totalTime.textContent = formatTime(duration);
    updateSubtitle(position);
}

function getSeekPercent(event) {
    const clientX = event.touches?.[0]?.clientX ?? event.changedTouches?.[0]?.clientX ?? event.clientX;
    const rect = progressBar.getBoundingClientRect();
    return Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
}

function setProgressPreview(percent) {
    const clampedPercent = Math.min(Math.max(percent, 0), 1) * 100;
    progressFill.style.width = `${clampedPercent}%`;
    if (progressThumb) progressThumb.style.left = `${clampedPercent}%`;
    if (audioPlayer?.duration) {
        currentTime.textContent = formatTime(audioPlayer.duration * percent);
    }
}

function seek(event) {
    if (!audioPlayer || !audioPlayer.duration) return;

    const percent = getSeekPercent(event);
    audioPlayer.currentTime = percent * audioPlayer.duration;
    updateProgress();
}

function startProgressDrag(event) {
    if (!audioPlayer || !audioPlayer.duration || !progressBar) return;
    event.preventDefault();
    isSeeking = true;
    progressBar.classList.add("is-dragging");
    setProgressPreview(getSeekPercent(event));
    window.addEventListener("mousemove", dragProgress);
    window.addEventListener("mouseup", endProgressDrag);
    window.addEventListener("touchmove", dragProgress, { passive: false });
    window.addEventListener("touchend", endProgressDrag);
}

function dragProgress(event) {
    if (!isSeeking) return;
    event.preventDefault();
    setProgressPreview(getSeekPercent(event));
}

function endProgressDrag(event) {
    if (!isSeeking) return;
    const percent = getSeekPercent(event);
    audioPlayer.currentTime = percent * audioPlayer.duration;
    isSeeking = false;
    progressBar.classList.remove("is-dragging");
    updateProgress();
    window.removeEventListener("mousemove", dragProgress);
    window.removeEventListener("mouseup", endProgressDrag);
    window.removeEventListener("touchmove", dragProgress);

    window.removeEventListener("touchend", endProgressDrag);
}

document.querySelectorAll(".song-row[data-track-index]").forEach((element) => {
    element.addEventListener("click", () => {
        loadTrack(Number(element.dataset.trackIndex), true);
    });
});

document.querySelectorAll("[data-row-action]").forEach((button) => {
    button.addEventListener("click", (event) => {
        event.stopPropagation();
        const trackId = button.dataset.trackId;
        if (button.dataset.rowAction === "add") {
            openAddToPlaylistModal(trackId);
        } else if (button.dataset.rowAction === "remove") {
            if (currentPlaylistName === "Added Music") {
                const ok = confirm('Bạn có chắc muốn xóa bài này vĩnh viễn? (JSON và file âm thanh sẽ bị xóa)');
                if (ok) deleteTrack(trackId);
            } else {
                removeTrackFromPlaylist(trackId);
            }
        }
    });
});

document.querySelectorAll(".playlist-item").forEach((button) => {
    button.addEventListener("click", () => setActivePlaylist(button));
});

if (mainPlayButton) mainPlayButton.addEventListener("click", togglePlay);
if (playPauseButton) playPauseButton.addEventListener("click", togglePlay);
if (previousButton) previousButton.addEventListener("click", playPrevious);
if (nextButton) nextButton.addEventListener("click", playNext);
if (progressBar) {
    progressBar.addEventListener("click", seek);
    progressBar.addEventListener("mousedown", startProgressDrag);
    progressBar.addEventListener("touchstart", startProgressDrag, { passive: false });
}
if (volumeIcon) volumeIcon.addEventListener("click", toggleMute);
if (volumeBar) {
    volumeBar.addEventListener("click", setVolumeFromEvent);
    volumeBar.addEventListener("mousedown", startVolumeDrag);
    volumeBar.addEventListener("touchstart", startVolumeDrag, { passive: false });
}
if (shuffleButton) shuffleButton.addEventListener("click", toggleShuffle);
if (repeatButton) repeatButton.addEventListener("click", toggleRepeat);
if (addPlaylistButton) addPlaylistButton.addEventListener("click", openPlaylistModal);
if (playlistOptionsButton) playlistOptionsButton.addEventListener("click", openDeletePlaylistModal);
if (cancelPlaylistButton) cancelPlaylistButton.addEventListener("click", closePlaylistModal);
if (cancelAddToPlaylistButton) cancelAddToPlaylistButton.addEventListener("click", closeAddToPlaylistModal);
if (confirmPlaylistButton) confirmPlaylistButton.addEventListener("click", async () => {
    if (!playlistNameInput) return;
    const playlistName = playlistNameInput.value.trim();
    if (playlistName) {
        try {
            await createPlaylist(playlistName);
            closePlaylistModal();
        } catch (error) {
            playlistNameInput.focus();
            playlistNameInput.setCustomValidity(error.message);
            playlistNameInput.reportValidity();
            playlistNameInput.setCustomValidity("");
        }
    }
});
if (playlistModal) {
    playlistModal.addEventListener("click", (event) => {
        if (event.target === playlistModal) closePlaylistModal();
    });
}
if (addToPlaylistModal) {
    addToPlaylistModal.addEventListener("click", (event) => {
        if (event.target === addToPlaylistModal) closeAddToPlaylistModal();
    });
}
if (confirmDeletePlaylistButton) confirmDeletePlaylistButton.addEventListener("click", confirmDeletePlaylist);
if (cancelDeletePlaylistButton) cancelDeletePlaylistButton.addEventListener("click", closeDeletePlaylistModal);
if (deletePlaylistModal) {
    deletePlaylistModal.addEventListener("click", (event) => {
        if (event.target === deletePlaylistModal) closeDeletePlaylistModal();
    });
}
if (playlistNameInput) {
    playlistNameInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
            event.preventDefault();
            confirmPlaylistButton?.click();
        }
    });
}

if (audioPlayer) {
    if (!audioPlayer.volume) {
        audioPlayer.volume = 0.75;
    }
    updateVolumeUI(audioPlayer.volume);
    audioPlayer.addEventListener("play", () => setPlayButtons(true));
    audioPlayer.addEventListener("pause", () => setPlayButtons(false));
    audioPlayer.addEventListener("timeupdate", updateProgress);
    audioPlayer.addEventListener("loadedmetadata", updateProgress);
    audioPlayer.addEventListener("ended", handleTrackEnded);
    audioPlayer.addEventListener("volumechange", () => updateVolumeUI(audioPlayer.muted ? 0 : audioPlayer.volume));
}

refreshPlaylistButtons();
showPlaylist("Added Music");

if (addMusicForm) {
    addMusicForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const url = musicUrlInput.value.trim();
        if (!url) return;

        addMusicButton.disabled = true;
        addMusicStatus.className = "add-music-status";
        addMusicStatus.textContent = "Downloading audio and reading metadata...";

        try {
            const response = await fetch("/add-music", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ url })
            });
            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.error || "Could not add this song");
            }

            addMusicStatus.className = "add-music-status success";
            addMusicStatus.textContent = "Added. Refreshing library...";
            window.location.reload();
        } catch (error) {
            addMusicStatus.className = "add-music-status error";
            addMusicStatus.textContent = error.message;
            addMusicButton.disabled = false;
        }
    });
}
