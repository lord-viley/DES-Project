// One-command database setup:  npm run setup   (first time)
//                              npm run reset   (wipe and rebuild, sample data included)
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const DB_NAME = 'sporting_goods_store';
// Every numbered file in sql/ runs in order (01_..., 02_..., 05_Images.sql, ...),
// so a teammate's new SQL file is picked up without editing this script.
const FILES = fs.readdirSync(path.join(__dirname, '..', 'sql'))
    .filter((name) => /^\d+_.*\.sql$/i.test(name))
    .sort();

// Split a .sql file into statements. Understands the DELIMITER command that
// MySQL Workbench uses for trigger bodies, and skips whole-line comments.
function splitSql(text) {
    const statements = [];
    let delimiter = ';';
    let buffer = '';

    for (const line of text.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (trimmed.toUpperCase().startsWith('DELIMITER ')) {
            delimiter = trimmed.slice('DELIMITER '.length).trim();
            continue;
        }
        if (trimmed.startsWith('--')) continue;

        buffer += line + '\n';
        if (trimmed.endsWith(delimiter)) {
            const statement = buffer.trim().slice(0, -delimiter.length).trim();
            if (statement) statements.push(statement);
            buffer = '';
        }
    }
    if (buffer.trim()) statements.push(buffer.trim());
    return statements;
}

async function main() {
    const reset = process.argv.includes('--reset');

    const conn = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || ''
    });

    const [existing] = await conn.query('SHOW DATABASES LIKE ?', [DB_NAME]);
    if (existing.length > 0) {
        if (!reset) {
            console.log(`Database "${DB_NAME}" already exists. Nothing changed.`);
            console.log('To wipe it and rebuild from the SQL files, run:  npm run reset');
            await conn.end();
            return;
        }
        await conn.query(`DROP DATABASE ${DB_NAME}`);
        console.log(`Dropped existing "${DB_NAME}".`);
    }

    for (const file of FILES) {
        const text = fs.readFileSync(path.join(__dirname, '..', 'sql', file), 'utf8');
        const statements = splitSql(text);
        for (const statement of statements) {
            await conn.query(statement);
        }
        console.log(`Ran ${file} (${statements.length} statements)`);
    }

    await conn.end();
    console.log('\nDatabase ready. Start the app with:  npm start');
    console.log('Login: admin / admin123');
}

main().catch((err) => {
    console.error('\nSetup failed:', err.message);
    if (err.code === 'ER_ACCESS_DENIED_ERROR') {
        console.error('Check DB_PASSWORD in your .env file (copy .env.example to .env).');
    } else if (err.code === 'ECONNREFUSED') {
        console.error('MySQL is not running or DB_HOST is wrong.');
    }
    process.exit(1);
});