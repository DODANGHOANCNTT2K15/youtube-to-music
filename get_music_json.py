import subprocess
import json
from pathlib import Path

# Define
storage_json_dir = Path("storage/jsonmusic")
storage_music_dir = Path("storage/music")

storage_json_dir.mkdir(parents=True, exist_ok=True)
storage_music_dir.mkdir(parents=True, exist_ok=True)

def find_stored_music(video_id):
    for ext in ["m4a", "mp3", "opus", "webm"]:
        path = storage_music_dir / f"{video_id}.{ext}"
        if path.exists():
            return path
    return None

def get_json_link(link):
    result = subprocess.run(
        ["yt-dlp", "-j", link],
        capture_output=True,
        text=True,
        encoding="utf-8"
    )

    if result.returncode != 0:
        print("❌ Lỗi:", result.stderr)
        exit(1)

    data = json.loads(result.stdout)
    video_id = data.get("id")

    cleaned = {
        "id": video_id,
        "title": data.get("title"),
        "thumbnail": data.get("thumbnail"),
        "channel_url": data.get("channel_url"),
        "tags": data.get("tags"),
        "channel": data.get("channel"),
        "duration_string": data.get("duration_string"),
        "language": data.get("language"),
        "view_count": data.get("view_count"),
        "upload_date": data.get("upload_date"),
        
        "subtitles": data.get("subtitles") or None,
        "automatic_captions": {}, 

        "audio_location": str(find_stored_music(video_id)) if find_stored_music(video_id) else None
    }

    auto_captions = data.get("automatic_captions") or {}
    for lang in ["en", "vi"]:
        if lang in auto_captions:
            items = auto_captions[lang]
            filtered = [item for item in items if item.get("ext") in ["json3", "vtt"]]
            if filtered:
                cleaned["automatic_captions"][lang] = filtered[:2]

    json_path = storage_json_dir / f"{video_id}.json"

    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(cleaned, f, ensure_ascii=False, indent=2)

    print("Success Get JSON!")