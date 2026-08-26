# nicotwi物化 引き継ぎ資料

物理化学部コンピュータ班で開発している、ニコニコ動画風の流れるコメント×Twitter風投稿を組み合わせたWebアプリです。この資料は次の代に引き継ぐために書いています。分からないことがあれば、まずこのファイルを読んでから触ってください。前の代から直接教わっていなくても、このREADMEだけで管理・変更ができるように書いてあります。管理・変更を始める時は、まず[アカウント一覧](#アカウント一覧)を確認してください。共用アカウントは保管・引き継ぎ用として使用し、代替わり後は追加した自分個人のアカウントから管理・変更を行います。初めて触る時は、[代替わりチェックリスト](#代替わりチェックリスト自分で管理を始める時にやること)を上から順番に進めれば準備が整います。

## 目次

1. [プロジェクト概要](#プロジェクト概要)
2. [代替わりチェックリスト（自分で管理を始める時にやること）](#代替わりチェックリスト自分で管理を始める時にやること)
3. [アカウント一覧](#アカウント一覧)
4. [権限の引き継ぎ方法（詳細）](#権限の引き継ぎ方法詳細)
5. [ファイル構成](#ファイル構成)
6. [公開URLとリポジトリ](#公開urlとリポジトリ)
7. [Firebaseの使い方（＝管理画面）](#firebaseの使い方管理画面)
8. [投稿を削除する方法](#投稿を削除する方法)
9. [データのバックアップと復旧方法](#データのバックアップと復旧方法)
10. [GitHubでの更新方法](#githubでの更新方法)
11. [詰まりやすいポイント・今後の課題](#詰まりやすいポイント今後の課題)

---

## プロジェクト概要

- **何のアプリ？**: 投稿すると画面上をコメントが流れる（ニコニコ動画風）。同時に、投稿一覧がタイムライン形式でも見られる（Twitter風）。それが「nicotwi」の所以。
- **技術構成**: HTML / CSS / JavaScript（フレームワークなし・素のJS）＋ Firebase Realtime Database（データの保存・同期）。ビルドツールは無く、ファイルをそのままGitHub Pagesで公開しているだけ。
- **対象環境**: 主にChromebook・スマホのブラウザで動作確認している。
- **作り方**: 全てClaude（AI）とのバイブコーディングです。

## 代替わりチェックリスト（自分で管理を始める時にやること）

前の代から直接教わっていなくても、このREADMEと下のチェックリストだけで管理・変更ができるようになっています。上から順番に進めてください。

- [ ] [アカウント一覧](#アカウント一覧)を読み、部活の共用アカウント`omochinomocchili@gmail.com`の存在を確認する
- [ ] 部室の物化部ノート、または「物化部現役」グループLINEのノートから、そのアカウントのパスワードを自分で確認する
- [ ] 実際にこのアカウントで、GitHub・Firebase両方にログインできることを確認する
- [ ] [データのバックアップと復旧方法](#データのバックアップと復旧方法)の「方法2」で、最新のJSONバックアップを一度取っておく
- [ ] [権限の引き継ぎ方法](#権限の引き継ぎ方法詳細)に沿って、自分個人のGitHubアカウントをAdmin、自分個人のGoogleアカウントをFirebaseの編集者以上として追加する
- [ ] 追加した個人アカウントから、GitHubリポジトリとFirebaseプロジェクトの両方に実際にアクセスできることを確認する
- [ ] 共用アカウントからいったんログアウトし、個人アカウントだけでGitHub・Firebaseの管理画面を開けることを確認する
- [ ] 公開ページ（`https://omochinomocchili.github.io/nicotwi-bukka/`）から実際に投稿し、画面に反映されることを確認する
- [ ] [GitHubでの更新方法](#githubでの更新方法)を個人アカウントで実際に1回試す（コメントを1行足すだけでも良い）
- [ ] [復旧方法](#データのバックアップと復旧方法)に一通り目を通しておく

### 引き継ぎ完了の条件

今後もnicotwiを運用・変更する場合は、次の4条件をすべて満たしたら、引き継ぎ完了です。

1. 自分個人のGitHubアカウントで、リポジトリを管理・更新できる
2. 自分個人のGoogleアカウントで、Firebaseプロジェクトを管理できる
3. 公開ページへの投稿と、GitHubの更新が実際に反映されることを確認している
4. 最新のFirebase JSONバックアップを保管しており、復旧方法を確認している

ただし、次の代がnicotwiを運用する必要がない、または運用したくない場合でも、**公開ページのURLとリポジトリのURLは必ず次の代へ引き継いでください。** 今後運用を再開する可能性や、過去の成果物を確認する必要があるためです。

この場合、GitHub・Firebaseの実際の管理作業まで引き継ぐ必要はありませんが、少なくとも[公開URLとリポジトリ](#公開urlとリポジトリ)の情報を次の代が確認できる状態にしてください。

共用アカウントにログインできることだけでは、運用を継続する場合の引き継ぎ完了とは言えません。以降の章は、実際に作業する時に読む詳しい参考資料です。

## アカウント一覧

このアプリの保管・引き継ぎ用として、部活全体で共用している次のアカウントを使用します。ただし、**実際の管理・変更作業は、代替わりの際に追加した各自の個人アカウントから行ってください。共用アカウントは保管・引き継ぎ用として残し、普段の運用には使用しません。**

代替わりしたら、後述の[権限の引き継ぎ方法](#権限の引き継ぎ方法詳細)に沿って、管理に関わる部員それぞれの個人アカウントをGitHub・Firebaseに追加します。**個人アカウントを追加して実際に管理できることが、引き継ぎの完了条件です。**

### 共用アカウント（保管・引き継ぎ用）

GitHub・Firebaseとも、このアカウントを所有者・保管用として維持します。

**普段の管理・変更はこの共用アカウントでは行わず、必ず各自の個人アカウントから行ってください。** 共用アカウントのパスワードは、代替わりや個人アカウントの追加が必要になった場合に使用します。

- **アカウント**: `omochinomocchili@gmail.com`
- **GitHub**: このアカウントでログイン（ユーザー名表示は`omochinomocchili`）。リポジトリ `nicotwi-bukka` のオーナー
- **Firebase**: このアカウントでログイン。プロジェクト `nicotwibukka` のオーナー
- **パスワードの保管場所**: 部室の物化部ノート、または「物化部現役」グループLINEのノート。分からない時は、まずこの2箇所を自分で確認してください。

## 権限の引き継ぎ方法（詳細）

### GitHubリポジトリに共同編集者を追加する

1. `omochinomocchili@gmail.com`でGitHubにログインした状態で、リポジトリ（`https://github.com/omochinomocchili/nicotwi-bukka`）を開く
2. 上部タブの「Settings」→ 左メニューの「Collaborators」を開く
3. 「Add people」から、自分個人のGitHubアカウントのユーザー名を入力し、権限は「Admin」にして招待する（「Write」だとGitHub Pagesの設定など一部の管理画面を操作できません）
4. 自分個人のアカウントに届いた招待通知（メールまたはGitHub右上の通知ベル）から「Accept invitation」を押す

### Firebaseコンソールに編集者を追加する

1. [https://console.firebase.google.com/](https://console.firebase.google.com/) を開き、`omochinomocchili@gmail.com`でログインしてプロジェクト `nicotwibukka` を選択
2. 左上の歯車アイコン →「プロジェクトの設定」→ 上部タブの「ユーザーと権限」
3. 「メンバーを追加」から、自分個人のGoogleアカウントのメールアドレスを入力し、役割は「編集者」以上を選んで追加する

### 共用アカウントのパスワードの確認方法

`omochinomocchili@gmail.com`のパスワードは、部室の物化部ノートと「物化部現役」グループLINEのノートに記載されています。管理・変更をしたくなったら、まずここを確認してログインしてください。

パスワードそのものはREADMEやGitHubリポジトリには記載しないでください。このREADMEには、保管場所だけを記載します。

### 個人アカウントを必ず追加する理由

共用アカウントのパスワードだけに頼ると、ノートが見つからない・共用アカウントに何かあった、という時にログインできなくなります。

そのため、代替わりしたら自分個人のGitHubアカウントをAdmin、自分個人のGoogleアカウントをFirebaseの編集者以上として必ず追加してください。**追加した個人アカウントを、以後の管理・変更作業に使用します。共用アカウントは保管・引き継ぎ用として残します。** 追加後は、共用アカウントからログアウトした状態でも個人アカウントだけでGitHub・Firebaseを運用、管理できることを確認してください。

この確認まで終わって初めて、共用アカウントのパスワードに依存しない管理体制ができたことになります。

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

- **公開ページ（GitHub Pages）**: `https://omochinomocchili.github.io/nicotwi-bukka/`
- **リポジトリ**: `https://github.com/omochinomocchili/nicotwi-bukka`
- **不具合・要望**: `https://github.com/omochinomocchili/nicotwi-bukka/issues`

`omochinomocchili` は個人アカウントではなく、部活全体で使っている共用アカウントです。

## Firebaseの使い方（＝管理画面）

このアプリには専用の「管理画面」はありません。**Firebaseコンソールが実質的な管理画面**です。

- **アクセス方法**: [https://console.firebase.google.com/](https://console.firebase.google.com/) にアクセス → プロジェクト `nicotwibukka` を選択 → 左メニューの「Realtime Database」
- ログインには、Googleアカウント **omochinomocchili@gmail.com**（このプロジェクトのFirebaseに招待済み）が必要です。自分個人のアカウントを追加する手順は[権限の引き継ぎ方法](#権限の引き継ぎ方法詳細)を参照してください。

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

## データのバックアップと復旧方法

### 方法1: アプリ内の書き出し機能（手軽）

画面下の「📥 履歴をtxtで書き出し」ボタンから、直近100件・今日の投稿・全期間のいずれかをtxtファイルとしてダウンロードできます。内容の記録用には十分ですが、複雑なアプリ丸ごとの復元には使えません。

### 方法2: FirebaseのJSONエクスポート（確実）

1. Firebaseコンソール → Realtime Database → データ タブ
2. 一番上の階層（ルート）の右にある「︙」（メニュー）→ 「JSONをエクスポート」
3. ダウンロードされたJSONファイルを保管しておく

**定期的に（学期末や代替わりのタイミングなど）方法2でバックアップを取っておくことを強く推奨します。**

### バックアップからの復元方法

1. Firebaseコンソール → Realtime Database → データ タブを開く
2. ルート（一番上の階層）の右の「︙」→「JSONをインポート」
3. 保管しておいたJSONファイルを選択する

**注意**: インポートするとその時点のデータベースの中身が丸ごと置き換わります。一部の投稿だけ元に戻したい場合でも、他の新しい投稿ごと上書きされてしまうので、可能であれば先に現在のデータもJSONエクスポートしておき、必要な部分だけ手動でマージすることを検討してください。

### こんな時どうする？（トラブル別の対応）

**投稿やデータが消えた・おかしくなった**
→ 直近のJSONバックアップから、上の「バックアップからの復元方法」に沿って復元してください。定期的にバックアップを取っていないと、直近の状態は失われる可能性があります。

**共用アカウント（`omochinomocchili@gmail.com`）のパスワードが分からなくなった**
→ まず部室の物化部ノートと「物化部現役」グループLINEのノートを確認してください。両方とも見当たらない場合は、Googleアカウントに登録されている復旧用の電話番号・メールアドレスがあれば、ログイン画面の「パスワードをお忘れですか」から再設定できます。

**GitHub Pagesが真っ白になった・更新が反映されない**
→ [反映確認について](#反映確認について)を参照してください。それでも直らない場合は、リポジトリの Settings → Pages で公開設定（対象のブランチなど）が正しいか確認してください。

**リポジトリやFirebaseプロジェクトを誤って削除してしまった**
→ GitHubのリポジトリは、削除してから約90日以内であれば、アカウントの Settings → Repositories →「Deleted repositories」から復元できる可能性があります。Firebase（Google Cloud）のプロジェクトも、削除してから約30日以内であればGoogle Cloud Consoleの「IAMと管理」→「リソースの管理」から復元できる可能性があります。復元できるのは基本的にオーナー権限を持つ人だけですが、`omochinomocchili@gmail.com`がどちらのオーナーでもあるため、このアカウントでログインできれば手続き可能です。どちらも猶予期間を過ぎると完全に消えるため、気づいたらすぐに対応してください。

## GitHubでの更新方法

このアプリはビルド不要で、リポジトリに置いたファイルがそのままGitHub Pagesで公開されます。

### 簡単な方法（Webブラウザだけで完結）

1. `https://github.com/omochinomocchili/nicotwi-bukka` を開く
2. 直したいファイル（例: `style.css`）をクリック
3. 右上の鉛筆アイコン（Edit this file）をクリック
4. 中身を書き換える、または全選択して丸ごと貼り替える
5. 画面下の「Commit changes...」→ そのままコミット

### gitコマンドに慣れている場合

```bash
git clone https://github.com/omochinomocchili/nicotwi-bukka.git
cd nicotwi-bukka
# ファイルを編集
git add .
git commit -m "変更内容"
git push
```

### 反映確認について

- コミットしてから実際にサイトに反映されるまで、**数分かかることがあります**（GitHub Pagesのビルド待ち）。
- ブラウザ側もキャッシュが残っていて古い表示のままになることがあります。変わらない時は、ハード再読み込み（Chromebookなら Shift+更新ボタン、PCなら Ctrl+Shift+R）を試してください。
- それでも変わらない場合は、実際にコミットが反映されているか（GitHub上でファイルの中身を直接確認）を先に疑ってください。

## 詰まりやすいポイント・今後の課題

- JSファイルの読み込み順（`utils.js → layout.js → ranking.js → settings.js → timeline.js → comments.js → firebase.js`）を変えると壊れます。
- Firebaseのルールで`"$other": { ".validate": false }`が設定されているため、投稿データに新しいフィールドを追加する時はルール側にも`.validate`を追加しないと保存できません。
- バージョンチェック機能（`config/current_version_key`）があるので、コードを大きく更新した際は`firebase.js`内の`THIS_HTML_VERSION_KEY`もあわせて更新してください。
- 分からないことがあれば、まずこのファイルとGitHubのコミット履歴（`git log`）、各JSファイル内のコメントを確認してください。
