from flask import Flask, request, jsonify
from flask_cors import CORS

from get_audio import get_audio_link
from get_music_json import get_json_link

app = Flask(__name__)
CORS(app)


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