import fs from 'fs';
import path from 'path';

// กำหนดโฟลเดอร์ที่ต้องการดึงมาทำ Tree
const TARGET_DIRS = ['app', 'lib', 'src'];
// กำหนดสิ่งที่ไม่ต้องการให้แสดง
const IGNORE_PATTERNS = [/node_modules/, /\.next/, /\.git/, /\.DS_Store/];
const MD_FILE_PATH = path.resolve(process.cwd(), 'DataTree.md');

// 1. อ่าน Comment เดิมจาก DataTree.md เพื่อนำมาแปะกลับ
function extractExistingComments(content) {
    const commentMap = new Map();
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
    if (!fs.existsSync(MD_FILE_PATH)) {
        console.error('❌ DataTree.md not found.');
        return;
    }

    const oldContent = fs.readFileSync(MD_FILE_PATH, 'utf-8');
    const comments = extractExistingComments(oldContent);

    let newTree = 'avelai/\n';
    TARGET_DIRS.forEach(dir => {
        const fullPath = path.resolve(process.cwd(), dir);
        if (fs.existsSync(fullPath)) {
            newTree += `├── ${dir}/\n`;
            newTree += generateTree(fullPath, '│   ', comments);
        }
    });

    const updatedContent = oldContent.replace(
        /```text[\s\S]*?```/,
        `\`\`\`text\n${newTree.trimEnd()}\n\`\`\``
    );

    fs.writeFileSync(MD_FILE_PATH, updatedContent, 'utf-8');
    console.log('✅ DataTree.md updated successfully!');
}

updateDataTree();