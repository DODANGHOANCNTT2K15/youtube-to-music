import subprocess
import os


def get_audio_link(link, storage_path="storage/music"):
    os.makedirs(storage_path, exist_ok=True)

    command = [
        "yt-dlp",
        "-f", "bestaudio",
        "-o", f"{storage_path}/%(id)s.%(ext)s",
        link
    ]

    try:

        result = subprocess.run(
            command,
            capture_output=True,
            text=True,
            check=True
        )

        print("Download success!")
        print(result.stdout)

        return True

    except subprocess.CalledProcessError as e:

        print("Error while downloading:")
        print(e.stderr)

        return False

    except FileNotFoundError:

        print("yt-dlp not found!")

        return False