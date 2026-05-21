# 🎵 YouTube to Music

> Một ứng dụng web để tải nhạc từ YouTube và xây dựng thư viện nhạc cá nhân của bạn

[![Python](https://img.shields.io/badge/Python-3.8+-blue.svg)](https://www.python.org/)
[![Flask](https://img.shields.io/badge/Flask-Latest-green.svg)](https://flask.palletsprojects.com/)

---

## ✨ Tính năng chính

- 🎥 **Tải nhạc từ YouTube**: Hỗ trợ tải audio chất lượng cao từ các video YouTube
- 📋 **Tạo Playlist**: Tổ chức nhạc thành các playlist theo sở thích
- 📝 **Hỗ trợ phụ đề**: Tải và hiển thị phụ đề (Vietnamese, English, ...)
- 🎨 **Giao diện thân thiện**: Thiết kế UI hiện đại giống Spotify
- 🌐 **API RESTful**: Hỗ trợ tương tác qua API để mở rộng chức năng

---

## 🛠️ Yêu cầu hệ thống

- **Python**: 3.8+
- **Node.js**: 14+ (tùy chọn, nếu sử dụng build tool)
- **yt-dlp**: Được cài đặt và có trong PATH (để tải YouTube)

---

## 📦 Cài đặt

### 1. Clone repository

```bash
git clone https://github.com/DODANGHOANCNTT2K15/youtube-to-music.git
cd youtube-to-music
```

### 2. Cài đặt dependencies

```bash
pip install -r requirements.txt
```

Hoặc từ file environment:

```bash
pip install -r environment.txt
```

### 3. Cài đặt yt-dlp

```bash
# Sử dụng pip
pip install yt-dlp

# Hoặc tải từ GitHub
# https://github.com/yt-dlp/yt-dlp
```

### 4. Chạy ứng dụng

**Trên Windows:**

```bash
./run_music.bat
```

**Trên Linux/Mac:**

```bash
python app.py
```

Ứng dụng sẽ chạy tại `http://localhost:5000`

---

## 🚀 Hướng dẫn sử dụng

### Giao diện web

1. Mở trình duyệt và truy cập: **http://localhost:5000**
2. Dán link YouTube vào ô tìm kiếm
3. Nhấn "Thêm" để tải nhạc
4. Quản lý playlist và phát nhạc

### Tạo playlist

- Bấm nút "Tạo Playlist" 
- Nhập tên playlist
- Thêm bài hát vào playlist

### Xem phụ đề

- Phụ đề sẽ tự động hiển thị nếu có sẵn
- Hỗ trợ tiếng Việt (vi) và tiếng Anh (en)

---

## 📁 Cấu trúc thư mục

```
youtube-to-music/
├── app.py                  # Ứng dụng Flask chính
├── get_audio.py            # Module tải audio từ YouTube
├── get_music_json.py       # Module lấy metadata nhạc
├── run_music.bat           # Script chạy trên Windows
├── environment.txt         # Dependencies
├── requirements.txt        # Dependencies (pip format)
├── templates/              # HTML templates
│   └── spotify.html        # UI chính
├── static/                 # CSS, JavaScript
│   ├── css/               # Stylesheet
│   └── js/                # JavaScript files
└── storage/               # Thư mục lưu trữ
    ├── music/             # Nhạc đã tải
    ├── jsonmusic/         # Metadata JSON
    ├── subtitles/         # Cache phụ đề
    └── playlist/          # Playlist JSON
```

---

## 🔌 API Endpoints

### 📚 Danh sách nhạc

- **GET** `/` - Trang chính

### 🎵 Quản lý nhạc

- **POST** `/add-music` - Thêm nhạc từ URL YouTube
- **DELETE** `/tracks/<track_id>` - Xóa bài hát

```bash
# Thêm nhạc
curl -X POST http://localhost:5000/add-music \
  -H "Content-Type: application/json" \
  -d '{"url":"https://www.youtube.com/watch?v=..."}'

# Xóa nhạc
curl -X DELETE http://localhost:5000/tracks/<track_id>
```

### 📋 Quản lý Playlist

- **GET** `/playlists` - Lấy danh sách playlist
- **POST** `/playlists` - Tạo playlist mới
- **DELETE** `/playlists/<name>` - Xóa playlist
- **POST** `/playlists/<name>/tracks` - Thêm bài hát vào playlist
- **DELETE** `/playlists/<name>/tracks/<track_id>` - Xóa bài hát khỏi playlist

```bash
# Tạo playlist
curl -X POST http://localhost:5000/playlists \
  -H "Content-Type: application/json" \
  -d '{"name":"My Playlist"}'

# Thêm bài hát
curl -X POST http://localhost:5000/playlists/MyPlaylist/tracks \
  -H "Content-Type: application/json" \
  -d '{"track_id":"dQw4w9WgXcQ"}'
```

### 📝 Phụ đề

- **GET** `/subtitles/<track_id>` - Lấy phụ đề

```bash
# Lấy phụ đề (mặc định: Tiếng Việt & Tiếng Anh)
curl "http://localhost:5000/subtitles/dQw4w9WgXcQ?lang=vi,en"
```

### 🔗 Utility

- **GET** `/get-audio-link?url=<youtube_url>` - Lấy link audio trực tiếp
- **GET** `/get-json-link?url=<youtube_url>` - Lấy metadata JSON

---

## 🛠️ Công nghệ sử dụng

| Công nghệ | Mục đích |
|-----------|---------|
| **Flask** | Backend web framework |
| **yt-dlp** | Tải video/audio từ YouTube |
| **Python** | Ngôn ngữ lập trình |
| **HTML/CSS/JS** | Frontend |
| **SQLite (JSON)** | Lưu trữ metadata & playlist |

---

## ⚙️ Cấu hình

### Thay đổi thư mục lưu trữ

Chỉnh sửa các đường dẫn trong `app.py`:

```python
BASE_DIR = Path(__file__).resolve().parent
JSON_MUSIC_DIR = BASE_DIR / "storage" / "jsonmusic"
STORAGE_DIR = BASE_DIR / "storage"
```

### Thay đổi cổng (Port)

Sửa dòng cuối cùng trong `app.py`:

```python
if __name__ == "__main__":
    app.run(debug=True, port=5000)  # Đổi 5000 thành port khác
```

### Ngôn ngữ phụ đề

Chỉnh sửa trong `app.py` hoặc URL API:

```python
# Mặc định
languages = [
    language.strip()
    for language in (request.args.get("lang") or "vi,en").split(",")
    if language.strip()
]
```

---

## 📝 Ghi chú quan trọng

⚠️ **Cảnh báo:** 
- Đảm bảo bạn có quyền tải xuống nội dung từ YouTube
- Tuân thủ Điều khoản dịch vụ của YouTube
- Chỉ sử dụng cho mục đích cá nhân

---

## 🐛 Gỡ lỗi

### "yt-dlp not found"

```bash
# Cài đặt yt-dlp
pip install yt-dlp

# Hoặc cài toàn cục
python -m pip install yt-dlp
```

### "Không thể kết nối tới Flask"

- Kiểm tra port 5000 có bị dùng bởi ứng dụng khác không
- Thử chạy với port khác: `python app.py --port 8000`


---

## 📞 Hỗ trợ

- 🐛 Issues: [GitHub Issues](https://github.com/DODANGHOANCNTT2K15/youtube-to-music/issues)
- 💬 Discussions: [GitHub Discussions](https://github.com/DODANGHOANCNTT2K15/youtube-to-music/discussions)

---

## 🙏 Cảm ơn

- [yt-dlp](https://github.com/yt-dlp/yt-dlp) - YouTube downloader
- [Flask](https://flask.palletsprojects.com/) - Web framework
- [Flask-CORS](https://flask-cors.readthedocs.io/) - CORS support

---

## 🌟 Yêu cầu Star

Nếu bạn thấy project này hữu ích, hãy cho nó một ⭐ trên GitHub!

---

**Made with ❤️ by [DODANGHOANCNTT2K15](https://github.com/DODANGHOANCNTT2K15)**
