const https = require('https');
const fs = require('fs');
const admin = require('firebase-admin');

const CHANNEL_ID = 'UCZ419zRJjCB6jX8_bwZTNDA';
const LAST_VIDEO_FILE = 'last_video_id.txt';

// Firebase初期化
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

// YouTube最新動画を取得
function fetchLatestVideo() {
  return new Promise((resolve, reject) => {
    const url = `https://www.googleapis.com/youtube/v3/search?key=${process.env.YOUTUBE_API_KEY}&channelId=${CHANNEL_ID}&part=snippet,id&order=date&maxResults=1&type=video`;
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });
}

async function main() {
  const data = await fetchLatestVideo();

  if (!data.items || data.items.length === 0) {
    console.log('動画が見つかりませんでした');
    return;
  }

  const latest = data.items[0];
  const videoId = latest.id.videoId;
  const title = latest.snippet.title;
  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

  // 前回チェックしたIDと比較
  let lastVideoId = '';
  if (fs.existsSync(LAST_VIDEO_FILE)) {
    lastVideoId = fs.readFileSync(LAST_VIDEO_FILE, 'utf8').trim();
  }

  if (videoId === lastVideoId) {
    console.log('新着動画なし');
    return;
  }

  console.log(`新着動画を検出: ${title}`);

  // Firestoreのnoticesに書き込み
  const date = new Date().toISOString().slice(0, 10);
  await db.collection('notices').add({
    date,
    tag: 'new',
    text: `🎬【新着動画】${title}`,
    url: videoUrl,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });

  // 最後に確認したIDを更新
  fs.writeFileSync(LAST_VIDEO_FILE, videoId);
  console.log('✅ お知らせを追加しました');
}

main().catch(err => {
  console.error('エラー:', err);
  process.exit(1);
});
