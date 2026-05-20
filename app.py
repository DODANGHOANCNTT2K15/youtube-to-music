import json
import re
import subprocess
import tempfile
import urllib.request
from pathlib import Path

from flask import Flask, request, jsonify, render_template, send_from_directory, url_for
from flask_cors import CORS

from get_audio import get_audio_link
from get_music_json import get_json_link

app = Flask(__name__)
CORS(app)

BASE_DIR = Path(__file__).resolve().parent
JSON_MUSIC_DIR = BASE_DIR / "storage" / "jsonmusic"
STORAGE_DIR = BASE_DIR / "storage"
PLAYLIST_DIR = BASE_DIR / "storage" / "playlist"
PLAYLIST_FILE = PLAYLIST_DIR / "playlists.json"
SUBTITLE_DIR = BASE_DIR / "storage" / "subtitles"
ADDED_MUSIC_PLAYLIST = "Added Music"


def parse_json3_subtitles(payload):
    cues = []
    data = json.loads(payload)

    for event in data.get("events", []):
        segments = event.get("segs") or []
        text = "".join(segment.get("utf8", "") for segment in segments).strip()
        text = re.sub(r"\s+", " ", text)
        if not text:
            continue

        start = (event.get("tStartMs") or 0) / 1000
        duration = (event.get("dDurationMs") or 0) / 1000
        cues.append({
            "start": start,
            "end": start + duration if duration else start + 3,
            "text": text
        })

    return cues


def parse_vtt_timestamp(value):
    parts = value.replace(",", ".").split(":")
    seconds = float(parts[-1])
    minutes = int(parts[-2]) if len(parts) >= 2 else 0
    hours = int(parts[-3]) if len(parts) >= 3 else 0
    return hours * 3600 + minutes * 60 + seconds


def parse_vtt_subtitles(payload):
    cues = []
    blocks = re.split(r"\n\s*\n", payload.replace("\r\n", "\n").replace("\r", "\n"))

    for block in blocks:
        lines = [line.strip() for line in block.split("\n") if line.strip()]
        timing_index = next((index for index, line in enumerate(lines) if "-->" in line), None)
        if timing_index is None:
            continue

        timing = lines[timing_index]
        start_raw, end_raw = [part.strip().split(" ")[0] for part in timing.split("-->", 1)]
        text = " ".join(lines[timing_index + 1:]).strip()
        text = re.sub(r"<[^>]+>", "", text)
        text = re.sub(r"\s+", " ", text).strip()
        if not text:
            continue

        cues.append({
            "start": parse_vtt_timestamp(start_raw),
            "end": parse_vtt_timestamp(end_raw),
            "text": text
        })

    return cues


def find_subtitle_candidate(track_data, preferred_languages):
    sources = [
        ("subtitles", track_data.get("subtitles") or {}),
        ("automatic_captions", track_data.get("automatic_captions") or {}),
    ]

    for preferred_language in preferred_languages:
        for source_name, source_items in sources:
            for language, items in source_items.items():
                if not language.startswith(preferred_language):
                    continue

                for preferred_ext in ("json3", "vtt"):
                    for item in items:
                        if item.get("ext") == preferred_ext and item.get("url"):
                            return {
                                "source": source_name,
                                "language": language,
                                "name": item.get("name") or language,
                                "ext": preferred_ext,
                                "url": item["url"],
                            }

    for source_name, source_items in sources:
        for language, items in source_items.items():
            for preferred_ext in ("json3", "vtt"):
                for item in items:
                    if item.get("ext") == preferred_ext and item.get("url"):
                        return {
                            "source": source_name,
                            "language": language,
                            "name": item.get("name") or language,
                            "ext": preferred_ext,
                            "url": item["url"],
                        }

    return None


def fetch_subtitle_cues(track_id, preferred_languages):
    cache_path = SUBTITLE_DIR / f"{track_id}.json"
    if cache_path.exists():
        with cache_path.open("r", encoding="utf-8") as file:
            return json.load(file), None

    json_path = JSON_MUSIC_DIR / f"{track_id}.json"
    if not json_path.exists():
        return None, "Track does not exist"

    with json_path.open("r", encoding="utf-8") as file:
        track_data = json.load(file)

    candidate = find_subtitle_candidate(track_data, preferred_languages)
    if not candidate:
        return None, "No subtitle data in JSON"

    try:
        request_obj = urllib.request.Request(
            candidate["url"],
            headers={"User-Agent": "Mozilla/5.0"}
        )
        with urllib.request.urlopen(request_obj, timeout=12) as response:
            payload = response.read().decode("utf-8", errors="replace")
    except Exception:
        return fetch_subtitle_cues_with_ytdlp(track_id, preferred_languages)

    try:
        cues = parse_json3_subtitles(payload) if candidate["ext"] == "json3" else parse_vtt_subtitles(payload)
    except Exception as error:
        return None, f"Could not parse subtitle: {error}"

    subtitle_data = {
        "track_id": track_id,
        "language": candidate["language"],
        "name": candidate["name"],
        "source": candidate["source"],
        "cues": cues
    }
    save_subtitle_cache(track_id, subtitle_data)
    return subtitle_data, None


def save_subtitle_cache(track_id, subtitle_data):
    SUBTITLE_DIR.mkdir(parents=True, exist_ok=True)
    cache_path = SUBTITLE_DIR / f"{track_id}.json"
    with cache_path.open("w", encoding="utf-8") as file:
        json.dump(subtitle_data, file, ensure_ascii=False, indent=2)


def fetch_subtitle_cues_with_ytdlp(track_id, preferred_languages):
    with tempfile.TemporaryDirectory() as temp_dir:
        output_template = str(Path(temp_dir) / "%(id)s.%(ext)s")
        command = [
            "yt-dlp",
            "--skip-download",
            "--write-subs",
            "--write-auto-subs",
            "--sub-langs", ",".join(preferred_languages),
            "--sub-format", "json3/vtt",
            "-o", output_template,
            f"https://www.youtube.com/watch?v={track_id}",
        ]

        result = subprocess.run(
            command,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace"
        )

        if result.returncode != 0:
            return None, f"Could not fetch subtitle with yt-dlp: {result.stderr.strip()}"

        subtitle_files = sorted(Path(temp_dir).glob(f"{track_id}.*"))
        if not subtitle_files:
            return None, "No subtitle file downloaded"

        def score(path):
            name = path.name
            language_score = next(
                (index for index, language in enumerate(preferred_languages) if f".{language}." in name),
                len(preferred_languages)
            )
            ext_score = 0 if path.suffix == ".json3" else 1
            return language_score, ext_score

        subtitle_file = sorted(subtitle_files, key=score)[0]
        payload = subtitle_file.read_text(encoding="utf-8", errors="replace")
        cues = parse_json3_subtitles(payload) if subtitle_file.suffix == ".json3" else parse_vtt_subtitles(payload)

        parts = subtitle_file.name.split(".")
        language = parts[-2] if len(parts) >= 3 else "unknown"
        subtitle_data = {
            "track_id": track_id,
            "language": language,
            "name": language,
            "source": "yt-dlp",
            "cues": cues
        }
        save_subtitle_cache(track_id, subtitle_data)
        return subtitle_data, None


def get_all_music_ids():
    return sorted(json_file.stem for json_file in JSON_MUSIC_DIR.glob("*.json"))


def load_playlists():
    if not PLAYLIST_FILE.exists():
        playlists = {}
    else:
        with PLAYLIST_FILE.open("r", encoding="utf-8") as file:
            data = json.load(file)

        playlists = {}
        for name, track_ids in data.items():
            if isinstance(name, str) and isinstance(track_ids, list):
                playlists[name] = [str(track_id) for track_id in track_ids]

    original_playlists = dict(playlists)
    playlists[ADDED_MUSIC_PLAYLIST] = get_all_music_ids()
    playlists = {
        ADDED_MUSIC_PLAYLIST: playlists[ADDED_MUSIC_PLAYLIST],
        **{name: ids for name, ids in playlists.items() if name != ADDED_MUSIC_PLAYLIST}
    }
    if playlists != original_playlists or list(playlists.keys()) != list(original_playlists.keys()):
        save_playlists(playlists)
    return playlists


def save_playlists(playlists):
    PLAYLIST_DIR.mkdir(parents=True, exist_ok=True)
    with PLAYLIST_FILE.open("w", encoding="utf-8") as file:
        json.dump(playlists, file, ensure_ascii=False, indent=2)


def load_music_library():
    tracks = []

    for json_file in sorted(JSON_MUSIC_DIR.glob("*.json")):
        with json_file.open("r", encoding="utf-8") as file:
            data = json.load(file)

        audio_location = data.get("audio_location")
        audio_url = None
        if audio_location:
            audio_path = Path(audio_location.replace("\\", "/"))
            try:
                relative_audio = audio_path.relative_to("storage")
                audio_url = url_for("storage_file", filename=relative_audio.as_posix())
            except ValueError:
                audio_url = audio_location

        tracks.append({
            "id": data.get("id"),
            "title": data.get("title") or "Untitled",
            "artist": data.get("channel") or "Unknown Artist",
            "thumbnail": data.get("thumbnail"),
            "duration": data.get("duration_string") or "--:--",
            "views": data.get("view_count") or 0,
            "upload_date": data.get("upload_date") or "",
            "tags": data.get("tags") or [],
            "language": data.get("language") or "unknown",
            "audio_url": audio_url,
            "has_lyrics": bool(data.get("subtitles") or data.get("automatic_captions")),
        })

    return tracks


@app.route("/")
def index():
    tracks = load_music_library()
    playlists = load_playlists()
    current_track = tracks[0] if tracks else None
    return render_template(
        "spotify.html",
        tracks=tracks,
        playlists=playlists,
        current_track=current_track
    )


@app.route("/storage/<path:filename>")
def storage_file(filename):
    return send_from_directory(STORAGE_DIR, filename)


@app.route("/add-music", methods=["POST"])
def add_music():
    data = request.get_json(silent=True) or {}
    url = data.get("url") or request.form.get("url") or request.args.get("url")

    if not url:
        return jsonify({"success": False, "error": "Missing url"}), 400

    audio_success = get_audio_link(url)
    if not audio_success:
        return jsonify({"success": False, "error": "Could not download audio"}), 500

    music_data = get_json_link(url)

    return jsonify({
        "success": True,
        "track": music_data
    })


@app.route("/playlists", methods=["GET"])
def api_playlists():
    return jsonify(load_playlists())


@app.route("/playlists", methods=["POST"])
def api_create_playlist():
    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()

    if not name:
        return jsonify({"success": False, "error": "Missing playlist name"}), 400

    if name.lower() == ADDED_MUSIC_PLAYLIST.lower():
        return jsonify({"success": False, "error": "Added Music already exists"}), 400

    playlists = load_playlists()
    if name in playlists:
        return jsonify({"success": False, "error": "Playlist already exists"}), 409

    playlists[name] = []
    save_playlists(playlists)

    return jsonify({"success": True, "playlists": playlists})


@app.route("/playlists/<path:name>/tracks/<track_id>", methods=["DELETE"])
def api_remove_track_from_playlist(name, track_id):
    track_id = track_id.strip()

    if name == ADDED_MUSIC_PLAYLIST:
        return jsonify({"success": False, "error": "Added Music is synced from storage/jsonmusic"}), 400

    playlists = load_playlists()
    if name not in playlists:
        return jsonify({"success": False, "error": "Playlist does not exist"}), 404

    if track_id in playlists[name]:
        playlists[name].remove(track_id)
        save_playlists(playlists)

    return jsonify({"success": True, "playlists": load_playlists()})


@app.route("/playlists/<path:name>/tracks", methods=["POST"])
def api_add_track_to_playlist(name):
    data = request.get_json(silent=True) or {}
    track_id = (data.get("track_id") or "").strip()

    if not track_id:
        return jsonify({"success": False, "error": "Missing track id"}), 400

    if not (JSON_MUSIC_DIR / f"{track_id}.json").exists():
        return jsonify({"success": False, "error": "Track does not exist"}), 404

    playlists = load_playlists()
    if name not in playlists:
        return jsonify({"success": False, "error": "Playlist does not exist"}), 404

    if track_id not in playlists[name]:
        playlists[name].append(track_id)
        save_playlists(playlists)

    return jsonify({"success": True, "playlists": playlists})


@app.route("/playlists/<path:name>", methods=["DELETE"])
def api_delete_playlist(name):
    if name == ADDED_MUSIC_PLAYLIST:
        return jsonify({"success": False, "error": "Added Music cannot be deleted"}), 400

    playlists = load_playlists()
    if name not in playlists:
        return jsonify({"success": False, "error": "Playlist does not exist"}), 404

    del playlists[name]
    save_playlists(playlists)
    return jsonify({"success": True, "playlists": load_playlists()})


@app.route("/subtitles/<track_id>")
def api_subtitles(track_id):
    languages = [
        language.strip()
        for language in (request.args.get("lang") or "vi,en").split(",")
        if language.strip()
    ]
    data, error = fetch_subtitle_cues(track_id, languages)

    if error:
        return jsonify({"success": False, "error": error, "cues": []}), 404

    return jsonify({"success": True, **data})


@app.route("/tracks/<track_id>", methods=["DELETE"])
def api_delete_track(track_id):
    """Delete a track's JSON and associated audio/subtitle files from storage.

    This permanently removes the track JSON from `storage/jsonmusic` and
    attempts to remove the audio file referenced by `audio_location` in the
    JSON (if it points inside the storage folder). It also removes any cached
    subtitle file in `storage/subtitles` and removes the track id from any
    user playlists (except the auto-synced `Added Music`).
    """
    track_id = track_id.strip()
    json_path = JSON_MUSIC_DIR / f"{track_id}.json"

    if not json_path.exists():
        return jsonify({"success": False, "error": "Track does not exist"}), 404

    # Read JSON to find audio location (if present)
    try:
        with json_path.open("r", encoding="utf-8") as f:
            data = json.load(f)
    except Exception:
        data = {}

    # Remove json file
    try:
        json_path.unlink()
    except Exception:
        pass

    # Attempt to remove audio file if it exists and is under storage
    audio_location = data.get("audio_location")
    if audio_location:
        try:
            audio_path = Path(audio_location.replace("\\", "/"))
            # If relative to project, prefer resolving against BASE_DIR
            candidate = (BASE_DIR / audio_path) if not audio_path.is_absolute() else audio_path
            # Only unlink if inside our storage directory for safety
            try:
                candidate.relative_to(STORAGE_DIR)
                if candidate.exists():
                    candidate.unlink()
            except Exception:
                # If not under storage, still try to remove if absolute path
                if candidate.exists() and candidate.is_file():
                    try:
                        candidate.unlink()
                    except Exception:
                        pass
        except Exception:
            pass

    # Remove cached subtitle file
    try:
        subtitle_cache = SUBTITLE_DIR / f"{track_id}.json"
        if subtitle_cache.exists():
            subtitle_cache.unlink()
    except Exception:
        pass

    # Remove from user playlists (not the auto-synced Added Music)
    playlists = load_playlists()
    changed = False
    for name, ids in list(playlists.items()):
        if name == ADDED_MUSIC_PLAYLIST:
            continue
        if track_id in ids:
            playlists[name] = [tid for tid in ids if tid != track_id]
            changed = True
    if changed:
        save_playlists(playlists)

    return jsonify({"success": True, "playlists": load_playlists()})


@app.route("/get-audio-link")
def api_audio():

    url = request.args.get("url")

    audio_url = get_audio_link(url)

    return jsonify({
        "audio_url": audio_url
    })


@app.route("/get-json-link")
def api_json():

    url = request.args.get("url")

    data = get_json_link(url)

    return jsonify(data)


if __name__ == "__main__":
    app.run(debug=True)
