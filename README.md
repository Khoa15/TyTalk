# TyTalk — Bầu trời đầy sao bắt đầu từ một cuộc trò chuyện

**TyTalk** đưa bé từ 5 đến 15 tuổi lên hành trình khám phá Thiên Văn và Vũ Trụ, qua trò chuyện bằng giọng nói với **Orb**, một người bạn nhỏ hình ngôi sao.

Bé hỏi gì, Orb trả lời nấy: vì sao có ngày có đêm, Mặt Trăng đổi hình dạng thế nào, hố đen có thật không, tên lửa bay lên vũ trụ ra sao. Mỗi câu trả lời đi kèm hình ảnh, hiệu ứng và mô phỏng sinh động, để bé không chỉ nghe mà còn **nhìn thấy** vũ trụ đang hoạt động.

---

## Vấn đề

- Thiên Văn hấp dẫn trẻ em, nhưng sách và video thường quá dài, quá khô hoặc quá nhiều thuật ngữ.
- Trẻ hay hỏi "Tại sao?" liên tục. Phụ huynh và giáo viên không phải lúc nào cũng có sẵn câu trả lời đơn giản, đúng và phù hợp độ tuổi.
- Internet mở ra cả thế giới, nhưng không phải nội dung nào cũng an toàn cho trẻ.

## Giải pháp

TyTalk là một người bạn đồng hành học tập:

- **Nói chuyện tự nhiên**: bé hỏi bằng lời, Orb đáp bằng lời, ngắn gọn và dễ hiểu.
- **Học bằng hình ảnh và mô phỏng**: Orb biến thành Mặt Trời, Trái Đất, Mặt Trăng, thiên hà xoáy hay hố đen để minh họa ngay điều đang nói.
- **Giải thích bằng ví dụ quen thuộc**: quả bóng, cây đèn pin, chiếc bánh quy thay cho những khái niệm trừu tượng.
- **Chỉ nói về vũ trụ**: mọi câu hỏi lạc đề được đưa nhẹ nhàng về chủ đề không gian.
- **An toàn cho trẻ**: không hỏi thông tin cá nhân như tên trường, địa chỉ, số điện thoại hay ảnh của bé. Nội dung đáng sợ hoặc không phù hợp với trẻ em sẽ được từ chối một cách nhẹ nhàng.

## Bé sẽ được gì

| Với bé | Với phụ huynh và giáo viên |
|---|---|
| Hiểu vì sao có Nhật thực, Nguyệt thực, các mùa, thủy triều | Có một trợ giảng Thiên Văn luôn sẵn sàng, giải thích đúng ở mức tuổi của con |
| Được tự đặt câu hỏi, không ngại hỏi lại | Nội dung được thiết kế riêng cho trẻ 5–15 tuổi, không phải nội dung người lớn |
| Ghi nhớ kiến thức nhờ hình ảnh và trò chơi tương tác | Không lưu nội dung trò chuyện: chỉ lưu tài khoản và đặc điểm cá nhân hóa cơ bản |
| Mỗi ngày một điều mới về vũ trụ | Dễ dùng ở nhà hoặc trên lớp, chỉ cần trình duyệt |

## Các phần chính của trải nghiệm

- **Orb, người bạn hình sao**: giọng nói vui tươi, hoạt bát, luôn khích lệ bé tò mò.
- **Hình biến đổi**: Orb hóa thành Mặt Trời, Trái Đất, Mặt Trăng, thiên hà hoặc hố đen khi câu chuyện cần.
- **Mô phỏng vũ trụ**: ngày và đêm, các pha Mặt Trăng, nhật thực và nguyệt thực, hệ Mặt Trời, trọng lực trên Trái Đất, Sao Hỏa, Mộc Tinh, thủy triều, cực quang, vòng đời của sao, tên lửa phóng lên.
- **Hình ảnh minh họa**: tranh và ảnh liên quan được hiển thị ngay khi Orb đang kể.
- **Mỗi câu trả lời đều ngắn gọn**: vài câu thôi, đủ để bé hiểu và muốn hỏi tiếp.

## Dành cho ai

- **Trẻ 5–15 tuổi** muốn khám phá vũ trụ theo cách vui và dễ hiểu.
- **Phụ huynh** muốn con học thêm kiến thức khoa học trong một môi trường an toàn.
- **Giáo viên và người hướng dẫn** cần một công cụ minh họa sinh động cho bài học về Thiên Văn.

## Bắt đầu nhanh

Yêu cầu: Docker, Python 3.13 và Node.js.

1. Sao chép cấu hình mẫu và điền thông tin:

   ```bash
   cp .env.example .env
   ```

   Điền `JWT_SECRET` và `LLM_API_KEY`. Không commit file `.env`.

2. Khởi động cơ sở dữ liệu MySQL:

   ```bash
   docker compose up -d
   ```

3. Chạy backend (FastAPI) và frontend (React + Vite) theo hướng dẫn trong thư mục `backend/` và `frontend/`.

4. Mở trình duyệt, vào trang chủ và bấm **Get Started** để bắt đầu trò chuyện cùng Orb.

## Công nghệ

- **Backend**: FastAPI, Python 3.13, MySQL 8, xác thực JWT.
- **Frontend**: React, Vite, TypeScript.
- **AI**: tương thích mọi endpoint OpenAI-compatible (OpenRouter, OpenAI, DeepSeek, Gemini, Qwen, Anthropic Claude…), chỉ cần đổi cấu hình.
- **Triển khai**: Docker Compose.

Tài liệu thiết kế cơ sở dữ liệu nằm tại [docs/erd.md](docs/erd.md). Bộ thiết kế giao diện vũ trụ nằm tại [docs/space-design-system.html](docs/space-design-system.html).

---

**TyTalk**: mỗi câu hỏi của bé là một chuyến bay mới vào vũ trụ.
