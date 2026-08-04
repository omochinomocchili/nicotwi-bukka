// =============================================================
// firebase.js — Firebase関連処理
// 初期化、投稿の取得(初期ロード/リアルタイム監視/新着・話題タブ切替)、
// 投稿送信、👍の更新、読み取り/書き込み数の管理、バージョンチェック。
// Firebaseへの読み書きはすべてこのファイルに集約している。
// 依存: utils.js, settings.js(form等), timeline.js(appendTweetToStream等), ranking.js(scheduleUpdateUserStats)
// =============================================================

  const firebaseConfig = {
    apiKey: "AIzaSyA5Bhf6p6zVjnKc9npB85fxG_1BBdUdGKY",
  authDomain: "nicotwibukka.firebaseapp.com",
  databaseURL: "https://nicotwibukka-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "nicotwibukka",
  storageBucket: "nicotwibukka.firebasestorage.app",
  messagingSenderId: "766242176253",
  appId: "1:766242176253:web:7cddf2145711b5e3595294",
  measurementId: "G-S7XZMPDKJB"
  };

  firebase.initializeApp(firebaseConfig);
  const db = firebase.database();
  const concurrentUsersDiv = document.getElementById('concurrentUsers');
  const submitButton = form.querySelector('button[type="submit"]'); 
  const usageWarningDiv = document.getElementById('usageWarning');
  const usageStatsRef = db.ref('usageStats');
  const lastAccessTimestampRef = usageStatsRef.child('lastAccessTimestamp');
  const writeCountRef = usageStatsRef.child('writeCount');
  const readCountRef = usageStatsRef.child('readCount');
  const tweetsCountRef = db.ref('tweetsCount');
  const totalTweetCountRef = db.ref('config/totalTweetCount'); // 累計コメント番号（削除されても増え続ける）
  // --- バージョンチェック関連の追加 ---
  const VERSION_CONFIG_REF = db.ref('config/current_version_key'); // Firebase上のバージョンキーのパス

  const THIS_HTML_VERSION_KEY = "v1.7.7"; // <-- ここ
  let isCurrentVersion = false; // 現在のHTMLが最新バージョンかどうかを示すフラグ
  // --- ここまで ---
  let tweetsQueryRef = null;
  let userRecentPosts = {}; 
  let userLastPostTime = {}; // 各ユーザーの最終投稿時刻を記録する
  
  let currentReadCount = 0; 
  let currentWriteCount = 0; 
  let currentTweetCount = 0; 
  
let firebaseUserId = localStorage.getItem('firebaseUserId');
if (!firebaseUserId) {
    firebaseUserId = db.ref().push().key;
    localStorage.setItem('firebaseUserId', firebaseUserId);
}
// currentUser は一意のIDとしてconstで定義する（変更しない）
const currentUser = firebaseUserId;

const nicknameInput = document.getElementById('nickname');

// ページ読み込み時にlocalStorageからユーザー名をロードする
const savedUserName = localStorage.getItem('userName');
if (savedUserName) {
    nicknameInput.value = savedUserName;
}

// nicknameInputのイベントリスナー
// currentUserを上書きしないように修正
nicknameInput.addEventListener('input', (e) => {
    // ユーザー名をlocalStorageに保存するだけ
    localStorage.setItem('userName', e.target.value);
});
  async function initializeUsageMonitoring() {
      const lastAccessSnapshot = await lastAccessTimestampRef.once('value');
      const lastAccessTimestamp = lastAccessSnapshot.val();

      if (isNewDay(lastAccessTimestamp)) {
          console.log("日付が変わったため、使用量カウントをリセットします。");
          await writeCountRef.set(0);
          await readCountRef.set(0);
          await lastAccessTimestampRef.set(Date.now());
      } else {
          console.log("日付は変わっていません。既存のカウントを読み込みます。");
      }

      readCountRef.on('value', (snapshot) => {
          currentReadCount = snapshot.val() || 0;
      });

      writeCountRef.on('value', (snapshot) => {
          currentWriteCount = snapshot.val() || 0;
      });

      tweetsCountRef.on('value', (snapshot) => {
          currentTweetCount = snapshot.val() || 0;
          checkTweetLimit();
      });

      setInterval(() => {
          lastAccessTimestampRef.set(Date.now()).catch(e => console.error("Failed to update lastAccessTimestamp:", e));
      }, 60 * 1000); 
  }


  function checkTweetLimit() {
      console.log(`Current Usage: Reads: ${currentReadCount}, Writes: ${currentWriteCount}, Tweets: ${currentTweetCount}`);
  }

     // --- インターネット接続監視ロジック ---
function updateConnectionStatus() {
    const statusDiv = document.getElementById('connectionStatus');
    if (navigator.onLine) {
        // オンラインの時は非表示
        statusDiv.style.display = 'none';
        console.log("インターネットに接続されました。");
    } else {
        // オフラインの時に「接続切れました」を表示
        statusDiv.style.display = 'block';
        console.log("インターネット接続が切れました。");
    }
}

// 接続状態の変化を監視
window.addEventListener('online', updateConnectionStatus);
window.addEventListener('offline', updateConnectionStatus);

// ページ読み込み時にも一度チェック
updateConnectionStatus();
// --- ここまで ---

// 初回のレイアウト調整・ログ表示モード初期化
// （settings.js内のinitializeLogDisplayModeは、内部でadjustOverallScale()を呼ぶため
//   timeline.js/comments.js の読み込み完了後である必要があり、最後に読み込まれるここで呼び出す）
initializeLogDisplayMode();

  // readCountは1件ごとにFirebaseへ書き込むと重くなるため、ローカルで貯めて500msごとにまとめて反映する
  let pendingReadCount = 0;
  let readCountFlushTimer = null;
  function incrementReadCount() {
      pendingReadCount++;
      if (readCountFlushTimer) return; // 既に予約済みなら何もしない（このタイミングでまとめて加算される）
      readCountFlushTimer = setTimeout(() => {
          readCountFlushTimer = null;
          const toAdd = pendingReadCount;
          pendingReadCount = 0;
          if (toAdd <= 0) return;
          readCountRef.transaction((currentCount) => {
              return (currentCount || 0) + toAdd;
          }).catch(e => console.error("Failed to increment readCount:", e));
      }, 500);
  }

  async function incrementWriteCount() {
      await writeCountRef.transaction((currentCount) => {
          return (currentCount || 0) + 1;
      }).catch(e => console.error("Failed to increment writeCount:", e));
  }

  async function incrementTweetCount() {
      await tweetsCountRef.transaction((currentCount) => {
          return (currentCount || 0) + 1;
      }).catch(e => console.error("Failed to increment tweetCount:", e));
  }

  async function decrementTweetCount() {
      await tweetsCountRef.transaction((currentCount) => {
          return Math.max(0, (currentCount || 0) - 1); 
      }).catch(e => console.error("Failed to decrement tweetCount:", e));
  }

 async function submitTweet() {
    // --- 連打防止: 処理中はボタンを無効化 ---
    if (submitButton.disabled) return;
    submitButton.disabled = true;
    // --- ここまで ---

    try {
    // --- バージョンチェックの追加 ---
    if (!isCurrentVersion) {
        alert('このバージョンは古くなっています。最新版をご利用ください。');
        return;
    }
    // --- ここまで ---

    const name = nicknameInput.value.trim();
    let text = ''; 
    
    // ▼「五千兆」と「通常」でテキスト取得を分ける▼
    if (predefinedColorSelect.value === 'split_custom') {
        const part1 = document.getElementById('comment_part1').value.trim();
        const part2 = document.getElementById('comment_part2').value.trim();
        if (part1 || part2) {
            text = `__SPLIT__${part1}\n${part2}`;
        }
    } else {
        text = commentInput.value.trim();
    }
    // ▲ここまで▲

    const commentType = commentTypeSelect.value;
    const commentSize = commentSizeSelect.value;
    const now = Date.now();

    if (!name || !text) {
        alert('名前と感想を入力してください。');
        return;
    }
    
    // コメントタイプに関わらずNORMAL_COMMENT_MAX_LENGTH（140字）を適用し、カットする
    // __SPLIT__フォーマットの場合は各パートに70字制限があるため、全体チェックをスキップ
    if (!text.startsWith('__SPLIT__') && text.length > NORMAL_COMMENT_MAX_LENGTH) {
        text = text.substring(0, NORMAL_COMMENT_MAX_LENGTH);
        alert(`コメントは${NORMAL_COMMENT_MAX_LENGTH}字にカットされました。`);
    }

    // サニタイズはカット後に行う（__SPLIT__プレフィックスを除いた部分のみチェック用にサニタイズ）
    const textForCheck = text.startsWith('__SPLIT__') ? text.replace('__SPLIT__', '') : text;
    const sanitizedTextForCheck = DOMPurify.sanitize(textForCheck);

    // 禁止タグのチェック
    if (containsForbiddenHtmlTags(sanitizedTextForCheck)) {
        alert('投稿内容に禁止されているHTML要素が含まれています。');
        return;
    }
    
    // スパムキーワードのチェック
    if (containsSpam(sanitizedTextForCheck)) {
        alert('投稿内容に不適切な表現が含まれているため送信できません。');
        return;
    }

    // 中央固定コメントの場合、投稿間隔制限をスキップ
    if (commentType !== 'center_fixed') {
        // 同一人物の投稿間隔制限
        if (userLastPostTime[name] && (now - userLastPostTime[name] < MIN_POST_INTERVAL_PER_USER)) {
            const remainingTime = Math.ceil((MIN_POST_INTERVAL_PER_USER - (now - userLastPostTime[name])) / 1000);
            alert(`${name}さんの連続投稿は、${remainingTime}秒待ってから投稿してください。`);
            return;
        }
    }

    const textHash = await sha256(sanitizedTextForCheck); 
    if (!userRecentPosts[name]) {
        userRecentPosts[name] = [];
    }

    // 1分間の同一内容コメントのフィルタリングとチェック
    userRecentPosts[name] = userRecentPosts[name].filter(post => now - post.timestamp < SAME_CONTENT_RATE_LIMIT_1MIN);
    let sameContentCount1Min = userRecentPosts[name].filter(post => post.textHash === textHash).length;

    if (sameContentCount1Min >= MAX_SAME_CONTENT_1MIN) {
        alert(`同一内容の連続投稿は1分間に${MAX_SAME_CONTENT_1MIN}回までです。（${MAX_SAME_CONTENT_1MIN + 1}回目）`);
        return; 
    }

    // 5分間の同一内容コメントのフィルタリングとチェック
    const userRecentPosts5Min = userRecentPosts[name].filter(post => now - post.timestamp < SAME_CONTENT_RATE_LIMIT_5MIN);
    let sameContentCount5Min = userRecentPosts5Min.filter(post => post.textHash === textHash).length;

    if (sameContentCount5Min >= MAX_SAME_CONTENT_5MIN) {
        alert(`同一内容の連続投稿は5分間に${MAX_SAME_CONTENT_5MIN}回までです。（${MAX_SAME_CONTENT_5MIN + 1}回目）`);
        return; 
    }
    
    const newTweetKey = String(now);
if (predefinedColorSelect.value === 'rainbow') {
    selectedColorValue = 'rainbow';
} else if (predefinedColorSelect.value === 'split_custom') {
    selectedColorValue = '5000trillion'; 
} else if (predefinedColorSelect.value === 'custom') { 
    selectedColorValue = commentColorPicker.value;
} else if (predefinedColorSelect.value === 'dot') {
    selectedColorValue = 'dot';
} else {
    selectedColorValue = predefinedColorSelect.value;
}

    // ▼ 引用機能: 本文中の「#数字」を引用元tweetNumberとして検出 ▼
    let quoteTweetNumber = null;
    const quoteMatch = text.match(/#(\d+)/);
    if (quoteMatch) {
        quoteTweetNumber = parseInt(quoteMatch[1], 10);
    }
    // ▲ここまで▲

        // 累計コメント番号をtransactionで取得（最小限の通信）
        let tweetNumber = 1;
        await totalTweetCountRef.transaction((current) => {
            tweetNumber = (current || 0) + 1;
            return tweetNumber;
        });

        console.log({
    name,
    text,
    color: selectedColorValue,
    type: commentType,
    size: commentSize,
    reactions: 0,
    reactedUsers: {},
    parent: null,
    quote: quoteTweetNumber,
    timestamp: now,
    tweetNumber: tweetNumber,
    appVersion: THIS_HTML_VERSION_KEY
});


        // 投稿データをtweets直下に書き込む
        await db.ref('tweets/' + newTweetKey).set({
            name,
            text: text,
            color: selectedColorValue,
            type: commentType,
            size: commentSize,
            reactions: 0,
            reactedUsers: {},
            parent: null,
            quote: quoteTweetNumber,
            timestamp: now,
            tweetNumber: tweetNumber,
            appVersion: THIS_HTML_VERSION_KEY
        });

        // 引用機能用: tweetNumber→key の対応をquoteIndexに保存（クエリ無しで直接参照できるようにする）
        db.ref('quoteIndex/' + tweetNumber).set(newTweetKey);

        // 書き込みカウントを別途更新
        await db.ref('usageStats/writeCount').set(currentWriteCount + 1);
        currentWriteCount++;

        userRecentPosts[name].push({ textHash: textHash, timestamp: now }); 
        userLastPostTime[name] = now; // 最終投稿時刻を更新
        limitComments();
      
        nicknameInput.value = name;

        // ▼投稿後のリセットとフォーカス処理▼
        // 中央固定は連打しやすいようフォームをクリアしない
        if (commentType !== 'center_fixed') {
            if (predefinedColorSelect.value === 'split_custom') {
                document.getElementById('comment_part1').value = '';
                document.getElementById('comment_part2').value = '';
            } else {
                commentInput.value = '';
            }
            const quotePreviewEl = document.getElementById('quotePreviewContainer');
            if (quotePreviewEl) { quotePreviewEl.style.display = 'none'; quotePreviewEl.innerHTML = ''; }
        }
        // ▲ここまで▲

    } catch (error) {
        console.error("ツイートの送信に失敗しました:", error);
        alert("ツイートの送信に失敗しました。詳細をコンソールで確認してください。");
    } finally {
        // 処理完了後（成功・失敗・バリデーションエラー問わず）ボタンを再有効化
        if (isCurrentVersion) {
            submitButton.disabled = false;
        }
    }
}

  form.addEventListener('submit', function(e) {
    e.preventDefault(); 
    submitTweet(); 

  });

  // 👍更新: いいねの追加/取り消しと、話題タブ用インデックス(likedTweets)への同期
  async function toggleReaction(key, data) {
      const currentUserName = nicknameInput.value;
      const isAnonymousUser = !currentUserName || currentUserName.trim() === '';
      if (isAnonymousUser) {
          alert('「いいね」をするには、フォームに名前を入力してください。');
          return;
      }

      const reactionsRef = db.ref('tweets/' + key + '/reactions');
      const reactedUsersRef = db.ref('tweets/' + key + '/reactedUsers');
      const reactedUsers = (await reactedUsersRef.once('value')).val() || {};

      let transactionResult;
      if (reactedUsers[currentUser]) {
          delete reactedUsers[currentUser];
          await reactedUsersRef.set(reactedUsers);
          transactionResult = await reactionsRef.transaction((currentCount) => (currentCount || 0) - 1);
      } else {
          reactedUsers[currentUser] = true;
          await reactedUsersRef.set(reactedUsers);
          transactionResult = await reactionsRef.transaction((currentCount) => (currentCount || 0) + 1);
      }

      // 話題タブ用インデックス(likedTweets)を最新のいいね数と一緒に同期する
      const newReactionCount = (transactionResult && transactionResult.snapshot && transactionResult.snapshot.val()) || 0;
      if (newReactionCount > 0) {
          db.ref('likedTweets/' + key).set({
              name: data.name || null,
              text: data.text || null,
              color: data.color || null,
              type: data.type || null,
              size: data.size || null,
              reactions: newReactionCount,
              reactedUsers: reactedUsers || null,
              timestamp: data.timestamp || null,
              tweetNumber: data.tweetNumber || null,
              quote: data.quote || null,
              appVersion: data.appVersion || null
          });
      } else {
          db.ref('likedTweets/' + key).remove();
      }
  }

  // ▼ 引用機能（quote）のヘルパー関数群 ▼

  // 指定tweetNumberの投稿情報を取得する。まず直近100件のローカルキャッシュ(allTweets)を探し、
  // 無ければquoteIndex(tweetNumber→key)を直接パス読み取りしてから該当投稿を直接パス読み取りする。
  // orderByChildのクエリは使わないため、インデックス未設定でも全件ダウンロードは発生しない。
  async function fetchQuotedTweetInfo(quoteNumber) {
      for (const k in allTweets) {
          if (allTweets[k] && Number(allTweets[k].tweetNumber) === Number(quoteNumber)) {
              return { key: k, data: allTweets[k] };
          }
      }
      try {
          const indexSnap = await db.ref('quoteIndex/' + quoteNumber).once('value');
          const quotedKey = indexSnap.val();
          if (!quotedKey) return null; // quoteIndexに無い（移行前の古い投稿など）
          const tweetSnap = await db.ref('tweets/' + quotedKey).once('value');
          const tweetData = tweetSnap.val();
          if (!tweetData) return null;
          return { key: quotedKey, data: tweetData };
      } catch (e) {
          console.error('引用元投稿の取得に失敗しました:', e);
          return null;
      }
  }


  async function loadInitialTweetsAndMonitorChanges() {
    showLoading('読み込み中…');
    db.ref('tweets').off(); 

    if (toggleLogDisplayCheckbox.checked) { 
      tweetStream.innerHTML = ''; 
    }
    userCounts = {}; 
    userFirstTweetTime = {}; 
    activeFloatingComments.forEach(comment => comment.element.remove());
    activeFloatingComments.clear();
    activeCenterFixedComments.forEach(comment => comment.element.remove());
    activeCenterFixedComments.clear();
    allTweets = {}; 

    try {
        const snapshot = await db.ref('tweets').orderByKey().limitToLast(100).once('value');
        await incrementReadCount();


        const data = snapshot.val();
        if (data) {
            // 初期ロード時は全データを一旦allTweetsに格納
            Object.assign(allTweets, data);

            // config/totalTweetCount が未設定の場合、既存ツイートの最大tweetNumberで初期化
            const totalCountSnapshot = await totalTweetCountRef.once('value');
            if (!totalCountSnapshot.val()) {
                const maxTweetNumber = Object.values(allTweets).reduce((max, t) => {
                    return Math.max(max, t.tweetNumber || 0);
                }, 0);
                if (maxTweetNumber > 0) {
                    await totalTweetCountRef.set(maxTweetNumber);
                    console.log(`totalTweetCount を ${maxTweetNumber} に初期化しました。`);
                }
            }

            const sortedKeysAscending = Object.keys(allTweets).sort((a, b) => parseInt(a) - parseInt(b));
            
            const fragment = document.createDocumentFragment();
            const _origParent = tweetStream;
            // DocumentFragmentに一時的にappendして最後にまとめてDOMに追加
            sortedKeysAscending.forEach((key, index) => {
                const tweet = allTweets[key];
                appendTweetToStream(key, tweet, index + 1, false);
            });
            // ※ appendTweetToStreamがtweetStreamに直接appendするため
            // Fragment化は構造上困難。代わりにrAFで非同期描画に分散。

            // フォント読み込み完了後に5000兆円ツイートを再評価
            document.fonts.ready.then(() => {
                requestAnimationFrame(() => {
                    sortedKeysAscending.forEach((key) => {
                        const tweet = allTweets[key];
                        if (tweet.color === '5000trillion' || tweet.color === 'split_custom') {
                            const div = document.querySelector(`.tweet[data-key="${key}"]`);
                            if (div) updateTweetDisplay(div, tweet);
                        }
                    });
                });
            });
        }
        scheduleUpdateUserStats();
    } catch (error) {
        console.error("初期データの読み込みに失敗しました:", error);
    }
  }

  // =============================================
  // 新着／話題タブ切り替え
  // =============================================
  let currentFeedTab = 'new'; // 'new' | 'trend'
  let likedTweetsQueryRef = null;

  function stopLiveTweetListener() {
      db.ref('tweets').off();
      if (tweetsQueryRef) { tweetsQueryRef.off(); tweetsQueryRef = null; }
  }

  function stopTrendingLiveListener() {
      db.ref('likedTweets').off();
      if (likedTweetsQueryRef) { likedTweetsQueryRef.off(); likedTweetsQueryRef = null; }
  }

  async function switchFeedTab(tab) {
      if (tab === currentFeedTab) return;
      currentFeedTab = tab;

      const tabNewBtn = document.getElementById('tabNewBtn');
      const tabTrendBtn = document.getElementById('tabTrendBtn');
      if (tabNewBtn) tabNewBtn.classList.toggle('active-tab', tab === 'new');
      if (tabTrendBtn) tabTrendBtn.classList.toggle('active-tab', tab === 'trend');

      stopLiveTweetListener();
      stopTrendingLiveListener();
      tweetStream.innerHTML = '';
      tweetDomCache.clear();
      allTweets = {};

      if (tab === 'new') {
          await loadInitialTweetsAndMonitorChanges();
          setupRealtimeListeners();
      } else {
          await loadTrendingTweets();
          setupTrendingRealtimeListeners();
      }
  }

  // 話題タブ：likedTweets（👍が付いた投稿だけの索引）から新着順に最大100件を読み込む
  async function loadTrendingTweets() {
      showLoading('読み込み中…');
      try {
          const snapshot = await db.ref('likedTweets').orderByKey().limitToLast(100).once('value');
          await incrementReadCount();
          const data = snapshot.val() || {};
          Object.assign(allTweets, data);
          Object.keys(data).forEach((key, index) => {
              appendTweetToStream(key, data[key], index + 1, false);
          });
          scheduleUpdateUserStats();
      } catch (error) {
          console.error("話題タブの読み込みに失敗しました:", error);
      } finally {
          hideLoading();
      }
  }

  // 話題タブのライブ更新（新しく👍が付いた投稿の追加・いいね数の変化・0件に戻った投稿の削除）
  function setupTrendingRealtimeListeners() {
      stopTrendingLiveListener();

      const loadedKeys = Object.keys(allTweets).sort((a, b) => parseInt(a) - parseInt(b));
      const lastLoadedKey = loadedKeys.length > 0 ? loadedKeys[loadedKeys.length - 1] : null;
      likedTweetsQueryRef = lastLoadedKey
          ? db.ref('likedTweets').orderByKey().startAfter(lastLoadedKey)
          : db.ref('likedTweets').orderByKey();

      likedTweetsQueryRef.on('child_added', async (snapshot) => {
          if (currentFeedTab !== 'trend') return;
          await incrementReadCount();
          const key = snapshot.key;
          const data = snapshot.val();
          allTweets[key] = data;
          appendTweetToStream(key, data, null, false);

          while (tweetStream.children.length > 100) {
              let oldest = tweetStream.lastElementChild;
              if (oldest && oldest.getAttribute('data-key') === protectedTweetKey) {
                  oldest = oldest.previousElementSibling;
                  if (!oldest) break;
              }
              const oldestKey = oldest.getAttribute('data-key');
              oldest.remove();
              delete allTweets[oldestKey];
          }
          scheduleUpdateUserStats();
      }, (error) => {
          console.error("話題タブ child_added リスナーでエラー:", error);
      });

      db.ref('likedTweets').on('child_changed', async (snapshot) => {
          if (currentFeedTab !== 'trend') return;
          await incrementReadCount();
          const key = snapshot.key;
          const data = snapshot.val();
          allTweets[key] = data;
          const cachedDiv = tweetDomCache.get(key);
          if (cachedDiv) {
              const btn = cachedDiv.querySelector('.reaction-btn');
              if (btn) {
                  const reacted = data.reactedUsers && data.reactedUsers[currentUser];
                  btn.style.color = reacted ? '#87CEEB' : '#ccc';
                  btn.textContent = '👍️ ' + (data.reactions || 0);
              }
          } else {
              appendTweetToStream(key, data, null, false);
          }
          scheduleUpdateUserStats();
      }, (error) => {
          console.error("話題タブ child_changed リスナーでエラー:", error);
      });

      db.ref('likedTweets').on('child_removed', async (snapshot) => {
          if (currentFeedTab !== 'trend') return;
          await incrementReadCount();
          const key = snapshot.key;
          removeTweetFromDOMAndMaps(key);
          delete allTweets[key];
          scheduleUpdateUserStats();
      }, (error) => {
          console.error("話題タブ child_removed リスナーでエラー:", error);
      });
  }
  function setupRealtimeListeners() {
    console.log("setupRealtimeListeners が実行されました。");

    // すべてのリスナーを一度オフにする
    db.ref('tweets').off(); // child_changed, child_removed をオフ
    if (tweetsQueryRef) { tweetsQueryRef.off(); tweetsQueryRef = null; } // child_addedクエリをオフ
    db.ref('presence').off('value');

    if (!isCurrentVersion) {
      console.warn("古いバージョンであるため、リアルタイムリスナーは設定されません。");
      return;
    }

    // child_added リスナー
    // startAfter(lastKey) により、初期ロード済みの件数分はFirebaseから流れてこない
    const loadedKeys = Object.keys(allTweets).sort((a, b) => parseInt(a) - parseInt(b));
    const lastLoadedKey = loadedKeys.length > 0 ? loadedKeys[loadedKeys.length - 1] : null;
    tweetsQueryRef = lastLoadedKey
        ? db.ref('tweets').orderByKey().startAfter(lastLoadedKey)
        : db.ref('tweets').orderByKey();
    tweetsQueryRef.on('child_added', async (snapshot) => {
      await incrementReadCount();

      const key = snapshot.key;
      const data = snapshot.val();
      allTweets[key] = data;

      appendTweetToStream(key, data, null, true);

      const totalCount = Object.keys(allTweets).length;

      if (totalCount >= 100) {
          // 100件以上：古いものをDOMとallTweetsから除去してからランキング更新
          while (tweetStream.children.length > 100) {
              let oldest = tweetStream.lastElementChild;
              // 引用ジャンプで直前に見に来た投稿は一時的に削除保護し、代わりにその一つ前を消す
              if (oldest && oldest.getAttribute('data-key') === protectedTweetKey) {
                  oldest = oldest.previousElementSibling;
                  if (!oldest) break;
              }
              const oldestKey = oldest.getAttribute('data-key');
              oldest.remove();
              delete allTweets[oldestKey];
          }
          scheduleUpdateUserStats();
      } else {
          // 100件未満：除去不要、投稿されたタイミングでランキング更新
          scheduleUpdateUserStats();
      }
    }, (error) => {
      console.error("child_added リスナーでエラー:", error);
    });
    hideLoading();

    // child_changed リスナー
    db.ref('tweets').on('child_changed', async (snapshot) => {
      await incrementReadCount();

      const key = snapshot.key;
      const data = snapshot.val();
      allTweets[key] = data; // allTweets の既存ツイートを更新



      // いいね等の変更はreaction-btnだけ差分更新（全体再描画しない）
      const cachedDiv = tweetDomCache.get(key);
      if (cachedDiv) {
          const btn = cachedDiv.querySelector('.reaction-btn');
          if (btn) {
              const reacted = data.reactedUsers && data.reactedUsers[currentUser];
              btn.style.color = reacted ? '#87CEEB' : '#ccc';
              btn.textContent = '👍️ ' + (data.reactions || 0);
          }
          allTweets[key] = data;
      } else {
          appendTweetToStream(key, data, null, false);
      }
      scheduleUpdateUserStats();
    }, (error) => {
      console.error("child_changed リスナーでエラー:", error);
    });


    // --- ↓ ここから元のコードで setupRealtimeListeners の外に出ていた部分を中に移動 ↓ ---
    // child_removed リスナー
    db.ref('tweets').on('child_removed', async (snapshot) => {
      await incrementReadCount();

      const key = snapshot.key;
      removeTweetFromDOMAndMaps(key);
      delete allTweets[key];
      scheduleUpdateUserStats();
      // 番号はdata.tweetNumberを使うため振り直し不要
    }, (error) => {
      console.error("child_removed リスナーでエラー:", error);
    });
    console.log("DEBUG: child_removed リスナーを設定しました。");

    // presence 関連のロジック
    const presenceRef = db.ref('presence');
    const amOnline = db.ref('.info/connected');

    let userId = localStorage.getItem('firebaseUserId');
    if (!userId) {
      userId = db.ref().push().key;
      localStorage.setItem('firebaseUserId', userId);
    }
    const userPresenceRef = presenceRef.child(userId);

    amOnline.on('value', (snapshot) => {
      if (snapshot.val()) {
        userPresenceRef.onDisconnect().remove();
        userPresenceRef.set(true).catch(e => console.error("Failed to set presence:", e));


      }
    });
    console.log("DEBUG: amOnline リスナーを設定しました。");

    presenceRef.on('value', async (snapshot) => {
      await incrementReadCount();
      const count = snapshot.numChildren();
      concurrentUsersDiv.textContent = `同接数: ${count}`;
    }, (error) => {
      console.error("presence リスナーでエラー:", error);
    });
    console.log("DEBUG: presenceRef リスナーを設定しました。");
  }
  // --- バージョンチェック機能の追加 ---
  function setFormEnabled(enabled) {
      nicknameInput.disabled = !enabled;
      commentInput.disabled = !enabled;
      commentTypeSelect.disabled = !enabled;
      commentSizeSelect.disabled = !enabled;
      predefinedColorSelect.disabled = !enabled;
      commentColorPicker.disabled = !enabled;
      submitButton.disabled = !enabled;
      document.getElementById('clearInputBtn').disabled = !enabled;
  }
  let versionCheckInitialized = false;

  async function checkAppVersion(firebaseVersionKey) {
            if (!versionCheckInitialized) {
                // 初回のみ：フォーム無効＋「チェック中」表示
                setFormEnabled(false);
                usageWarningDiv.style.display = 'block';
                usageWarningDiv.textContent = 'バージョンチェック中...';
            }

            const matched = (firebaseVersionKey === THIS_HTML_VERSION_KEY);
            isCurrentVersion = matched;

            if (matched) {
                setFormEnabled(true);
                usageWarningDiv.style.display = 'none';
                usageWarningDiv.textContent = '';
                console.log("バージョンが一致しました。最新バージョンです。");
            } else {
                setFormEnabled(false);
                usageWarningDiv.style.display = 'block';
                usageWarningDiv.innerHTML = `このバージョンは古くなっています。<br>最新版をご利用ください。<br>(現在のバージョン: ${THIS_HTML_VERSION_KEY}, 最新バージョン: ${firebaseVersionKey})`;
                console.warn(`バージョンが一致しません。このHTMLのバージョン: ${THIS_HTML_VERSION_KEY}, Firebaseのバージョン: ${firebaseVersionKey}`);
            }

            if (!versionCheckInitialized) {
                versionCheckInitialized = true;
                try {
                    await incrementReadCount();
                    await initializeUsageMonitoring();
                    await loadInitialTweetsAndMonitorChanges();
                    setupRealtimeListeners();
                } catch (error) {
                    console.error("初期化に失敗しました:", error);
                    setFormEnabled(false);
                    usageWarningDiv.style.display = 'block';
                    usageWarningDiv.innerHTML = 'バージョンチェックに失敗しました。<br>インターネット接続を確認してください。';
                }
            }
        }

        // VERSION_CONFIG_REF.on が初回発火＆変更検知を兼ねる（.once との二重実行なし）
        VERSION_CONFIG_REF.on('value', (snapshot) => {
            const firebaseVersionKey = snapshot.val();
            checkAppVersion(firebaseVersionKey);
        });
        // --- ここまで ---

