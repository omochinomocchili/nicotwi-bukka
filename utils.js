// =============================================================
// utils.js — 共通ユーティリティ関数
// スパム/禁止タグ判定、日付フォーマット、投稿制限チェック、
// 引用文字列処理、虹色/五千兆円HTML生成など、
// 他のファイルから共通して呼ばれる小さな関数をまとめたもの。
// 依存: なし（DOMPurifyなど外部ライブラリのみ）
// =============================================================

  // ローディングオーバーレイ制御
  const loadingOverlay = document.getElementById('loadingOverlay');
  function showLoading(msg) {
      loadingOverlay.textContent = msg || '読み込み中…';
      // body の transform 影響を受けないよう html 直下に移動
      if (loadingOverlay.parentElement !== document.documentElement) {
          document.documentElement.appendChild(loadingOverlay);
      }
      loadingOverlay.classList.remove('hidden');
  }
  function hideLoading() {
      loadingOverlay.classList.add('hidden');
  }
  const NORMAL_COMMENT_MAX_LENGTH = 140; // 通常コメントの最大文字数

  // 同一内容の投稿制限
  const SAME_CONTENT_RATE_LIMIT_1MIN = 60 * 1000; // 1分
  const MAX_SAME_CONTENT_1MIN = 3; // 1分間に3個まで (4個目から禁止)

  const SAME_CONTENT_RATE_LIMIT_5MIN = 5 * 60 * 1000; // 5分
  const MAX_SAME_CONTENT_5MIN = 5; // 5分間に5個まで (6個目から禁止)

  // 同一人物の投稿間隔制限
  const MIN_POST_INTERVAL_PER_USER = 3 * 1000; // 3秒

  const SPAM_KEYWORDS = [
      "bit.ly", "goo.gl", "tinyurl.com", // 短縮URL
      "http", "https", "www.", ".com", ".net", ".org", // 一般的なURLパターン
    
  ];
  const SPAM_URL_PATTERNS = [
      /https?:\/\/(?:www\.)?(?:bit\.ly|goo\.gl|tiny\.cc)\/[\w-]+/i, // 短縮URL
      /https?:\/\/(?:www\.)?[\w.-]+\.(?:com|net|org|jp)\/[\w.-]*/i // 一般的なURL
  ];

  // HTMLフォーム要素や危険な可能性のあるタグを検出する正規表現
  const FORBIDDEN_HTML_TAGS_REGEX = /<(input|select|textarea|button|form|iframe|script|style|link)[\s>]/i;


  function isNewDay(timestamp) {
      if (!timestamp) return true;
      const lastDate = new Date(timestamp);
      const now = new Date();

      const offset = 9 * 60 * 60 * 1000;
      const lastDayJST = Math.floor((lastDate.getTime() + offset) / (24 * 60 * 60 * 1000));
      const currentDayJST = Math.floor((now.getTime() + offset) / (24 * 60 * 60 * 1000));
      
      return currentDayJST > lastDayJST;
  }


  function containsSpam(text) {
      const lowerText = text.toLowerCase();

      for (const keyword of SPAM_KEYWORDS) {
          if (lowerText.includes(keyword.toLowerCase())) {
              return true;
          }
      }

      for (const pattern of SPAM_URL_PATTERNS) {
          if (pattern.test(lowerText)) {
              return true;
          }
      }
      return false;
  }

  // 追加: 禁止されたHTMLタグが含まれているかチェックする関数
  function containsForbiddenHtmlTags(text) {
      // DOMPurifyでサニタイズした後に、特定のタグが残っていないかを確認
      // DOMPurifyは基本的な危険なタグを除去するが、念のため最終チェック
      const sanitizedText = DOMPurify.sanitize(text);
      return FORBIDDEN_HTML_TAGS_REGEX.test(sanitizedText);
  }

  async function sha256(message) {
      const msgBuffer = new TextEncoder().encode(message);
      const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer)); 
      const hexHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      return hexHash;
  }

    // 同一内容のコメント制限をチェックするヘルパー関数
    function isSameContentRateLimited(name, text, timestamp) {
        const textHash = calculateTweetHash(text); // テキストハッシュを再計算または取得

        const recentPostsForUser = Object.values(allTweets).filter(
            t => t.name === name && calculateTweetHash(t.text) === textHash && t.timestamp <= timestamp
        ).sort((a, b) => a.timestamp - b.timestamp);

        // 1分間のチェック
        const postsInLast1Min = recentPostsForUser.filter(
            t => timestamp - t.timestamp < SAME_CONTENT_RATE_LIMIT_1MIN
        );
        if (postsInLast1Min.length > MAX_SAME_CONTENT_1MIN) {
            return true;
        }

        // 5分間のチェック
        const postsInLast5Min = recentPostsForUser.filter(
            t => timestamp - t.timestamp < SAME_CONTENT_RATE_LIMIT_5MIN
        );
        if (postsInLast5Min.length > MAX_SAME_CONTENT_5MIN) {
            return true;
        }

        return false;
    }
    
    // 投稿間隔をチェックするヘルパー関数
    function isPostIntervalViolated(name, timestamp) {
        const postsForUser = Object.values(allTweets).filter(
            t => t.name === name && t.timestamp < timestamp && t.type !== 'center_fixed' // 中央固定コメントはチェックしない
        ).sort((a, b) => b.timestamp - a.timestamp); // 最新の投稿からチェック

        if (postsForUser.length > 0) {
            const previousPostTime = postsForUser[0].timestamp;
            if (timestamp - previousPostTime < MIN_POST_INTERVAL_PER_USER) {
                return true;
            }
        }
        return false;
    }

    // `sha256`の同期版（実際にはPromiseを返すので、呼び出し側でawaitが必要）
    // allTweetsの初期ロード時に同期的に使えるように調整（ここではPromiseを考慮して仮実装）
    function calculateTweetHash(text) {
        // Warning: This is a simplified, non-cryptographic hash for demonstration.
        // For actual security, await sha256(text) would be needed.
        // For filtering existing tweets, a simple string hash for quick comparison is sufficient.
        let hash = 0;
        if (text.length === 0) return hash;
        for (let i = 0; i < text.length; i++) {
            const char = text.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash |= 0; // Convert to 32bit integer
        }
        return hash;
    }


  function formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    return `${year}/${month}/${day} ${hours}:${minutes}:${seconds}`;
  }

  // 引用元投稿から、装飾を無視したプレーンテキストの抜粋を作る（流れるコメントの引用プレフィックス用）
  function buildQuotePlainSnippet(quotedData) {
      let quotedRawText = quotedData.text || '';
      if (quotedRawText.startsWith('__SPLIT__')) {
          quotedRawText = quotedRawText.replace('__SPLIT__', '').replace('\n', ' ');
      }
      return DOMPurify.sanitize(quotedRawText);
  }

  // 本文中の「#quoteNumber」（引用マーカー）を取り除く。前後の空白も一緒にトリムする
  function stripQuoteMarker(text, quoteNumber) {
      if (!text || !quoteNumber) return text;
      return text.replace(new RegExp('#' + quoteNumber + '\\s*'), '').trim();
  }

  // 本文中の「#数字」をクリック可能な引用リンクに変換する（サニタイズ済みテキストに対して使用）
  function linkifyMentions(html) {
      if (!html) return html;
      return html.replace(/#(\d+)/g, (match, num) => {
          return `<span class="quote-mention" data-quote-number="${num}" onclick="jumpToTweetByNumber(${num})">#${num}</span>`;
      });
  }
     /**
 * テキストを6色基調のアニメーションHTMLに変換する
 * @param {string} text - 変換する元のテキスト
 * @returns {string} - アニメーション用の<span>タグでラップされたHTML文字列
 */
/**
 * 1. フローティングコメント（左側）用：アニメーションする虹色
 */
function toRainbowText(text) {
    const chars = Array.from(text);
    const totalChars = chars.length;
    let html = '';
    const animationDuration = 1; // CSSで定義したアニメーションの秒数（5s）に合わせる
    const RAINBOW_COLORS_COUNT = 6; // 6色をステップの基準にする

    const fixedDelayStep = animationDuration / RAINBOW_COLORS_COUNT; 

    for (let i = 0; i < totalChars; i++) {
        const colorStepIndex = i % RAINBOW_COLORS_COUNT;
        const delay = -(fixedDelayStep * colorStepIndex); 
        if (i > 0) {
            html += '<wbr>'; // span境界に明示的な改行可能点を作る（数字の連続などで折り返せない問題の対策）
        }
        html += `<span class="rainbow-char" style="animation-delay: ${delay}s;">${chars[i]}</span>`;
    }

    return html;
}

/**
 * 2. 投稿ストリーム・ログ（右側）用：固定された虹色
 */
function toStaticRainbowText(text) {
    const colors = ['#FF0000', '#FF7F00', '#FFFF00', '#00FF00', '#0000FF', '#BF00FF'];
    const chars = Array.from(text);
    let html = '';
    
    for (let i = 0; i < chars.length; i++) {
        const color = colors[i % colors.length];
        html += `<span style="color: ${color};">${chars[i]}</span>`;
    }
    
    return html;
}

     function generateFiveTrillionHtml(part1, part2) {
    // デフォルト値
    const p1 = part1 || "5000兆円";
    const p2 = part2 || "欲しい！";

    return `
    <div class="five-trillion-container" style="display: inline-block; font-family: 'serif'; font-weight: 900; font-style: italic; line-height: 1.1; padding: 10px;">
        <span style="
            display: block;
            font-size: 1.2em;
            background: linear-gradient(to bottom, #ff3a3a 0%, #ff3a3a 45%, #b30000 50%, #ff0000 55%, #ff3a3a 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            filter: drop-shadow(2px 2px 0px #fff) drop-shadow(-2px -2px 0px #fff) drop-shadow(2px -2px 0px #fff) drop-shadow(-2px 2px 0px #fff) drop-shadow(0 0 5px rgba(255,215,0,0.8));
            padding-bottom: 5px;
        ">${p1}</span>
        <span style="
            display: block;
            font-size: 1.5em;
            background: linear-gradient(to bottom, #ffffff 0%, #ffffff 45%, #aaaaaa 50%, #ffffff 55%, #ffffff 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            filter: drop-shadow(2px 2px 0px #000080) drop-shadow(-2px -2px 0px #000080) drop-shadow(2px -2px 0px #000080) drop-shadow(-2px 2px 0px #000080);
            margin-top: -10px;
            padding-left: 20px;
        ">${p2}</span>
    </div>`;
}

