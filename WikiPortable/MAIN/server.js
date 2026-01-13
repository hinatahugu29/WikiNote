const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

// ミドルウェア
app.use(cors());
app.use(express.json({ limit: '50mb' })); // 大きな画像データに対応
app.use(express.static('public'));

// ディレクトリの作成
const DATA_DIR = path.join(__dirname, 'data');
const BACKUP_DIR = path.join(__dirname, 'backups');

if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

const DATA_FILE = path.join(DATA_DIR, 'wiki_data.json');
const MAX_BACKUPS = 30; // 最大保持バックアップ数

// 初期データの作成
function initializeData() {
    if (!fs.existsSync(DATA_FILE)) {
        const initialData = [{
            id: Date.now(),
            title: "ポータブルWikiへようこそ",
            category: "はじめに",
            tags: ["マニュアル", "重要"],
            content: `# ポータブルWikiシステム v2.0

このWikiシステムの新機能をご紹介します。

## 🎉 新機能

### 1. 自動保存
編集内容は自動的にサーバーに保存されます。保存ボタンをクリックすると即座にファイルに書き込まれます。

### 2. 自動バックアップ
データを保存するたびに、タイムスタンプ付きのバックアップが \`backups/\` フォルダに作成されます。

### 3. ポータブル性
このフォルダごと別のPCにコピーするだけで、全てのデータと設定が移行できます。

## 🚀 使い方

1. **記事の作成**: 「＋ 新規作成」ボタンをクリック
2. **編集**: タイトル、フォルダ、タグ、内容を入力
3. **保存**: 「保存」ボタンで自動的にサーバーへ保存
4. **バックアップ**: ヘッダーの「💾 バックアップ管理」から復元可能

## 📁 データの場所

- **メインデータ**: \`data/wiki_data.json\`
- **バックアップ**: \`backups/auto_YYYYMMDD_HHMMSS.json\`

## 🔄 PC間での移行

1. WikiPortableフォルダをまるごとコピー
2. 新しいPCで \`npm install\` を実行
3. \`start.bat\` (Windows) または \`start.sh\` (Mac/Linux) で起動

それだけです！`,
            updated: new Date().toLocaleString('ja-JP')
        }];
        fs.writeFileSync(DATA_FILE, JSON.stringify(initialData, null, 2), 'utf-8');
        console.log('✅ 初期データを作成しました');
    }
}

// データ取得API
app.get('/api/data', (req, res) => {
    try {
        if (fs.existsSync(DATA_FILE)) {
            const data = fs.readFileSync(DATA_FILE, 'utf-8');
            res.json(JSON.parse(data));
        } else {
            res.json([]);
        }
    } catch (error) {
        console.error('データ読み込みエラー:', error);
        res.status(500).json({ error: 'データの読み込みに失敗しました' });
    }
});

// データ保存API（自動バックアップ付き）
app.post('/api/data', (req, res) => {
    try {
        const data = req.body;

        // データ検証（空のデータの誤保存防止）
        if (!Array.isArray(data)) {
            return res.status(400).json({ error: 'データ形式が不正です' });
        }

        // 現在のデータを読み込んで比較
        let currentData = [];
        if (fs.existsSync(DATA_FILE)) {
            try {
                currentData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
            } catch (e) {
                console.warn('既存データの読み込み失敗:', e);
            }
        }

        // 既存データがあるのに、空のデータを保存しようとした場合の警告
        if (currentData.length > 0 && data.length === 0) {
            console.warn('⚠️ 警告: 既存のデータを空のデータで上書きしようとしています');
        }

        // 現在のデータをバックアップ
        if (fs.existsSync(DATA_FILE) && currentData.length > 0) {
            const timestamp = new Date().toISOString()
                .replace(/[-:]/g, '')
                .replace('T', '_')
                .split('.')[0];
            const backupFile = path.join(BACKUP_DIR, `auto_${timestamp}.json`);
            fs.copyFileSync(DATA_FILE, backupFile);
            console.log(`📦 バックアップ作成: ${backupFile}`);

            // 古いバックアップを削除
            cleanupOldBackups();
        }

        // 新しいデータを保存
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
        console.log(`💾 データを保存しました (${data.length}件)`);

        res.json({ success: true, message: 'データを保存しました' });
    } catch (error) {
        console.error('データ保存エラー:', error);
        res.status(500).json({ error: 'データの保存に失敗しました' });
    }
});

// バックアップ一覧取得API
app.get('/api/backups', (req, res) => {
    try {
        const backups = fs.readdirSync(BACKUP_DIR)
            .filter(file => file.endsWith('.json'))
            .map(file => {
                const filepath = path.join(BACKUP_DIR, file);
                const stats = fs.statSync(filepath);

                // 記事数をカウント（中身を少し読んで確認）
                let count = 0;
                try {
                    const content = fs.readFileSync(filepath, 'utf-8');
                    const json = JSON.parse(content);
                    count = Array.isArray(json) ? json.length : 0;
                } catch (e) {
                    count = '?';
                }

                return {
                    filename: file,
                    size: stats.size,
                    count: count,
                    created: stats.mtime.toISOString(),
                    createdLocal: stats.mtime.toLocaleString('ja-JP')
                };
            })
            .sort((a, b) => new Date(b.created) - new Date(a.created));

        res.json(backups);
    } catch (error) {
        console.error('バックアップ一覧取得エラー:', error);
        res.status(500).json({ error: 'バックアップ一覧の取得に失敗しました' });
    }
});

// 手動バックアップ作成API
app.post('/api/backups/manual', (req, res) => {
    try {
        if (fs.existsSync(DATA_FILE)) {
            const timestamp = new Date().toISOString()
                .replace(/[-:]/g, '')
                .replace('T', '_')
                .split('.')[0];
            const backupFile = path.join(BACKUP_DIR, `manual_${timestamp}.json`);
            fs.copyFileSync(DATA_FILE, backupFile);
            console.log(`📦 手動バックアップ作成: ${backupFile}`);

            // 古いバックアップを削除
            cleanupOldBackups();

            res.json({ success: true, message: '手動バックアップを作成しました' });
        } else {
            res.status(404).json({ error: 'データファイルが存在しません' });
        }
    } catch (error) {
        console.error('手動バックアップ作成エラー:', error);
        res.status(500).json({ error: 'バックアップ作成に失敗しました' });
    }
});

// バックアップから復元API
// バックアップから復元API
app.post('/api/restore/:filename', (req, res) => {
    try {
        const filename = req.params.filename;
        const backupFile = path.join(BACKUP_DIR, filename);

        if (!fs.existsSync(backupFile)) {
            return res.status(404).json({ error: 'バックアップファイルが見つかりません' });
        }

        // バックアップデータを読み込み確認
        const backupDataRaw = fs.readFileSync(backupFile, 'utf-8');
        const backupData = JSON.parse(backupDataRaw); // JSON検証

        // 復元前の安全対策：現在の状態も「復元前バックアップ」として保存
        if (fs.existsSync(DATA_FILE)) {
            const timestamp = new Date().toISOString()
                .replace(/[-:]/g, '')
                .replace('T', '_')
                .split('.')[0];
            const safetyBackup = path.join(BACKUP_DIR, `restore_safety_${timestamp}.json`);
            fs.copyFileSync(DATA_FILE, safetyBackup);
            console.log(`🛡️ 復元前の安全バックアップを作成: ${safetyBackup}`);
        }

        // 復元実行（ファイルを上書き）
        fs.writeFileSync(DATA_FILE, backupDataRaw, 'utf-8');
        console.log(`🔄 バックアップから復元しました: ${filename}`);

        res.json(backupData);
    } catch (error) {
        console.error('復元エラー:', error);
        res.status(500).json({ error: '復元に失敗しました' });
    }
});

// バックアップをマージ（追加）API
app.post('/api/merge/:filename', (req, res) => {
    try {
        const filename = req.params.filename;
        const backupFile = path.join(BACKUP_DIR, filename);

        if (!fs.existsSync(backupFile)) {
            return res.status(404).json({ error: 'バックアップファイルが見つかりません' });
        }

        // 現在のデータを読み込み
        let currentData = [];
        if (fs.existsSync(DATA_FILE)) {
            currentData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
        }

        // バックアップデータを読み込み
        const backupData = JSON.parse(fs.readFileSync(backupFile, 'utf-8'));

        // 既存のIDを取得
        const existingIds = new Set(currentData.map(item => item.id));

        // マージ処理（ID衝突を解決）
        const mergedData = [...currentData];
        let addedCount = 0;

        backupData.forEach(item => {
            // IDが既に存在する場合は新しいIDを割り当て
            if (existingIds.has(item.id)) {
                let newId = Date.now() + addedCount;
                while (existingIds.has(newId)) {
                    newId++;
                }
                item.id = newId;
                existingIds.add(newId);
            }

            // タイトルの重複チェック（オプション）
            const titleExists = currentData.some(existing => existing.title === item.title);
            if (titleExists) {
                item.title = `${item.title} (インポート)`;
            }

            mergedData.push(item);
            addedCount++;
        });

        console.log(`📦 マージ完了: ${addedCount}件の記事を追加`);
        res.json({
            success: true,
            merged: mergedData,
            addedCount: addedCount
        });
    } catch (error) {
        console.error('マージエラー:', error);
        res.status(500).json({ error: 'マージに失敗しました' });
    }
});

// バックアップ削除API
app.delete('/api/backups/:filename', (req, res) => {
    try {
        const filename = req.params.filename;
        const backupFile = path.join(BACKUP_DIR, filename);

        if (!fs.existsSync(backupFile)) {
            return res.status(404).json({ error: 'バックアップファイルが見つかりません' });
        }

        fs.unlinkSync(backupFile);
        console.log(`🗑️ バックアップを削除: ${filename}`);
        res.json({ success: true, message: 'バックアップを削除しました' });
    } catch (error) {
        console.error('削除エラー:', error);
        res.status(500).json({ error: '削除に失敗しました' });
    }
});

// 古いバックアップを削除
function cleanupOldBackups() {
    try {
        const backups = fs.readdirSync(BACKUP_DIR)
            .filter(file => file.endsWith('.json'))
            .map(file => ({
                filename: file,
                filepath: path.join(BACKUP_DIR, file),
                mtime: fs.statSync(path.join(BACKUP_DIR, file)).mtime
            }))
            .sort((a, b) => b.mtime - a.mtime);

        // MAX_BACKUPS を超える古いバックアップを削除
        if (backups.length > MAX_BACKUPS) {
            const toDelete = backups.slice(MAX_BACKUPS);
            toDelete.forEach(backup => {
                fs.unlinkSync(backup.filepath);
                console.log(`🗑️ 古いバックアップを削除: ${backup.filename}`);
            });
        }
    } catch (error) {
        console.error('バックアップクリーンアップエラー:', error);
    }
}

// サーバー起動
initializeData();

app.listen(PORT, () => {
    console.log('\n========================================');
    console.log('🚀 ポータブルWikiサーバーが起動しました');
    console.log(`📍 URL: http://localhost:${PORT}`);
    console.log('========================================\n');
    console.log('💡 ヒント:');
    console.log('  - データ保存先: data/wiki_data.json');
    console.log('  - バックアップ: backups/ フォルダ');
    console.log(`  - 最大保持数: ${MAX_BACKUPS}個\n`);

    // 自動的にブラウザを開く
    const open = require('child_process').exec;
    const url = `http://localhost:${PORT}`;

    // OSに応じてブラウザを開く
    const start = process.platform === 'darwin' ? 'open' :
        process.platform === 'win32' ? 'start' : 'xdg-open';

    setTimeout(() => {
        open(`${start} ${url}`);
    }, 1000);
});
