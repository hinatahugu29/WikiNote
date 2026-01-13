// ポータブルWiki v2.0 - サーバーAPI連携パッチ
// このスクリプトは既存のWikiシステムをサーバーベースストレージに変換します

(function () {
    'use strict';

    const API_BASE = '/api';
    const ORIGINAL_STORAGE_KEY = window.STORAGE_KEY || 'personal_wiki_data';

    // 元のinit関数を保存
    const originalInit = window.init;
    const originalSaveToStorage = window.saveToStorage;
    const originalExportData = window.exportData;
    const originalImportData = window.importData;

    // 新しいinit関数（サーバーからデータ取得）
    window.init = async function () {
        try {
            const response = await fetch(`${API_BASE}/data`);
            if (response.ok) {
                window.entries = await response.json();
                console.log('✅ サーバーからデータを読み込みました (' + window.entries.length + '件)');

                // localStorageにもバックアップ
                localStorage.setItem(ORIGINAL_STORAGE_KEY, JSON.stringify(window.entries));
            } else {
                throw new Error('サーバーからの読み込みに失敗');
            }
        } catch (error) {
            console.warn('⚠️ サーバー接続エラー。localStorageから読み込みます:', error);
            const saved = localStorage.getItem(ORIGINAL_STORAGE_KEY);
            if (saved) {
                window.entries = JSON.parse(saved);
            } else {
                window.entries = [];
            }
        }

        if (window.renderWiki) window.renderWiki();
        if (window.updateStorageInfo) window.updateStorageInfo();
        if (window.checkBackupReminder) window.checkBackupReminder();
        if (window.setHomeViewMode && window.currentViewMode) {
            window.setHomeViewMode(window.currentViewMode);
        }
    };

    // 新しいsaveToStorage関数（サーバーに保存）
    window.saveToStorage = async function () {
        try {
            const response = await fetch(`${API_BASE}/data`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(window.entries)
            });

            if (response.ok) {
                console.log('💾 サーバーに保存しました（自動バックアップ作成）');
                // localStorageにもバックアップ
                localStorage.setItem(ORIGINAL_STORAGE_KEY, JSON.stringify(window.entries));
            } else {
                throw new Error('保存に失敗');
            }
        } catch (error) {
            console.error('❌ サーバー保存エラー。localStorageのみに保存:', error);
            localStorage.setItem(ORIGINAL_STORAGE_KEY, JSON.stringify(window.entries));
            alert('サーバーへの保存に失敗しました。オフラインモードで動作しています。');
        }

        if (window.updateStorageInfo) window.updateStorageInfo();
    };

    // バックアップ管理UIの追加
    window.showBackupManager = async function () {
        try {
            const response = await fetch(`${API_BASE}/backups`);
            if (!response.ok) throw new Error('バックアップ一覧の取得に失敗');

            const backups = await response.json();

            if (backups.length === 0) {
                alert('バックアップはまだありません。');
                return;
            }

            // バックアップ一覧をモーダルで表示
            const modal = document.createElement('div');
            modal.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0,0,0,0.8);
                z-index: 9999;
                display: flex;
                justify-content: center;
                align-items: center;
            `;

            const content = document.createElement('div');
            content.style.cssText = `
                background: white;
                padding: 30px;
                border-radius: 15px;
                max-width: 700px;
                max-height: 80vh;
                overflow-y: auto;
                color: #333;
            `;

            let html = '<h2 style="margin-bottom:20px;">📦 バックアップ管理</h2>';
            html += '<p style="color:#666; margin-bottom:20px;">バックアップを選択して復元または追加できます</p>';
            html += '<div style="display:flex; flex-direction:column; gap:10px;">';

            backups.forEach((backup, i) => {
                const sizeKB = (backup.size / 1024).toFixed(2);
                html += `
                    <div style="border:1px solid #ddd; padding:15px; border-radius:8px; display:flex; justify-content:space-between; align-items:center;">
                        <div>
                            <div style="font-weight:600; margin-bottom:5px;">${backup.createdLocal}</div>
                            <div style="font-size:12px; color:#666;">${sizeKB} KB</div>
                        </div>
                        <div style="display:flex; gap:8px;">
                            <button onclick="mergeBackup('${backup.filename}')" 
                                style="background:#27ae60; color:white; border:none; padding:8px 15px; border-radius:5px; cursor:pointer; font-size:13px;"
                                title="既存データに追加">
                                ➕ 追加
                            </button>
                            <button onclick="restoreBackup('${backup.filename}')" 
                                style="background:#3498db; color:white; border:none; padding:8px 15px; border-radius:5px; cursor:pointer; font-size:13px;"
                                title="現在のデータを置き換え">
                                🔄 復元
                            </button>
                            <button onclick="deleteBackup('${backup.filename}')"
                                style="background:#e74c3c; color:white; border:none; padding:8px 15px; border-radius:5px; cursor:pointer; font-size:13px;">
                                🗑️
                            </button>
                        </div>
                    </div>
                `;
            });

            html += '</div>';
            html += '<button onclick="this.closest(\'.backup-modal\').remove()" style="margin-top:20px; background:#95a5a6; color:white; border:none; padding:10px 20px; border-radius:5px; cursor:pointer; width:100%;">閉じる</button>';

            content.innerHTML = html;
            modal.appendChild(content);
            modal.className = 'backup-modal';
            document.body.appendChild(modal);

        } catch (error) {
            console.error('バックアップ管理エラー:', error);
            alert('バックアップ一覧の取得に失敗しました');
        }
    };

    // バックアップ復元
    window.restoreBackup = async function (filename) {
        if (!confirm(`バックアップ「${filename}」から復元しますか？\n現在のデータは上書きされます。`)) {
            return;
        }

        try {
            const response = await fetch(`${API_BASE}/restore/${filename}`, {
                method: 'POST'
            });

            if (!response.ok) throw new Error('復元に失敗');

            const data = await response.json();
            window.entries = data;

            // 即座にサーバーに保存（復元後の状態を確定）
            await window.saveToStorage();

            // UIを更新
            if (window.renderWiki) window.renderWiki();
            if (window.renderSidebar) window.renderSidebar();

            // モーダルを閉じる
            document.querySelector('.backup-modal')?.remove();

            alert('復元が完了しました！');
        } catch (error) {
            console.error('復元エラー:', error);
            alert('復元に失敗しました');
        }
    };

    // バックアップをマージ（追加）
    window.mergeBackup = async function (filename) {
        if (!confirm(`バックアップ「${filename}」を現在のデータに追加しますか？\n（既存データは保持されます）`)) {
            return;
        }

        try {
            const response = await fetch(`${API_BASE}/merge/${filename}`, {
                method: 'POST'
            });

            if (!response.ok) throw new Error('マージに失敗');

            const result = await response.json();
            window.entries = result.merged;

            // 即座にサーバーに保存
            await window.saveToStorage();

            // UIを更新
            if (window.renderWiki) window.renderWiki();
            if (window.renderSidebar) window.renderSidebar();

            // モーダルを閉じる
            document.querySelector('.backup-modal')?.remove();

            alert(`マージが完了しました！\n${result.addedCount}件の記事を追加しました。`);
        } catch (error) {
            console.error('マージエラー:', error);
            alert('マージに失敗しました');
        }
    };

    // バックアップ削除
    window.deleteBackup = async function (filename) {
        if (!confirm(`バックアップ「${filename}」を削除しますか？`)) {
            return;
        }

        try {
            const response = await fetch(`${API_BASE}/backups/${filename}`, {
                method: 'DELETE'
            });

            if (!response.ok) throw new Error('削除に失敗');

            // バックアップマネージャーを再表示
            document.querySelector('.backup-modal')?.remove();
            window.showBackupManager();

        } catch (error) {
            console.error('削除エラー:', error);
            alert('削除に失敗しました');
        }
    };

    // ヘッダーメニューの更新（バックアップ管理ボタンを追加）
    window.addEventListener('DOMContentLoaded', () => {
        // 既存の「バックアップ保存」ボタンを非表示
        const oldBackupBtn = Array.from(document.querySelectorAll('span')).find(
            span => span.textContent.includes('💾 バックアップ保存')
        );
        if (oldBackupBtn) {
            oldBackupBtn.style.display = 'none';
        }

        // 既存の「復元」ボタンを「バックアップ管理」に変更
        const oldRestoreBtn = Array.from(document.querySelectorAll('span')).find(
            span => span.textContent.includes('📂 復元')
        );
        if (oldRestoreBtn) {
            oldRestoreBtn.textContent = '📦 バックアップ管理';
            oldRestoreBtn.onclick = showBackupManager;
        }

        // タイトルを更新
        const title = document.querySelector('h1');
        if (title && title.textContent.includes('Wiki Editor')) {
            title.textContent = '📘 Wiki Editor (Portable v2.0)';
        }

        // ストレージ情報の下に説明を追加
        const storageInfo = document.getElementById('storageInfo');
        if (storageInfo) {
            const serverInfo = document.createElement('div');
            serverInfo.style.cssText = 'margin-top:5px; font-size:11px; color:rgba(255,255,255,0.7);';
            serverInfo.textContent = '🚀 サーバーモード: 自動バックアップ有効';
            storageInfo.parentElement.insertBefore(serverInfo, storageInfo.nextSibling);
        }
    });

    console.log('🚀 ポータブルWiki v2.0 パッチが適用されました');
    console.log('   - サーバーベースストレージ');
    console.log('   - 自動バックアップ機能');
    console.log('   - バックアップ管理UI');
})();
