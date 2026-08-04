// =============================================================
// ranking.js — 投稿者ランキング・ユーザー統計
// 直近100件の投稿から「投稿者3選」「全投稿者一覧」を集計・表示する。
// 依存: timeline.js(allTweets), utils.js(containsSpam等), layout.js(balanceHeader)
// =============================================================

  const topUserList = document.getElementById('topUserList'); 
  const allUserList = document.getElementById('allUserList'); 

  let userCounts = {};
  let userFirstTweetTime = {}; 

     
  // updateUserStats()は直近100件を毎回スキャンする重い処理なので、
  // 連続で呼ばれても500msに1回だけまとめて実行する
  let userStatsUpdateTimer = null;
  function scheduleUpdateUserStats() {
      if (userStatsUpdateTimer) return; // 既に予約済みなら何もしない
      userStatsUpdateTimer = setTimeout(() => {
          userStatsUpdateTimer = null;
          updateUserStats();
      }, 500);
  }

  function updateUserStats() {
    let tempUserCounts = {};
    let tempUserFirstTweetTime = {}; 
    const uniqueUsers = new Set(); 

    // 直近100件のみを対象にする
    const allKeys = Object.keys(allTweets).sort((a, b) => parseInt(b) - parseInt(a)); // 新しい順
    const recentKeys = new Set(allKeys.slice(0, 100));

    for (const key in allTweets) {
        if (!recentKeys.has(key)) continue; // 直近100件以外はスキップ
        const tweet = allTweets[key];
        const sanitizedText = tweet && tweet.text ? DOMPurify.sanitize(tweet.text) : '';
        
        // 統計情報更新時も各種フィルターを適用
        if (tweet && tweet.name && 
            !containsSpam(sanitizedText) && 
            !containsForbiddenHtmlTags(sanitizedText) &&
            !isSameContentRateLimited(tweet.name, sanitizedText, tweet.timestamp) && // 同一内容コメントチェック
            (tweet.type === 'center_fixed' || !isPostIntervalViolated(tweet.name, tweet.timestamp)) // 中央固定コメントは間隔制限なし
        ) { 
            if (!tempUserCounts[tweet.name]) {
                tempUserCounts[tweet.name] = 0;
            }
            tempUserCounts[tweet.name]++;
            uniqueUsers.add(tweet.name); 

            if (!tempUserFirstTweetTime[tweet.name] || tweet.timestamp < tempUserFirstTweetTime[tweet.name]) {
                tempUserFirstTweetTime[tweet.name] = tweet.timestamp;
            }
        }
    }
    userCounts = tempUserCounts;
    userFirstTweetTime = tempUserFirstTweetTime; 
    renderUserStats(); 
  }


  function renderUserStats() {
    const sortedByCount = Object.entries(userCounts).sort((a, b) => b[1] - a[1]);

    // 固定スロット3つを取得してリセット
    const slots = [
        document.getElementById('top-rank-1'),
        document.getElementById('top-rank-2'),
        document.getElementById('top-rank-3'),
    ];
    const rankLabels = ['1位', '2位', '3位'];
    slots.forEach((slot, i) => {
        slot.textContent = `${rankLabels[i]}: ―`;
        slot.style.opacity = '0.4';
    });
    // 同率情報の古いliを除去
    topUserList.querySelectorAll('.equal-rank-info').forEach(el => el.remove());

    if (sortedByCount.length > 0) {
        const top3Names = [];
        let lastCount = -1;
        let currentRank = 0;
        let slotIndex = 0;

        for (let i = 0; i < sortedByCount.length && slotIndex < 3; i++) {
            const [user, count] = sortedByCount[i];
            if (count !== lastCount) currentRank = i + 1;
            if (currentRank <= 3) {
                slots[slotIndex].textContent = `${rankLabels[slotIndex]}: ${user}　${count}件`;
                slots[slotIndex].style.opacity = '1';
                top3Names.push(user);
                slotIndex++;
            }
            lastCount = count;
        }

        // 同率情報
        const top3Scores = new Set();
        if (sortedByCount[0]) top3Scores.add(sortedByCount[0][1]);
        if (sortedByCount[1]) top3Scores.add(sortedByCount[1][1]);
        if (sortedByCount[2]) top3Scores.add(sortedByCount[2][1]);
        const equalRankCounts = {};
        for (const [user, count] of sortedByCount) {
            if (!top3Names.includes(user) && top3Scores.has(count)) {
                equalRankCounts[count] = (equalRankCounts[count] || 0) + 1;
            }
        }
        for (const score in equalRankCounts) {
            const li = document.createElement('li');
            li.className = 'equal-rank-info';
            li.textContent = `同率${equalRankCounts[score]}人: ${score}件`;
            topUserList.appendChild(li);
        }
    }

    // top3の内容が変わったのでヘッダーバランスを再調整
    requestAnimationFrame(() => balanceHeader());

    allUserList.innerHTML = '';
    if (sortedByCount.length === 0) {
        const li = document.createElement('li');
        li.textContent = 'まだ投稿者がいません。';
        allUserList.appendChild(li);
    } else {
        const sortedAllUsers = Object.entries(userCounts).sort((a, b) => {
            const countA = a[1];
            const countB = b[1];
            const nameA = a[0];
            const nameB = b[0];

            if (countB !== countA) {
                return countB - countA; 
            } else {
                const timeA = userFirstTweetTime[nameA] || 0; 
                const timeB = userFirstTweetTime[nameB] || 0;
                return timeA - timeB; 
            }
        });

        sortedAllUsers.forEach(([user, count]) => {
            const li = document.createElement('li');
            li.textContent = `${user}: ${count} 件`;
            allUserList.appendChild(li);
        });
    }
  }
