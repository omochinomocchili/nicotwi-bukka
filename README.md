# nicotwi物化 引き継ぎ資料

物理化学部コンピュータ班で開発・運用している、ニコニコ動画風の流れるコメント表示とSNS風の投稿タイムラインを組み合わせたWebアプリです。投稿・引用・いいね・ランキング・投稿再現に加え、リアルタイム投票にも対応しています。

このREADMEは、機能やコードの説明だけでなく、代替わり後の管理・更新・トラブル対応もできるようにするための引き継ぎ資料です。前の担当者から直接説明を受けていない場合も、まずチェックリストを上から確認してみるといいと思います。

## 目次

- [概要](#概要)
- [代替わりチェックリスト](#代替わりチェックリスト)
- [アカウントと権限の引き継ぎ](#アカウントと権限の引き継ぎ)
- [主な機能](#主な機能)
- [利用技術](#利用技術)
- [リポジトリ構成](#リポジトリ構成)
- [動作の仕組み](#動作の仕組み)
- [Firebaseの設定と管理](#firebaseの設定と管理)
- [Realtime Databaseのデータ構造](#realtime-databaseのデータ構造)
- [Security Rules](#security-rules)
- [開発・更新方法](#開発更新方法)
- [運用・保守](#運用保守)
- [トラブル別の対応](#トラブル別の対応)
- [既知の制約](#既知の制約)


## 概要

- **何のアプリ？**: 投稿すると画面上をコメントが流れ、同じ投稿をタイムライン形式でも確認できます。ニコニコ動画とTwitterの模倣を組み合わせたアプリです。
- **技術構成**: HTML / CSS / JavaScript（フレームワークなし）＋ Firebase Realtime Database。ビルドツールは使用せず、ファイルをそのままWeb公開する構成です。
- **対象環境**: Chromebook・スマートフォン・PCのブラウザで利用します。
- **公開先の確認方法**: GitHub Pagesを利用しています。現在の公開URLや公開元の設定は、GitHubリポジトリの Settings → Pages で確認してください。URLやリポジトリが変わった場合は、次の担当者にも最新の公開先を伝えてください。

## 代替わりチェックリスト

新しい担当者がアプリを運用・変更する場合は、次の項目を上から順に確認してください。

- [ ] 部活の共用アカウントの存在と、パスワードの保管場所を確認する。
- [ ] 共用アカウントでGitHubとFirebaseの両方にログインできることを確認する。
- [ ] Firebase Realtime DatabaseのJSONバックアップを取得する。
- [ ] 管理に関わる部員それぞれの個人GitHubアカウントを管理者権限で追加する。
- [ ] 管理に関わる部員それぞれの個人GoogleアカウントをFirebaseプロジェクトの編集者以上として追加する。
- [ ] 共用アカウントからログアウトした状態でも、個人アカウントでGitHubとFirebaseの管理画面を開けることを確認する。
- [ ] GitHub Pagesの公開先を確認し、実際に公開ページから投稿して画面に反映されることを確認する。
- [ ] バックアップからの復元方法と、投稿削除方法に目を通す。
- [ ] 次の担当者が同じ手順を実行できるよう、アカウント・権限・公開先の状況を引き継ぐ。

### 引き継ぎ完了の条件

運用を続ける場合は、少なくとも次の状態になってから引き継ぎ完了としてください。

1. 個人のGitHubアカウントでソースコードと公開設定を管理できる。
2. 個人のGoogleアカウントでFirebaseプロジェクトを管理できる。
3. 公開ページへの投稿と、コード更新の反映を実際に確認している。
4. 最新のFirebase JSONバックアップを保管し、復旧方法を把握している。

共用アカウントのパスワードを知っているだけでは、引き継ぎ完了とは言えないです。普段の管理作業は個人アカウントで行える状態にしてください。

## アカウントと権限の引き継ぎ

### 部活の共用アカウント

GitHubとFirebaseの所有・保管用アカウントとして、部活で共用しているGoogleアカウントを維持します。

- **共用アカウント**: `omochinomocchili@gmail.com`
- **GitHub**: このGoogleアカウントでGitHubにもログインします。共用アカウントが所有するリポジトリを管理するために使います。
- **Firebase**: 同じGoogleアカウントでFirebaseコンソールにログインします。Firebaseプロジェクトの所有者として維持します。
- **パスワードの保管場所**: 部室の物化部ノート、または「物化部現役」グループLINEのノート。分からない時は、まずこの2箇所を確認してください。

**パスワードそのものはREADMEやGitHub、ソースコードには絶対に記載しないでください。** この資料には保管場所だけを記載します。共用アカウントは保管・引き継ぎ用として残し、普段の管理・変更作業は各自の個人アカウントから行ってください。

### GitHubに個人アカウントを追加する

1. 共用アカウントでGitHubにログインし、対象のリポジトリを開きます。
2. リポジトリの Settings → Collaborators（またはアクセス管理の項目）を開きます。
3. Add people から、管理に関わる部員の個人GitHubアカウントを招待します。
4. 公開設定なども管理できるよう、必要に応じてAdmin権限を付与します。Write権限では一部の管理設定を変更できない場合があります。
5. 招待された側のアカウントで招待を承認します。

### Firebaseに個人アカウントを追加する

1. [Firebaseコンソール](https://console.firebase.google.com/)を開き、共用アカウントでログインします。
2. 対象プロジェクトを選び、歯車アイコン → プロジェクトの設定 → ユーザーと権限を開きます。
3. メンバーを追加し、個人のGoogleアカウントのメールアドレスを入力します。
4. 役割は編集者以上を選択して追加します。
5. 招待された個人アカウントでFirebaseコンソールにアクセスできることを確認します。

### 個人アカウントを追加する理由

共用アカウントのパスワードだけに頼ると、保管ノートが見つからない、アカウントにログインできないなどの理由で管理が止まる可能性があります。代替わりの際は個人アカウントを必ず追加し、個人アカウントだけでもGitHubとFirebaseを管理できることを確認してください。共用アカウントは削除せず、次の代への保管用として維持します。

## 主な機能

### コメント表示
- 通常の流れるコメントと、画面中央に固定するコメント
- コメントの文字サイズ・色の変更
- 虹色、五千兆表示、ドットフォント表示
- 表示設定（投稿ログ、読み上げ、虹色アニメーション）
- コメントのリアルタイム同期

### 投稿タイムライン
- 「新着」「話題」「投票」のタブ
- 投稿へのいいねと、いいね数に基づく話題表示
- 本文中の `#投稿番号` による引用
- 投稿者ランキング（直近100件）
- 投稿履歴のTXT / JSON書き出し
- Firebase上の投稿データを使った再現、およびTXTファイルからの再生

### 投票
- 2〜6個の選択肢を持つ投票の作成
- 単一選択・複数選択
- 投票時間中の再投票（自分の票の変更）
- 途中経過・選択肢ごとの票数の表示設定
- 進行中の投票と過去の結果を表示する投票タブ
- nicoArea上での投票表示と、終了時の結果発表表示
- 通常投稿から投票を引用

## 利用技術

| 分類 | 技術 |
|---|---|
| フロントエンド | HTML / CSS / JavaScript（フレームワークなし） |
| データベース | Firebase Realtime Database |
| 認証 | Firebase Authentication（匿名認証） |
| 表示ライブラリ | DOMPurify |
| フォント | k8x12S、GenZenGothicKaiC、Akshar |
| 公開 | GitHub Pages |

ビルドツールやパッケージマネージャーは使用していません。HTML・CSS・JavaScriptをブラウザで直接読み込む構成です。

## リポジトリ構成

主要ファイルはリポジトリ直下にあります。

| ファイル | 役割 |
|---|---|
| `index.html` | 画面構造、フォーム、タブ、各パネル、外部ライブラリとJSの読み込み |
| `style.css` | レイアウト、配色、カード、レスポンシブ表示、アニメーション |
| `fonts.css` | k8x12S・GenZenGothicKaiCなどのフォント定義 |
| `utils.js` | 投稿制限、サニタイズ補助、日付・引用・文字列処理などの共通関数 |
| `layout.js` | 画面サイズや縦横比に応じたレイアウト調整 |
| `ranking.js` | 直近100件を対象とする投稿者ランキング |
| `settings.js` | 投稿フォーム、表示設定、ローカル設定の管理 |
| `timeline.js` | 投稿カード、引用カード、タイムライン、履歴書き出し |
| `comments.js` | 流れるコメント・中央固定コメント・読み上げ・投稿再現 |
| `firebase.js` | Firebase初期化、匿名認証、投稿・いいね・引用・接続状況・バージョン管理 |
| `polls.js` | 投票の作成・投票・結果表示・投票タブ・nicoArea上の投票表示 |

### JavaScriptの読み込み順

`index.html` では、次の順番で読み込みます。

```text
utils.js
  → layout.js
  → ranking.js
  → settings.js
  → timeline.js
  → comments.js
  → firebase.js
  → polls.js
```

各ファイルはグローバルスコープの関数・変数を共有しています。依存関係を確認せずに順番を変更しないでください。特に `polls.js` は `firebase.js` が初期化するFirebase関連の変数・認証完了処理を利用するため、後ろに置きます。

## 動作の仕組み

1. `index.html` がFirebase SDK、DOMPurify、CSS、各JavaScriptを読み込みます。
2. `firebase.js` がFirebaseを初期化し、匿名認証を完了させます。
3. Realtime Databaseから投稿・投票などを取得し、変更をリアルタイムに画面へ反映します。
4. 投稿・投票などのデータはFirebaseに保存され、利用者間で共有されます。

匿名認証は利用者にアカウント登録を求めずFirebase UIDを発行する仕組みです。本人確認や強固な不正防止を提供するものではありません。

## Firebaseの設定と管理

### Firebaseコンソール（管理画面）

このアプリに独立した管理画面はありません。**Firebaseコンソールが実質的な管理画面**です。

1. [Firebaseコンソール](https://console.firebase.google.com/)を開きます。
2. 共用アカウント、または権限を付与された個人Googleアカウントでログインします。
3. 対象プロジェクトを選択し、左メニューの Realtime Database を開きます。
4. データの確認・バックアップは「データ」タブ、ルールの確認・変更は「ルール」タブで行います。

### 使用プロジェクト

現在のフロントエンド設定（`firebase.js`）は、次のFirebaseプロジェクトを参照しています。

- **Firebase Project ID:** `nicotwibukka`
- **Realtime Database:** `nicotwibukka-default-rtdb.asia-southeast1.firebasedatabase.app`

FirebaseのAPIキー等はWebアプリから利用する公開設定値です。データ保護はAPIキーの秘匿ではなく、Authentication・Realtime Database Security Rules・必要に応じたApp Check等で行います。

### 必要なFirebase機能

- **Authentication:** Anonymous（匿名）ログインを有効にする
- **Realtime Database:** データベースを作成し、下記のSecurity Rulesを設定する

匿名認証が無効、またはデータベースのルールとアプリの書き込み仕様が一致しない場合、投稿・投票などが失敗します。

## Realtime Databaseのデータ構造

| パス | 用途 |
|---|---|
| `/config/totalTweetCount` | 投稿番号の採番に使う累計投稿数 |
| `/config/current_version_key` | 利用中アプリのバージョン確認 |
| `/tweets/{tweetId}` | 投稿本文・投稿者・表示設定・反応数など |
| `/quoteIndex/{tweetNumber}` | 投稿番号から投稿キーを引く引用用インデックス |
| `/likedTweets/{entry}` | 話題タブで参照するいいね付き投稿のデータ |
| `/presence/{uid}/{connectionId}` | 匿名UIDごとの接続状態 |
| `/polls/{pollId}` | 投票タイトル・選択肢・作成者・期間・表示設定 |
| `/pollVotes/{pollId}/{uid}` | 匿名UIDごとの投票内容 |
| `/usageStats` | 旧利用状況監視用。現行コードでは利用していない |

投稿データには、名前・本文・色・表示形式・サイズ・タイムスタンプ・投稿番号のほか、いいね数、いいねしたユーザー、引用情報、アプリバージョンなどが含まれます。

投票データにはタイトル、作成者名・UID、選択肢、開始・終了時刻、投票時間、単一／複数選択、途中経過・票数表示の設定が含まれます。

## Security Rules

以下は、現在Firebaseコンソールに設定されているものとして共有されたRealtime Database Rulesです。FirebaseコンソールのRealtime Database → ルールに設定されている内容が実際の適用値です。README内の記載とコンソールの内容が異なる場合は、コンソールを正として確認してください。

```json
{
  "rules": {
    ".write": false,
    "config": {
      ".read": true,
      "totalTweetCount": {
        ".write": "newData.isNumber() && newData.val() >= 0 && ((!data.exists() && newData.val() === 1) || (data.isNumber() && newData.val() === data.val() + 1))"
      },
      "current_version_key": {
        ".read": true,
        ".write": "auth != null",
        ".validate": "newData.isString()"
      }
    },
    "tweets": {
      ".read": true,
      ".indexOn": ["tweetNumber"],
      "$tweet_id": {
        ".write": "!data.exists() && newData.hasChildren(['name', 'text', 'color', 'type', 'size', 'timestamp', 'tweetNumber'])",
        "name": {
          ".validate": "newData.isString() && newData.val().length > 0 && newData.val().length <= 15"
        },
        "text": {
          ".validate": "newData.isString() && newData.val().length > 0 && newData.val().length <= 14000"
        },
        "color": {
          ".validate": "newData.isString() && (newData.val().matches(/^#[0-9a-fA-F]{6}$/) || newData.val() === 'rainbow' || newData.val() === '5000trillion' || newData.val() === 'dot')"
        },
        "type": {
          ".validate": "newData.isString() && (newData.val() === 'normal' || newData.val() === 'center_fixed')"
        },
        "size": {
          ".validate": "newData.isString() && (newData.val() === 'small' || newData.val() === 'medium' || newData.val() === 'large')"
        },
        "timestamp": {
          ".validate": "newData.isNumber()"
        },
        "tweetNumber": {
          ".validate": "newData.isNumber()"
        },
        "reactions": {
          ".write": "newData.isNumber() && newData.val() >= 0",
          ".validate": "newData.isNumber() && newData.val() >= 0"
        },
        "reactedUsers": {
          ".write": "newData.hasChildren() || !newData.exists()",
          ".validate": "newData.hasChildren() || !newData.exists()",
          "$user_id": {
            ".validate": "newData.val() === true"
          }
        },
        "parent": {
          ".validate": "newData.isString() || !newData.exists()"
        },
        "quote": {
          ".validate": "newData.isNumber() || !newData.exists()"
        },
        "appVersion": {
          ".validate": "newData.isString()"
        },
        "$other": {
          ".validate": false
        }
      }
    },
    "presence": {
      ".read": true,
      "$user_id": {
        ".write": "auth != null && auth.uid === $user_id",
        "$connection_id": {
          ".write": "auth != null && auth.uid === $user_id",
          ".validate": "newData.isBoolean()"
        }
      }
    },
    "quoteIndex": {
      ".read": true,
      "$tweet_number": {
        ".write": "!data.exists() && newData.isString()",
        ".validate": "newData.isString()"
      }
    },
    "likedTweets": {
      ".read": true,
      "$entry": {
        ".write": true
      }
    },
    "usageStats": {
      ".read": false,
      ".write": false
    },
    "polls": {
      ".read": true,
      "$poll_id": {
        ".write": "auth != null && ((!data.exists() && newData.exists() && newData.child('creatorUid').val() === auth.uid && newData.child('createdAt').val() <= now && newData.child('createdAt').val() >= now - 60000) || (data.exists() && newData.exists() && data.child('creatorUid').val() === auth.uid && newData.child('title').val() === data.child('title').val() && newData.child('creatorName').val() === data.child('creatorName').val() && newData.child('durationSeconds').val() === data.child('durationSeconds').val() && newData.child('createdAt').val() === data.child('createdAt').val() && newData.child('endsAt').val() === data.child('endsAt').val() && newData.child('creatorUid').val() === data.child('creatorUid').val() && newData.child('allowMultiple').val() === data.child('allowMultiple').val() && newData.child('showResults').val() === data.child('showResults').val() && newData.child('showVoters').val() === data.child('showVoters').val() && newData.child('choices').val() === data.child('choices').val()))",
        ".validate": "newData.hasChildren(['title', 'creatorName', 'choices', 'durationSeconds', 'createdAt', 'endsAt', 'creatorUid', 'allowMultiple', 'showResults', 'showVoters'])",
        "title": {
          ".validate": "newData.isString() && newData.val().length >= 1 && newData.val().length <= 80"
        },
        "tweetNumber": {
          ".validate": "newData.isNumber() && newData.val() > 0"
        },
        "creatorName": {
          ".validate": "newData.isString() && newData.val().length >= 1 && newData.val().length <= 15"
        },
        "choices": {
          ".validate": "newData.hasChildren(['0', '1'])",
          "0": {
            ".validate": "newData.isString() && newData.val().length >= 1 && newData.val().length <= 40"
          },
          "1": {
            ".validate": "newData.isString() && newData.val().length >= 1 && newData.val().length <= 40"
          },
          "2": {
            ".validate": "newData.isString() && newData.val().length >= 1 && newData.val().length <= 40"
          },
          "3": {
            ".validate": "newData.isString() && newData.val().length >= 1 && newData.val().length <= 40"
          },
          "4": {
            ".validate": "newData.isString() && newData.val().length >= 1 && newData.val().length <= 40"
          },
          "5": {
            ".validate": "newData.isString() && newData.val().length >= 1 && newData.val().length <= 40"
          },
          "$other": {
            ".validate": false
          }
        },
        "durationSeconds": {
          ".validate": "newData.isNumber() && (newData.val() === 10 || newData.val() === 15 || newData.val() === 30 || newData.val() === 60 || newData.val() === 120 || newData.val() === 180 || newData.val() === 240 || newData.val() === 300)"
        },
        "createdAt": {
          ".validate": "newData.isNumber() && newData.val() <= now"
        },
        "endsAt": {
          ".validate": "newData.isNumber() && newData.val() >= newData.parent().child('createdAt').val() && newData.val() <= newData.parent().child('createdAt').val() + newData.parent().child('durationSeconds').val() * 1000"
        },
        "creatorUid": {
          ".validate": "newData.isString() && newData.val() === auth.uid"
        },
        "allowMultiple": {
          ".validate": "newData.isBoolean()"
        },
        "showResults": {
          ".validate": "newData.isBoolean()"
        },
        "showVoters": {
          ".validate": "newData.isBoolean()"
        },
        "$other": {
          ".validate": false
        }
      }
    },
    "pollVotes": {
      ".read": true,
      "$poll_id": {
        "$uid": {
          ".write": "auth != null && auth.uid === $uid && root.child('polls').child($poll_id).exists() && root.child('polls').child($poll_id).child('endsAt').val() > now",
          ".validate": "(root.child('polls').child($poll_id).child('allowMultiple').val() === false && newData.isNumber() && (newData.val() === 0 || newData.val() === 1 || newData.val() === 2 || newData.val() === 3 || newData.val() === 4 || newData.val() === 5) && root.child('polls').child($poll_id).child('choices').child(newData.val() + '').exists()) || (root.child('polls').child($poll_id).child('allowMultiple').val() === true && newData.hasChildren())",
          "0": {
            ".validate": "newData.isNumber() && (newData.val() === 0 || newData.val() === 1 || newData.val() === 2 || newData.val() === 3 || newData.val() === 4 || newData.val() === 5) && root.child('polls').child($poll_id).child('choices').child(newData.val() + '').exists()"
          },
          "1": {
            ".validate": "newData.isNumber() && (newData.val() === 0 || newData.val() === 1 || newData.val() === 2 || newData.val() === 3 || newData.val() === 4 || newData.val() === 5) && root.child('polls').child($poll_id).child('choices').child(newData.val() + '').exists()"
          },
          "2": {
            ".validate": "newData.isNumber() && (newData.val() === 0 || newData.val() === 1 || newData.val() === 2 || newData.val() === 3 || newData.val() === 4 || newData.val() === 5) && root.child('polls').child($poll_id).child('choices').child(newData.val() + '').exists()"
          },
          "3": {
            ".validate": "newData.isNumber() && (newData.val() === 0 || newData.val() === 1 || newData.val() === 2 || newData.val() === 3 || newData.val() === 4 || newData.val() === 5) && root.child('polls').child($poll_id).child('choices').child(newData.val() + '').exists()"
          },
          "4": {
            ".validate": "newData.isNumber() && (newData.val() === 0 || newData.val() === 1 || newData.val() === 2 || newData.val() === 3 || newData.val() === 4 || newData.val() === 5) && root.child('polls').child($poll_id).child('choices').child(newData.val() + '').exists()"
          },
          "5": {
            ".validate": "newData.isNumber() && (newData.val() === 0 || newData.val() === 1 || newData.val() === 2 || newData.val() === 3 || newData.val() === 4 || newData.val() === 5) && root.child('polls').child($poll_id).child('choices').child(newData.val() + '').exists()"
          },
          "$other": {
            ".validate": false
          }
        }
      }
    }
  }
}
```

### ルールの要点と注意

- ルートの `.write: false` により、明示的に許可された各パス以外への書き込みは拒否されます。
- 投稿本体は新規作成のみ許可され、投稿者名15文字以内、本文14,000文字以内などの検証があります。未定義フィールドは `$other` により拒否されます。
- `reactions` と `reactedUsers`、`likedTweets` は、ルール上は一般利用者からの書き込みを広く許可しています。いいね数や話題タブ用データの改ざんを完全には防げません。
- `tweets`、`polls`、`pollVotes` などの読み取りは公開設定です。投稿内容・投票データは認証なしの一般利用者から閲覧できる前提で扱ってください。
- 投票の作成・更新は匿名認証を要求し、作成者UIDと作成時刻を検証します。投票の基本設定は作成後に変更できない条件になっています。
- 投票は終了時刻前のみ本人UIDから書き込めます。単一選択と複数選択の両方を検証します。
- `usageStats` は読み書きとも拒否されており、現行アプリでは使用していません。
- Rulesはサーバー側の検証です。JavaScript側の入力制限だけをセキュリティ対策として扱わないでください。

**注意:** 共有されたルールには、いいね関連の書き込み制限や投票複数選択配列の要素数・重複数に関する制限など、改善を検討できる箇所があります。挙動を変える前に、現行アプリの書き込み形式を確認し、テスト用データベースで検証してください。

## 開発・更新方法

### ローカルで確認する

1. リポジトリをクローン、またはGitHub Codespacesで開きます。
2. `index.html` をブラウザで開きます。Firebase接続を含む動作確認にはインターネット接続が必要です。
3. Firebaseの認証・ルール・接続先が正しいことを確認します。

### コードを更新する

1. GitHub上で現在作業するブランチを確認し、そのブランチをCodespacesまたはローカル環境で開きます。
2. 変更前に最新の変更を取り込みます。
3. ファイルを編集し、ブラウザで表示と動作を確認します。
4. 差分を確認し、意図したファイルだけをコミット・プッシュします。
5. GitHub Pagesの公開元設定とデプロイ状況を確認し、公開ページに反映されたことを確認します。

ブランチ名やリポジトリの場所は変更されることがあるため、このREADMEには固定値を記載していません。作業を始める際は、GitHub上で現在の対象を確認してください。

### バージョン情報を変更する場合

アプリにはバージョン確認の仕組みがあります。バージョン表記や確認用の値を変更する場合は、`index.html`、`firebase.js`、Firebaseの `config/current_version_key` の関係を確認し、互いに食い違わないようにしてください。具体的な現在値はREADMEに固定せず、実際のソースコードとFirebaseのデータを確認してください。

## 運用・保守

### Firebaseデータのバックアップ

#### 方法1: アプリ内の書き出し機能（手軽）

画面下の「履歴をtxtで書き出し」から、直近100件・今日の投稿・全期間などをTXT形式で保存できます。投稿内容の記録には便利ですが、Firebaseの全データを復元する用途には使えません。

#### 方法2: FirebaseのJSONエクスポート（確実）

1. Firebaseコンソール → Realtime Database → データを開きます。
2. 一番上の階層（ルート）のメニューから「JSONをエクスポート」を選びます。
3. ダウンロードしたJSONファイルを安全な場所に保管します。

学期末や代替わり、大きな変更の前後にはJSONバックアップを取ることを強く推奨します。

### バックアップからの復元

1. Firebaseコンソール → Realtime Database → データを開きます。
2. ルート階層のメニューから「JSONをインポート」を選びます。
3. 保管しておいたJSONファイルを選択します。

**注意:** インポートするとデータベース全体が置き換わります。復元前に現在のデータもエクスポートしてください。一部だけ復元したい場合は、必要なノードだけを慎重に戻してください。

### 投稿の削除

アプリ内に投稿削除機能はありません。Firebaseコンソールの Realtime Database → データから該当する `tweets/{tweetId}` を削除します。

1. `tweets` を開き、投稿本文・投稿番号・タイムスタンプなどから対象を特定します。
2. 対象投稿のキーを削除します。
3. いいねが付いていた投稿は、対応する `likedTweets` にデータが残っていないか確認して削除します。
4. 引用インデックス `quoteIndex` に対応データがある場合も、必要に応じて確認します。

削除しても投稿番号は詰め直されず、欠番になります。引用元が削除された場合、引用先では元投稿が見つからなくなることがあります。

### 権限管理

GitHubリポジトリとFirebaseプロジェクトの管理権限を、特定の一人だけに集中させないでください。代替わりの際は前述の手順で複数の個人アカウントを追加し、実際にアクセスできることを確認します。卒業・退部などで管理者が離れる場合は、後任者のアクセスを確認してから継承してください。


## トラブル別の対応

**投稿やデータが消えた・おかしくなった**

直近のFirebase JSONバックアップからの復元を検討してください。インポートはデータベース全体を置き換えるため、復元前に現在のデータも必ずバックアップしてください。

**共用アカウントのパスワードが分からない**

まず部室の物化部ノートと「物化部現役」グループLINEのノートを確認してください。両方に見当たらない場合は、Googleアカウントに登録された復旧用電話番号・メールアドレスを使い、Googleのログイン画面から再設定できるか確認してください。

**GitHub Pagesが真っ白・更新が反映されない**

GitHub上で変更が正しくコミットされているかを確認し、Pagesのデプロイ状況を確認します。公開まで数分かかることがあります。ブラウザのキャッシュが原因の場合は、再読み込みやキャッシュを無視した再読み込みを試してください。あわせて Settings → Pages の公開元設定を確認してください。

**Firebaseへの投稿・投票の保存に失敗する**

Authenticationで匿名認証が有効か、Realtime DatabaseのSecurity Rulesが現在のアプリのデータ形式と一致しているかを確認します。ブラウザの開発者ツールに表示されるFirebaseエラーも確認してください。

**GitHubのリポジトリやFirebaseプロジェクトを誤って削除した**

削除後に復元可能な期間が残っている場合があります。GitHubはアカウント設定の削除済みリポジトリ、FirebaseはGoogle Cloud Consoleのリソース管理を確認してください。復元には所有者権限が必要になる場合があるため、共用アカウントの管理者に連絡してください。復元可能期間や画面構成は変更されるため、各サービスの最新の案内も確認してください。

## 既知の制約

- Firebaseの公開読み取りノードは、誰でもデータを取得できる前提です。
- 匿名認証はUIDを区別するためのもので、実在の利用者の本人確認ではありません。
- いいね関連の一部パスはSecurity Rules上の書き込み制限が弱く、不正な値の登録を完全には防止できません。
- 進行中投票数などの一部制御はクライアント側に依存します。複数端末からの同時操作に対する厳密な排他制御は保証されません。
- Firebaseの無料枠・利用量はFirebaseコンソールで確認してください。現行コードに利用量の自動停止機能はありません。
- READMEの説明と実装が食い違う場合は、対象ブランチのソースコードとFirebaseコンソールの実設定を確認し、このREADMEも更新してください。
