import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const inputArg = process.argv[2];
const isNumber = !isNaN(parseInt(inputArg, 10)) && !inputArg.includes('.');
const fileLimit = isNumber ? parseInt(inputArg, 10) : 3;
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

try {
    const ignoreList = ['diff_check.txt', 'diff-check.mjs', 'diff-check.js'];
    let changedFiles = [];

    if (targetSpecificFile) {
        // โหมด 1: ค้นหาไฟล์ทั่วทั้งโปรเจกต์ผ่าน Git และ System
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
        } catch (e) { }

        // ถ้าใน Git หาไม่เจอ ลองหาไฟล์ในเครื่อง
        if (!foundPath && fs.existsSync(targetSpecificFile)) {
            foundPath = targetSpecificFile;
        }

        changedFiles = foundPath ? [foundPath] : [targetSpecificFile];
    } else {
        // โหมด 2: ดึงจาก git status อัตโนมัติ
        let statusOutput = execSync('git status --porcelain', { encoding: 'utf-8' });

        // ถ้าไม่มีไฟล์ที่กำลังแก้ค้างอยู่ ให้ดึงรายชื่อไฟล์จาก Commit ล่าสุดแทน
        if (!statusOutput.trim()) {
            try {
                statusOutput = execSync('git diff-tree --no-commit-id --name-only -r HEAD', { encoding: 'utf-8' });
            } catch (e) { }
        }

        changedFiles = statusOutput
            .split('\n')
            .map(line => line.trim())
            .filter(Boolean)
            .map(line => {
                const match = line.match(/^(\S+|\?\?)\s+(.*)$/);
                const rawPath = match ? match[2].trim() : line.trim();
                return rawPath.replace(/^["']|["']$/g, '');
            })
            .filter(file => {
                const baseName = path.basename(file);
                return file &&
                    !ignoreList.includes(baseName) &&
                    !file.includes('node_modules');
            })
            .slice(0, fileLimit);
    }

    if (changedFiles.length === 0) {
        console.log('ℹ️ ไม่พบไฟล์ที่ต้องการประมวลผล');
        process.exit(0);
    }

    let diffContent = `HEAD\n💎 [DIFF CHECK TIMESTAMP: ${timestamp}]\n`;
    diffContent += `📁 [TARGET FILES: ${changedFiles.length}]\n\n`;
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

    // ดึง Diff / Log History / Content
    changedFiles.forEach(file => {
        const cleanPath = file.replace(/^["']|["']$/g, '');
        let fileDiff = '';

        try {
            // 1. ลองดึง Uncommitted Diff ปัจจุบัน
            fileDiff = execSync(`git diff HEAD -- "${cleanPath}"`, { encoding: 'utf-8' });

            // 2. ถ้าไม่มี Diff ลองดึง Commit Diff ล่าสุดของไฟล์
            if (!fileDiff.trim()) {
                try {
                    const lastCommitHash = execSync(`git log -n 1 --pretty=format:%h -- "${cleanPath}"`, { encoding: 'utf-8' }).trim();
                    const lastCommitSubject = execSync(`git log -n 1 --pretty=format:%s -- "${cleanPath}"`, { encoding: 'utf-8' }).trim();

                    if (lastCommitHash) {
                        const commitDiff = execSync(`git diff ${lastCommitHash}^! -- "${cleanPath}"`, { encoding: 'utf-8' });
                        if (commitDiff.trim()) {
                            fileDiff = `// 🕒 [LATEST COMMIT DIFF: ${lastCommitHash} - "${lastCommitSubject}"]\n` + commitDiff;
                        }
                    }
                } catch (e) { }
            }

            // 3. Fallback: ถ้ายังไม่มี ให้ Dump ไฟล์เต็ม
            if (!fileDiff.trim()) {
                const fullPath = path.resolve(process.cwd(), cleanPath);
                if (fs.existsSync(fullPath)) {
                    fileDiff = `// 📄 [FULL FILE CONTENT]\n` + fs.readFileSync(fullPath, 'utf-8');
                }
            }

            if (fileDiff) {
                diffContent += `${fileDiff}\n\n`;
            } else {
                diffContent += `// ⚠️ ไม่พบการเปลี่ยนแปลงหรือเนื้อหาของไฟล์: ${cleanPath}\n\n`;
            }
        } catch (err) {
            diffContent += `// ⚠️ เกิดข้อผิดพลาดในการอ่านไฟล์: ${cleanPath}\n\n`;
        }
    });

    const outputPath = path.resolve(process.cwd(), 'diff_check.txt');
    fs.writeFileSync(outputPath, diffContent, 'utf-8');

    console.log(`✅ เขียน Diff & History (${timestamp}) ลง diff_check.txt เรียบร้อย!`);

} catch (error) {
    console.error('❌ เกิดข้อผิดพลาด:', error.message);
}