
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const inputArg = process.argv[2];
const isNumber = !isNaN(parseInt(inputArg, 10)) && !inputArg.includes('.');
let fileLimit = isNumber ? parseInt(inputArg, 10) : 2;
fileLimit = Math.min(Math.max(fileLimit, 1), 5); // ลิมิตระหว่าง 1 - 5 ไฟล์

const targetSpecificFile = (!isNumber && inputArg) ? inputArg.trim() : null;

function getFormattedTimestamp() {
    const now = new Date();
    const thaiDays = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];

    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');

    const dayName = thaiDays[now.getDay()];
    const date = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();

    return `เวลา ${hours}:${minutes}:${seconds} ${dayName} ${date}/${month}/${year}`;
}

const timestamp = getFormattedTimestamp();

const isIgnoredFile = (filePath) => {
    const baseName = path.basename(filePath).toLowerCase();
    const ignoredExtensions = ['.png', '.jpg', '.jpeg', '.svg', '.ico', '.woff', '.woff2', '.lock'];
    return (
        baseName.includes('diff_check') ||
        baseName.includes('diff-check') ||
        baseName.startsWith('.') ||
        filePath.includes('node_modules') ||
        filePath.includes('.next') ||
        filePath.includes('.git') ||
        ignoredExtensions.some(ext => baseName.endsWith(ext))
    );
};

// ฟังก์ชันสแกนไฟล์ในเครื่องเรียงตามเวลาแก้ไขล่าสุด (Fallback ชั้นสุดท้าย)
function getRecentModifiedFilesSystem(dir, limit) {
    let results = [];
    try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            const relativePath = path.relative(process.cwd(), fullPath).replace(/\\/g, '/');

            if (isIgnoredFile(relativePath)) continue;

            if (entry.isDirectory()) {
                results = results.concat(getRecentModifiedFilesSystem(fullPath, limit));
            } else if (entry.isFile()) {
                const stats = fs.statSync(fullPath);
                results.push({ path: relativePath, mtime: stats.mtimeMs });
            }
        }
    } catch {
        // ignore error
    }
    
    return results
        .sort((a, b) => b.mtime - a.mtime)
        .slice(0, limit)
        .map(f => f.path);
}

try {
    let changedFiles = [];

    if (targetSpecificFile) {
        // โหมดระบุชื่อไฟล์ตรงๆ
        let foundPath = '';
        try {
            const allFiles = execSync('git ls-files', { encoding: 'utf-8' })
                .split('\n')
                .map(line => line.trim())
                .filter(Boolean);

            const match = allFiles.find(f =>
                path.basename(f).toLowerCase() === targetSpecificFile.toLowerCase() ||
                f.toLowerCase() === targetSpecificFile.toLowerCase()
            );
            if (match) foundPath = match;
        } catch {
            // ignore error
        }

        if (!foundPath && fs.existsSync(targetSpecificFile)) {
            foundPath = targetSpecificFile;
        }

        changedFiles = foundPath ? [foundPath] : [targetSpecificFile];
    } else {
        const fileSet = new Set();

        // 1. ดึงไฟล์ที่ค้างใน Working Tree (Uncommitted)
        try {
            const statusOutput = execSync('git status --porcelain', { encoding: 'utf-8' });
            statusOutput
                .split('\n')
                .map(line => line.trim())
                .filter(Boolean)
                .map(line => {
                    const match = line.match(/^(\S+|\?\?)\s+(.*)$/);
                    const rawPath = match ? match[2].trim() : line.slice(3).trim();
                    return rawPath.replace(/^["']|["']$/g, '');
                })
                .filter(file => file && !isIgnoredFile(file))
                .forEach(file => fileSet.add(file));
        } catch {
            // ignore error
        }

        // 2. ถ้ายังไม่ครบ ให้ไล่ดึงจาก Commit History ย้อนหลัง
        if (fileSet.size < fileLimit) {
            try {
                const logFiles = execSync('git log -n 15 --name-only --pretty=""', { encoding: 'utf-8' })
                    .split('\n')
                    .map(line => line.trim().replace(/^["']|["']$/g, ''))
                    .filter(file => file && !isIgnoredFile(file));

                for (const file of logFiles) {
                    if (fileSet.size >= fileLimit) break;
                    if (fs.existsSync(path.resolve(process.cwd(), file))) {
                        fileSet.add(file);
                    }
                }
            } catch {
                // ignore error
            }
        }

        // 3. ถ้ายังไม่พออีก กวาดจากเวลาแก้ไขล่าสุดในระบบเครื่อง
        if (fileSet.size < fileLimit) {
            const systemFiles = getRecentModifiedFilesSystem(process.cwd(), fileLimit);
            for (const file of systemFiles) {
                if (fileSet.size >= fileLimit) break;
                fileSet.add(file);
            }
        }

        changedFiles = Array.from(fileSet).slice(0, fileLimit);
    }

    if (changedFiles.length === 0) {
        console.log('ℹ️ ไม่พบไฟล์ที่ต้องการประมวลผล');
        process.exit(0);
    }

    let diffContent = `HEAD\n💎 [DIFF CHECK TIMESTAMP: ${timestamp}]\n`;
    diffContent += `📁 [TARGET FILES: ${changedFiles.length} (Max Limit: ${fileLimit})]\n\n`;
    diffContent += `📋 [MODIFIED FILES LIST]\n`;

    changedFiles.forEach((file, index) => {
        const cleanPath = file.replace(/^["']|["']$/g, '');
        const fileName = path.basename(cleanPath);
        const fileDir = path.dirname(cleanPath).replace(/\\/g, '/');
        const displayLocation = fileDir === '.' ? 'root' : `${fileDir}/`;

        diffContent += `${index + 1}. File: [${fileName}]\n`;
        diffContent += `   Location: ${displayLocation}\n`;
        diffContent += `   Full Path: ${cleanPath.replace(/\\/g, '/')}\n\n`;
    });

    diffContent += `======================================================\n\n`;

    // รวมข้อมูล Diff และ Content ของแต่ละไฟล์
    changedFiles.forEach(file => {
        const cleanPath = file.replace(/^["']|["']$/g, '');
        const fullPath = path.resolve(process.cwd(), cleanPath);
        let fileDiff = '';

        diffContent += `// -----------------------------------------------------\n`;
        diffContent += `// 📄 FILE: ${cleanPath}\n`;
        diffContent += `// -----------------------------------------------------\n`;

        try {
            // ดึง Uncommitted Diff
            fileDiff = execSync(`git diff HEAD -- "${cleanPath}"`, { encoding: 'utf-8' });

            // ดึง Diff จาก Commit ล่าสุดของไฟล์นั้น
            if (!fileDiff.trim()) {
                try {
                    const lastCommitHash = execSync(`git log -n 1 --pretty=format:%h -- "${cleanPath}"`, { encoding: 'utf-8' }).trim();
                    const lastCommitSubject = execSync(`git log -n 1 --pretty=format:%s -- "${cleanPath}"`, { encoding: 'utf-8' }).trim();

                    if (lastCommitHash) {
                        const commitDiff = execSync(`git show ${lastCommitHash} -- "${cleanPath}"`, { encoding: 'utf-8' });
                        if (commitDiff.trim()) {
                            fileDiff = `// 🕒 [LATEST COMMIT: ${lastCommitHash} - "${lastCommitSubject}"]\n` + commitDiff;
                        }
                    }
                } catch {
                    // ignore error
                }
            }

            // Dump โค้ดเต็มของไฟล์แนบลงไปด้วยเสมอ
            if (fs.existsSync(fullPath)) {
                const fullText = fs.readFileSync(fullPath, 'utf-8');
                if (fileDiff.trim()) {
                    diffContent += `${fileDiff}\n\n// 📦 [FULL FILE CONTENT]\n${fullText}\n\n`;
                } else {
                    diffContent += `// 📦 [FULL FILE CONTENT]\n${fullText}\n\n`;
                }
            } else {
                diffContent += fileDiff ? `${fileDiff}\n\n` : `// ⚠️ ไฟล์ถูกลบหรือไม่พบพาธไฟล์\n\n`;
            }
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            diffContent += `// ⚠️ เกิดข้อผิดพลาดในการอ่านไฟล์: ${cleanPath} (${msg})\n\n`;
        }
    });

    const outputPath = path.resolve(process.cwd(), 'diff_check.txt');
    fs.writeFileSync(outputPath, diffContent, 'utf-8');

    console.log(`✅ เขียน Diff & History ล่าสุด ${changedFiles.length} ไฟล์ (${timestamp}) ลง diff_check.txt เรียบร้อย!`);

} catch (err) {
    console.error('❌ เกิดข้อผิดพลาดร้ายแรงในระบบ Diff Check:', err);
}