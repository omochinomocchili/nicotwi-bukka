// =============================================================
// settings.js — フォーム・UI設定
// 投稿フォームのDOM要素、コメント形式/大きさ/色の切り替えUI、
// ログ表示ON/OFF、localStorageへの設定保存・復元。
// 依存: timeline.js(tweetStream), layout.js(adjustOverallScale, balanceHeader)
// =============================================================

  const form = document.getElementById('tweetForm');
  const commentInput = document.getElementById('comment');
  const predefinedColorSelect = document.getElementById('predefinedColor');
  const commentColorPicker = document.getElementById('commentColorPicker');
  const commentTypeSelect = document.getElementById('commentType');
  const commentSizeSelect = document.getElementById('commentSize');
  // 文字サイズ（小・中・大）に対応する基準スケール（中=1.0）
  const COMMENT_SIZE_SCALE = { small: 0.6, medium: 1.0, large: 1.4 };
  function getSizeScale(size) {
      return COMMENT_SIZE_SCALE[size] || COMMENT_SIZE_SCALE.medium;
  }
  const toggleLogDisplayCheckbox = document.getElementById('toggleLogDisplayCheckbox');
  const toggleRainbowCheckbox = document.getElementById('toggleRainbowCheckbox');
  let rainbowAnimEnabled = localStorage.getItem('rainbowAnimEnabled') !== 'false';
  toggleRainbowCheckbox.checked = rainbowAnimEnabled;
  if (!rainbowAnimEnabled) document.body.classList.add('rainbow-anim-off');

  const toggleLogDisplayContainer = document.getElementById('toggleLogDisplayContainer');

  function setLogDisplayMode(showLog) {
      if (showLog) {
          document.body.classList.remove('comment-only'); 
          localStorage.setItem('logDisplayMode', 'true');
          updateAllTweetDisplayVisibility(true);
      } else {
          document.body.classList.add('comment-only'); 
          localStorage.setItem('logDisplayMode', 'false');
          updateAllTweetDisplayVisibility(false);
      }
      adjustOverallScale();
  }

  function initializeLogDisplayMode() {
      const storedMode = localStorage.getItem('logDisplayMode');
      // アプリ起動時はデフォルトでログ表示 (true)
      const initialDisplay = (storedMode === null || storedMode === 'true'); 

      toggleLogDisplayCheckbox.checked = initialDisplay;
      setLogDisplayMode(initialDisplay);
  }
  // 初回呼び出しは firebase.js 側で行う（setLogDisplayMode内のadjustOverallScale()が
  // timeline.js/comments.js の読み込み完了を必要とするため）

  toggleLogDisplayCheckbox.addEventListener('change', (e) => {
      setLogDisplayMode(e.target.checked);
  });

  function updateAllTweetDisplayVisibility(visible) {
      const tweets = tweetStream.children;
      for (let i = 0; i < tweets.length; i++) {
          tweets[i].style.display = visible ? 'block' : 'none';
      }
  }




  // リプレイパネルのイベント
  toggleRainbowCheckbox.addEventListener('change', () => {
      rainbowAnimEnabled = toggleRainbowCheckbox.checked;
      localStorage.setItem('rainbowAnimEnabled', rainbowAnimEnabled);
      document.body.classList.toggle('rainbow-anim-off', !rainbowAnimEnabled);
  });
  document.fonts.ready.then(() => {
    // フォント読み込み完了後にselectを強制再描画（初回ロード時の文字切れ対策）
    [predefinedColorSelect, commentTypeSelect].forEach(el => {
        el.style.display = 'none';
        void el.offsetHeight; // reflow
        el.style.display = '';
    });

    // フォント確定後にh1サイズを調整
    balanceHeader();

    const colorPickerContainer = document.getElementById('colorPickerContainer');

    // predefinedColor の値に応じてUIを切り替える関数（カラーピッカー＋splitInput）
    function onPredefinedColorChange() {
        const val = predefinedColorSelect.value;
        const isSplit = val === 'split_custom';
        // splitInputContainer の切り替え
        document.getElementById('comment').style.display = isSplit ? 'none' : 'block';
        document.getElementById('splitInputContainer').style.display = isSplit ? 'flex' : 'none';
        document.getElementById('comment').required = !isSplit;
        // カラーピッカーの切り替え
        colorPickerContainer.style.display = (val === 'custom') ? 'flex' : 'none';
    }

    // ページ読み込み時に一度実行
    onPredefinedColorChange();

    // 選択肢が変わったときに実行（リスナーはここの1か所のみ）
    predefinedColorSelect.addEventListener('change', () => {
        onPredefinedColorChange();
        saveSettingsToLocalStorage();
    });

    // カラーピッカーの値が変更されたときにも保存
    commentColorPicker.addEventListener('input', () => {
        saveSettingsToLocalStorage();
    });

    // 文字サイズが変更されたときにも保存
    commentSizeSelect.addEventListener('change', () => {
        saveSettingsToLocalStorage();
    });

    loadSettingsFromLocalStorage();
});
        // これらの変数は、HTML要素がすべて読み込まれた後に定義される必要があります。
        // なので、この <script> タグの先頭（または DOMContentLoaded イベント内）にまとめて定義されているはずです。
                // これも必要



     let _saveTimer = null;
     function saveSettingsToLocalStorage() {
         clearTimeout(_saveTimer);
         _saveTimer = setTimeout(_doSave, 500);
     }
     function _doSave() {
    const nickname = nicknameInput.value;
    const color = commentColorPicker.value;
    const predefinedColor = predefinedColorSelect.value;
    const commentType = commentTypeSelect.value;
    const commentSize = commentSizeSelect.value;

    localStorage.setItem('userNickname', nickname);
    localStorage.setItem('commentType', commentType);
    localStorage.setItem('commentSize', commentSize);

    if (predefinedColor === 'rainbow') {
        localStorage.setItem('commentColorType', 'rainbow');
    } else if (predefinedColor === 'custom') {
        localStorage.setItem('commentColorType', 'custom');
        localStorage.setItem('commentColor', color);
    } else {
        // 白・赤などのプリセット色やdot/五千兆は、選択された値そのものを保存する
        localStorage.setItem('commentColorType', 'preset');
        localStorage.setItem('commentColor', predefinedColor);
    }
} // end _doSave

     function loadSettingsFromLocalStorage() {
    const savedNickname = localStorage.getItem('userNickname');
    const savedType = localStorage.getItem('commentType');
    const savedSize = localStorage.getItem('commentSize');
    const savedColorType = localStorage.getItem('commentColorType');
    const savedColor = localStorage.getItem('commentColor');

    if (savedNickname) {
        nicknameInput.value = savedNickname;
    }

    if (savedType) {
        commentTypeSelect.value = savedType;
    }

    if (savedSize) {
        commentSizeSelect.value = savedSize;
    }

    if (savedColorType === 'rainbow') {
        predefinedColorSelect.value = 'rainbow';
        commentColorPicker.disabled = true;
    } else if (savedColorType === 'custom' && savedColor) {
        predefinedColorSelect.value = 'custom';
        commentColorPicker.value = savedColor;
        commentColorPicker.disabled = false;
    } else if (savedColorType === 'preset' && savedColor) {
        predefinedColorSelect.value = savedColor;
        commentColorPicker.disabled = true;
    } else {
        predefinedColorSelect.value = '#FFFFFF';
        commentColorPicker.value = '#ffffff';
        commentColorPicker.disabled = true;
    }

    // split_custom（五千兆）の入力欄の表示状態を復元
    const isSplit = predefinedColorSelect.value === 'split_custom';
    document.getElementById('comment').style.display = isSplit ? 'none' : 'block';
    document.getElementById('splitInputContainer').style.display = isSplit ? 'flex' : 'none';
    document.getElementById('comment').required = !isSplit;

    // カラーピッカー表示状態を復元
    const colorPickerContainer = document.getElementById('colorPickerContainer');
    if (colorPickerContainer) {
        colorPickerContainer.style.display = (predefinedColorSelect.value === 'custom') ? 'flex' : 'none';
    }
}
