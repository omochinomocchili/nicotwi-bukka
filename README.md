# nicotwi物化 引き継ぎ資料

物理化学部コンピュータ班で開発している、ニコニコ動画風の流れるコメント×Twitter風投稿を組み合わせたWebアプリです。この資料は次の代に引き継ぐために書いています。分からないことがあれば、まずこのファイルを読んでから触ってください。

## 目次

1. [プロジェクト概要](#プロジェクト概要)
2. [ファイル構成](#ファイル構成)
3. [公開URLとリポジトリ](#公開urlとリポジトリ)
4. [Firebaseの使い方（＝管理画面）](#firebaseの使い方管理画面)
5. [投稿を削除する方法](#投稿を削除する方法)
6. [データのバックアップ方法](#データのバックアップ方法)
7. [GitHubでの更新方法](#githubでの更新方法)
8. [詰まりやすいポイント（過去の教訓）](#詰まりやすいポイント過去の教訓)
9. [今後の課題・引き継ぎメモ](#今後の課題引き継ぎメモ)

---

## プロジェクト概要

- **何のアプリ？**: 投稿すると画面上をコメントが流れる（ニコニコ動画風）。同時に、投稿一覧がタイムライン形式でも見られる（Twitter風）。だから「nicotwi」。
- **技術構成**: HTML / CSS / JavaScript（フレームワークなし・素のJS）＋ Firebase Realtime Database（データの保存・同期）。ビルドツールは無く、ファイルをそのままGitHub Pagesで公開しているだけ。
- **対象環境**: 主にChromebook・スマホのブラウザで動作確認している。

## ファイル構成

すべて `/` 直下に置いてあり、`index.html` が読み込む順番が決まっている（順番を変えると壊れるので注意）。

| ファイル | 役割 |
|---|---|
| `index.html` | HTML本体。ボタンやエリアの配置。 |
| `style.css` | 見た目全部（レイアウト・色・アニメーション・レスポンシブ対応）。 |
| `fonts.css` | 埋め込みフォント（k8x12Sドットフォント・GenZenGothicKaiC）の`@font-face`定義。base64埋め込み。 |
| `utils.js` | 共通の小さい関数（スパム判定、日付フォーマット、引用文字列処理、虹色/五千兆円のHTML生成など）。他のどのファイルからも呼ばれる、依存の少ないファイル。 |
| `layout.js` | 縦画面/横画面の判定、リサイズ対応、`transform: scale()`による全体スケール調整、タイトルとランキングのバランス調整。 |
| `ranking.js` | 「直近100件の投稿者3選」「全投稿者一覧」の集計・表示。 |
| `settings.js` | 投稿フォームのDOM要素、コメント形式/大きさ/色の切り替えUI、ログ表示ON/OFF、localStorageへの設定保存・復元。 |
| `timeline.js` | 投稿カードの生成・更新・削除、引用カード生成、もっと見る/折りたたみ、投稿履歴のtxt書き出し機能。 |
| `comments.js` | 流れる/中央固定コメントの表示、投稿再現（リプレイ）機能、読み上げ（Web Speech API）。 |
| `firebase.js` | **Firebase関連は全部ここに集約**。初期化、投稿の取得・送信、👍の更新、読み取り/書き込み数の管理、タブ切り替え（新着/話題）、バージョンチェック。 |

**読み込み順序（`index.html`の`<script>`タグの並び）**:
```
utils.js → layout.js → ranking.js → settings.js → timeline.js → comments.js → firebase.js
```
`firebase.js`が一番最後なのには理由があります。他の全ファイルの関数・変数を呼ぶ処理が最後にまとまっているため、先に全部読み込んでおく必要があるからです。**新しいJSファイルを増やす時は、どのファイルの何に依存するかを考えてから読み込み順を決めてください**（詰まりやすいポイントの章に実例があります）。

## 公開URLとリポジトリ

- **公開ページ（GitHub Pages）**: `https://kumasoutakun-dotcom.github.io/nicotwibukka/` あたりのURL（正確なURLはリポジトリのSettings → Pagesで確認）
- **リポジトリ**: `https://github.com/kumasoutakun-dotcom/nicotwibukka`
- **不具合・要望**: `https://github.com/kumasoutakun-dotcom/nicotwibukka/issues`

## Firebaseの使い方（＝管理画面）

このアプリには専用の「管理画面」はありません。**Firebaseコンソールが実質的な管理画面**です。

- **アクセス方法**: [https://console.firebase.google.com/](https://console.firebase.google.com/) にアクセス → プロジェクト `nicotwibukka` を選択 → 左メニューの「Realtime Database」
- ログインには、このプロジェクトのFirebaseに招待されたGoogleアカウントが必要です。**引き継ぎ時に必ず次の代のアカウントを「共同編集者」としてFirebaseコンソールに追加してください**（Firebaseコンソール右上の歯車 → プロジェクトの設定 → ユーザーと権限）。

### データ構造

Realtime Databaseの中身は、だいたいこんな構造になっています。

```
/tweets/{key}          … 投稿本体。keyは投稿時刻のミリ秒。
    name, text, color, type, size, timestamp, tweetNumber,
    reactions, reactedUsers, quote, appVersion など
/quoteIndex/{tweetNumber} … 引用機能用。tweetNumber→投稿keyの対応表。
/likedTweets/{key}     … 話題タブ用。👍が1件以上ついた投稿だけのコピー。
/config/
    totalTweetCount     … 累計投稿数（tweetNumberの元）
    current_version_key … 現在の最新バージョン番号（バージョンチェック機能用）
/presence/{userId}     … 同時接続数カウント用
/usageStats/           … 読み取り/書き込み回数の記録（無料枠監視用）
```

### ルール（セキュリティルール）

Realtime Database → ルール タブで編集します。現状のルールは以下の通りです（万一消えてしまった時の復元用に貼っておきます。**実際に反映されているものと差異が出ている可能性があるので、変更前に現物を必ず確認してください**）。

```json
{
  "rules": {
    ".read": "auth != null || auth == null",
    ".write": false,
    "config": {
      ".read": true,
      "totalTweetCount": { ".write": true },
      "current_version_key": {
        ".read": true,
        ".write": "auth != null"
      }
    },
    "tweets": {
      ".read": true,
      ".indexOn": "tweetNumber",
      "$tweet_id": {
        ".write": true,
        "name": { ".validate": "newData.isString() && newData.val().length > 0 && newData.val().length <= 15" },
        "text": { ".validate": "newData.isString() && newData.val().length > 0 && newData.val().length <= 14000" },
        "color": { ".validate": "newData.isString() && (newData.val().matches(/^#[0-9a-fA-F]{6}$/) || newData.val() === 'rainbow' || newData.val() === '5000trillion' || newData.val() === 'dot')" },
        "type": { ".validate": "newData.isString() && (newData.val() === 'normal' || newData.val() === 'center_fixed')" },
        "size": { ".validate": "newData.isString() && (newData.val() === 'small' || newData.val() === 'medium' || newData.val() === 'large')" },
        "timestamp": { ".validate": "newData.isNumber()" },
        "tweetNumber": { ".validate": "newData.isNumber()" },
        "reactions": { ".validate": "newData.isNumber() && newData.val() >= 0" },
        "reactedUsers": { ".validate": "newData.hasChildren() || !newData.exists()" },
        "parent": { ".validate": "newData.isString() || !newData.exists()" },
        "quote": { ".validate": "newData.isNumber() || !newData.exists()" },
        "appVersion": { ".validate": "newData.isString() && newData.exists()" },
        "$other": { ".validate": false }
      }
    },
    "quoteIndex": {
      ".read": true,
      "$tweet_number": {
        ".write": true,
        ".validate": "newData.isString()"
      }
    },
    "likedTweets": {
      ".read": true,
      ".write": true
    },
    "presence": {
      ".read": true,
      ".write": true
    },
    "usageStats": {
      ".read": true,
      ".write": true
    }
  }
}
```

`"$other": { ".validate": false }` は「`tweets`の中に、リストにないフィールドを追加すると書き込みごと拒否する」設定です。**新しいフィールドを投稿データに追加する時は、ここに`.validate`ルールを追加しないと保存できません**（過去に何度もこれで書き込み失敗しました）。

### 無料枠について

Firebaseの無料プラン（Sparkプラン）には読み取り/書き込み回数やデータ転送量に上限があります。アプリ内で読み取り/書き込み回数を`usageStats`に記録して簡易的に監視していますが、正確な使用量は Firebaseコンソール → 使用量と請求額 で確認してください。上限に近づくと投稿できなくなる仕組みが入っています（`firebase.js`の`checkTweetLimit`/`initializeUsageMonitoring`あたり）。

## 投稿を削除する方法

アプリ内に削除ボタンはありません。**Firebaseコンソールから直接消します**。

1. Firebaseコンソール → Realtime Database → データ タブを開く
2. `tweets` を開き、該当の投稿を探す（キーはタイムスタンプなので、投稿の`timestamp`や`tweetNumber`の値を見て特定する）
3. 該当のキー（例: `1785021175481`）にカーソルを合わせると出る「×」で削除

**注意点**:
- 削除しても`tweetNumber`（通し番号）は詰め直されません（欠番になるだけ）。
- その投稿が他の投稿から引用されていた場合、引用元は「見つかりません」表示になります。
- 👍が付いていた投稿だった場合、`likedTweets`側にも複製が残っているので、あわせて`likedTweets/{同じキー}`も削除してください。

## データのバックアップ方法

### 方法1: アプリ内の書き出し機能（手軽）

画面下の「📥 履歴をtxtで書き出し」ボタンから、直近100件・今日の投稿・全期間のいずれかをtxtファイルとしてダウンロードできます。内容の記録用には十分ですが、複雑なアプリ丸ごとの復元には使えません。

### 方法2: FirebaseのJSONエクスポート（確実）

1. Firebaseコンソール → Realtime Database → データ タブ
2. 一番上の階層（ルート）の右にある「︙」（メニュー）→ 「JSONをエクスポート」
3. ダウンロードされたJSONファイルを保管しておく

**定期的に（学期末や代替わりのタイミングなど）方法2でバックアップを取っておくことを強く推奨します。** 誤操作でデータを消してしまった時に、このJSONを Realtime Database → データ → JSONをインポート で復元できます。

## GitHubでの更新方法

このアプリはビルド不要で、リポジトリに置いたファイルがそのままGitHub Pagesで公開されます。

### 簡単な方法（Webブラウザだけで完結）

1. `https://github.com/kumasoutakun-dotcom/nicotwibukka` を開く
2. 直したいファイル（例: `style.css`）をクリック
3. 右上の鉛筆アイコン（Edit this file）をクリック
4. 中身を書き換える、または全選択して丸ごと貼り替える
5. 画面下の「Commit changes...」→ そのままコミット

### gitコマンドに慣れている場合

```bash
git clone https://github.com/kumasoutakun-dotcom/nicotwibukka.git
cd nicotwibukka
# ファイルを編集
git add .
git commit -m "変更内容"
git push
```

### 反映確認について

- コミットしてから実際にサイトに反映されるまで、**数分かかることがあります**（GitHub Pagesのビルド待ち）。
- ブラウザ側もキャッシュが残っていて古い表示のままになることがあります。変わらない時は、ハード再読み込み（Chromebookなら Shift+更新ボタン、PCなら Ctrl+Shift+R）を試してください。
- それでも変わらない場合は、実際にコミットが反映されているか（GitHub上でファイルの中身を直接確認）を先に疑ってください。

## 詰まりやすいポイント（過去の教訓）

開発中に実際にハマった内容です。同じ罠を踏まないように残しておきます。

- **JSファイルを分割・追加する時の読み込み順**: あるファイルのトップレベルで即座に実行されるコード（`initializeXxx();`のような、関数定義の直後にすぐ呼んでいるもの）が、まだ読み込まれていない別ファイルの変数・関数を参照すると、エラーで止まり、**そのファイルの残りの処理も丸ごと実行されなくなります**（イベントリスナーの登録すら止まる）。新しい初期化処理を足す時は、それが依存するファイルより後に実行されることを確認してください。
- **Firebaseの`orderByChild`にインデックスが無いと激重になる**: `.indexOn`を設定していないフィールドで`orderByChild`を使うと、該当ノード配下を**全部ダウンロードしてクライアント側で絞り込む**という動きになります。投稿数が増えるほど遅く・重くなるので、新しい絞り込み機能を作る時は、可能な限り①`.indexOn`を張る、②`quoteIndex`のような直接パス参照の索引を別途作る、のどちらかで対応してください。
- **`$other: { ".validate": false }`**: 投稿データに新しいフィールドを足す時、ルール側に対応する`.validate`を追加し忘れると、書き込みが（エラーメッセージも分かりにくい形で）失敗します。「フィールドを足したのに保存されない」時はまずここを疑ってください。
- **k8x12S（ドットフォント）は太字にすると潰れて見える**: 埋め込みフォントが1ウェイトしか無いため、`font-weight: bold`を指定すると疑似ボールド（合成太字）になり、潰れて読みにくくなります。ドットフォントを使う要素には`font-weight: normal`を明示してください。

## 今後の課題・引き継ぎメモ

- 投稿の「削除」「編集」を行うアプリ内UIが無いため、不適切な投稿への対応は今のところFirebaseコンソールでの手動削除のみです。管理用UIを作るなら、Google認証などで簡易的な管理者ログインを用意すると安全です。
- バージョンチェック機能（`config/current_version_key`）があるので、コードを大きく更新した際は、`firebase.js`内の`THIS_HTML_VERSION_KEY`とFirebase側の`current_version_key`をあわせて更新してください（合わせないと「古いバージョンです」の警告が出て投稿できなくなります）。
- fonts.cssはフォントをbase64で埋め込んでいるため容量が大きめです。フォントの差し替えが必要な場合は、TTF→woff2変換してから埋め込むとファイルサイズを抑えられます（過去の対応で約11MB→4.2MBまで圧縮した実績あり）。
- 何か分からないことがあれば、まずこのファイルとGitHubのコミット履歴（`git log`）を確認してください。込み入った実装意図は各JSファイル内のコメントにも残しています。

