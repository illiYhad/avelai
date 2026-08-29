import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

// วิธีใช้งาน npm run diff:check หรือ npm run diff:check -- [จำนวนไฟล์]

// 1. รับจำนวนไฟล์จาก argument (ค่าเริ่มต้น 3 ไฟล์)
const fileLimit = parseInt(process.argv[2], 10) || 3;

// 2. ฟังก์ชัน Timestamp ภาษาไทย
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
    // 3. ดึงรายชื่อไฟล์ที่มีการเปลี่ยนแปลง
    const statusOutput = execSync('git status --porcelain', { encoding: 'utf-8' });

    const changedFiles = statusOutput
        .split('\n')
        .map(line => line.trim().slice(3))
        .filter(file => file && !file.includes('diff_check.txt') && !file.includes('node_modules'))
        .slice(0, fileLimit);

    if (changedFiles.length === 0) {
        console.log('ℹ️ ไม่พบไฟล์ที่มีการเปลี่ยนแปลงในระบบ');
        process.exit(0);
    }

    // 4. ประกอบ Header ข้อมูล Timestamp และ Location ของไฟล์
    let diffContent = `HEAD\n💎 [DIFF CHECK TIMESTAMP: ${timestamp}]\n`;
    diffContent += `📁 [TARGET FILES: ${changedFiles.length} / Limit: ${fileLimit}]\n\n`;
    diffContent += `📋 [MODIFIED FILES LIST]\n`;

    changedFiles.forEach((file, index) => {
        const fileName = path.basename(file);
        const fileDir = path.dirname(file).replace(/\\/g, '/');
        const displayLocation = fileDir === '.' ? 'root' : `${fileDir}/`;

        diffContent += `${index + 1}. File: [${fileName}]\n`;
        diffContent += `   Location: ${displayLocation}\n`;
        diffContent += `   Full Path: ${file.replace(/\\/g, '/')}\n\n`;
    });

    diffContent += `======================================================\n\n`;

    // 5. ดึงเนื้อหา Diff
    changedFiles.forEach(file => {
        try {
            const fileDiff = execSync(`git diff HEAD -- "${file}"`, { encoding: 'utf-8' });
            if (fileDiff) {
                diffContent += `${fileDiff}\n`;
            }
        } catch (err) {
            // ข้ามไฟล์ที่มีปัญหา
        }
    });

    // 6. บันทึกลง diff_check.txt
    const outputPath = path.resolve(process.cwd(), 'diff_check.txt');
    fs.writeFileSync(outputPath, diffContent, 'utf-8');

    console.log(`✅ เขียน diff (${timestamp}) ลง diff_check.txt เรียบร้อย!`);

} catch (error) {
    console.error('❌ เกิดข้อผิดพลาด:', error.message);
}