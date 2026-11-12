const http = require('http');
const fs = require('fs');
const path = require('path');
const dns2 = require('dns2');
const { Packet } = dns2;

const SERVER_IP = '192.168.137.1';

// 1. TẠO DNS SERVER (CỔNG 53) - Chặn và trỏ mọi tên miền về máy bạn
const dnsServer = dns2.createServer({
    udp: true,
    handle: (request, send, rinfo) => {
        const response = Packet.createResponseFromRequest(request);
        const [question] = request.questions;
        const { name } = question;
        console.log(`[DNS Intercept] ${name} -> Trỏ về ${SERVER_IP}`);
        
        response.answers.push({
            name,
            type: Packet.TYPE.A,
            class: Packet.CLASS.IN,
            ttl: 60,
            address: SERVER_IP
        });
        send(response);
    }
});

dnsServer.listen({ udp: { port: 53, address: SERVER_IP } })
    .then(() => console.log(`✅ DNS Captive Server đang chạy tại cổng 53`))
    .catch(err => console.error('❌ Lỗi cổng 53 (Windows đang chiếm dụng):', err.message));

// 2. TẠO WEB SERVER (CỔNG 80) - Trả về giao diện tỏ tình
http.createServer((req, res) => {
    console.log(`[HTTP Request] ${req.url}`);

    // Bắt các gói tin kiểm tra mạng mặc định của điện thoại để ép mở trang chủ
    if (req.url.includes('generate_204') || req.url.includes('hotspot-detect') || req.url.includes('ncsi.txt')) {
        res.writeHead(302, { 'Location': `http://${SERVER_IP}/` });
        return res.end();
    }

    // Trả về file Video Streaming (Hỗ trợ định dạng H.264)
    if (req.url === '/video.mp4') {
        const videoPath = path.join(__dirname, 'video.mp4');
        if (!fs.existsSync(videoPath)) {
            res.writeHead(404);
            return res.end();
        }
        const stat = fs.statSync(videoPath);
        const fileSize = stat.size;
        const range = req.headers.range;

        if (range) {
            const parts = range.replace(/bytes=/, "").split("-");
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
            const chunksize = (end - start) + 1;
            const file = fs.createReadStream(videoPath, { start, end });
            res.writeHead(206, {
                'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                'Accept-Ranges': 'bytes',
                'Content-Length': chunksize,
                'Content-Type': 'video/mp4',
            });
            file.pipe(res);
        } else {
            res.writeHead(200, {
                'Content-Length': fileSize,
                'Content-Type': 'video/mp4',
            });
            fs.createReadStream(videoPath).pipe(res);
        }
        return;
    }

    // Mặc định trả về trang index.html chứa lời tỏ tình
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    fs.createReadStream(path.join(__dirname, 'index.html')).pipe(res);

}).listen(80, SERVER_IP, () => {
    console.log(`✅ Web Captive Server đang chạy tại http://${SERVER_IP}:80`);
});