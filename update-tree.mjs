import fs from 'fs';
import path from 'path';

// กำหนดโฟลเดอร์ที่ต้องการดึงมาทำ Tree
const TARGET_DIRS = ['app', 'lib', 'src'];
// กำหนดสิ่งที่ไม่ต้องการให้แสดง
const IGNORE_PATTERNS = [/node_modules/, /\.next/, /\.git/, /\.DS_Store/];
const MD_FILE_PATH = path.resolve(process.cwd(), 'DataTree.md');

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

// 1. อ่าน Comment เดิมจาก DataTree.md เพื่อนำมาแปะกลับ
function extractExistingComments(content) {
    const commentMap = new Map();
    if (!content) return commentMap;

    const lines = content.split('\n');
    for (const line of lines) {
        const match = line.match(/(?:├──|└──|│\s+)\s*([\w\-./[\]]+)\s+(#.+)$/);
        if (match) {
            commentMap.set(match[1].trim(), match[2].trim());
        }
    }
    return commentMap;
}

// 2. สแกนโครงสร้างโฟลเดอร์จริง
function generateTree(dirPath, prefix = '', comments = new Map()) {
    if (!fs.existsSync(dirPath)) return '';
    const entries = fs.readdirSync(dirPath, { withFileTypes: true })
        .filter(e => !IGNORE_PATTERNS.some(p => p.test(e.name)))
        .sort((a, b) => (b.isDirectory() - a.isDirectory()) || a.name.localeCompare(b.name));

    let result = '';
    entries.forEach((entry, index) => {
        const isLast = index === entries.length - 1;
        const connector = isLast ? '└── ' : '├── ';
        const subPrefix = isLast ? '    ' : '│   ';
        const relativePath = path.relative(process.cwd(), path.join(dirPath, entry.name)).replace(/\\/g, '/');
        const comment = comments.get(entry.name) || comments.get(relativePath) || '';
        const commentSuffix = comment ? `   ${comment}` : '';

        result += `${prefix}${connector}${entry.name}${entry.isDirectory() ? '/' : ''}${commentSuffix}\n`;

        if (entry.isDirectory()) {
            result += generateTree(path.join(dirPath, entry.name), prefix + subPrefix, comments);
        }
    });
    return result;
}

// 3. รวมร่างและอัปเดตไฟล์ DataTree.md
function updateDataTree() {
    let content = '';
    if (fs.existsSync(MD_FILE_PATH)) {
        content = fs.readFileSync(MD_FILE_PATH, 'utf-8');
    }

    const comments = extractExistingComments(content);

    let newTree = 'avelai/\n';
    TARGET_DIRS.forEach(dir => {
        const fullPath = path.resolve(process.cwd(), dir);
        if (fs.existsSync(fullPath)) {
            newTree += `├── ${dir}/\n`;
            newTree += generateTree(fullPath, '│   ', comments);
        }
    });

    const treeBlock = `\`\`\`text\n${newTree.trimEnd()}\n\`\`\``;

    // อัปเดตเนื้อหา Tree ในบล็อก ```text ... ```
    if (/```text[\s\S]*?```/.test(content)) {
        content = content.replace(/```text[\s\S]*?```/, treeBlock);
    } else {
        content = `${content.trimEnd()}\n\n${treeBlock}\n`;
    }

    // อัปเดตหรือแทรก Timestamp บรรทัดใต้หัวข้อ H1 ทันที
    const timestampLine = `> 💎 **Last Updated:** ${timestamp}`;
    if (/> 💎 \*\*Last Updated:\*\* .*/.test(content)) {
        content = content.replace(/> 💎 \*\*Last Updated:\*\* .*/, timestampLine);
    } else if (content.startsWith('# ')) {
        // ถ้ายังไม่มี ให้แทรกต่อจากบรรทัดแรกที่เป็น # Title
        const firstLineEnd = content.indexOf('\n');
        if (firstLineEnd !== -1) {
            content = content.slice(0, firstLineEnd) + `\n${timestampLine}` + content.slice(firstLineEnd);
        } else {
            content = `${content}\n${timestampLine}\n`;
        }
    } else {
        content = `${timestampLine}\n\n` + content;
    }

    fs.writeFileSync(MD_FILE_PATH, content, 'utf-8');
    console.log(`✅ DataTree.md updated successfully! (${timestamp})`);
}

updateDataTree();