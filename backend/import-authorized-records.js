const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
require('./src/config/loadEnv');
const db = require('./src/db');

const requiredHeaders = ['role', 'full_name', 'usn_or_employee_id', 'college_email'];
const allowedRoles = new Map([
  ['student', 'Student'],
  ['teacher', 'Teacher'],
  ['admin', 'Admin'],
]);

function parseCsv(contents, inferredRole) {
  let rows;
  try {
    rows = parse(contents, {
      bom: true,
      skip_empty_lines: true,
      trim: true,
    });
  } catch {
    throw new Error('Could not parse CSV. Check its quoting and column counts.');
  }

  if (rows.length === 0) {
    throw new Error('CSV is empty.');
  }

  const headers = rows[0].map((header) => {
    const normalizedHeader = String(header).trim().toLowerCase();
    if (normalizedHeader === 'name') return 'full_name';
    if (normalizedHeader === 'email') return 'college_email';
    return normalizedHeader;
  });
  if (new Set(headers).size !== headers.length) {
    throw new Error('CSV contains duplicate column headers.');
  }

  const missingHeaders = requiredHeaders.filter(
    (header) => header !== 'role' || !inferredRole,
  ).filter((header) => !headers.includes(header));
  if (missingHeaders.length > 0) {
    throw new Error(`CSV is missing required headers: ${missingHeaders.join(', ')}.`);
  }

  const records = rows.slice(1).map((values, index) => {
    const row = Object.fromEntries(headers.map((header, column) => [header, values[column] || '']));
    return { line: index + 2, row, inferredRole };
  });

  if (records.length === 0) {
    throw new Error('CSV contains a header but no records.');
  }

  return records;
}

function validateRecords(records) {
  const errors = [];
  const normalizedRecords = [];
  const seenEmails = new Set();
  const seenIds = new Set();

  for (const { line, row, inferredRole } of records) {
    const record = {
      role: allowedRoles.get((row.role || inferredRole || '').toLowerCase()),
      fullName: (row.full_name || '').trim(),
      employeeId: (row.usn_or_employee_id || '').trim(),
      email: (row.college_email || '').trim().toLowerCase(),
      branch: (row.branch || '').trim() || null,
      section: (row.section || '').trim() || null,
      department: (row.department || '').trim() || null,
      semester: null,
    };
    const rowErrors = [];

    if (inferredRole && row.role && allowedRoles.get(row.role.toLowerCase()) !== inferredRole) {
      rowErrors.push('role does not match filename');
    }
    if (!record.role) rowErrors.push('role');
    if (!record.fullName || record.fullName.length > 150) rowErrors.push('full_name');
    if (!record.employeeId || record.employeeId.length > 50) rowErrors.push('usn_or_employee_id');
    if (
      record.email.length > 150 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(record.email)
    ) {
      rowErrors.push('college_email');
    }

    for (const [field, maxLength] of [
      ['branch', 50],
      ['section', 10],
      ['department', 50],
    ]) {
      if (record[field] && record[field].length > maxLength) rowErrors.push(field);
    }

    const semester = (row.semester || '').trim();
    if (semester) {
      const parsedSemester = Number(semester);
      if (!Number.isInteger(parsedSemester) || parsedSemester < 1) {
        rowErrors.push('semester');
      } else {
        record.semester = parsedSemester;
      }
    }

    if (record.email && seenEmails.has(record.email)) rowErrors.push('duplicate college_email');
    if (record.employeeId && seenIds.has(record.employeeId)) rowErrors.push('duplicate usn_or_employee_id');
    if (record.email) seenEmails.add(record.email);
    if (record.employeeId) seenIds.add(record.employeeId);

    if (rowErrors.length > 0) {
      errors.push(`Line ${line}: invalid ${rowErrors.join(', ')}.`);
    } else {
      normalizedRecords.push(record);
    }
  }

  return { normalizedRecords, errors };
}

function inferRoleFromFilename(csvPath) {
  const filename = path.basename(csvPath).toLowerCase();
  const match = filename.match(/^(student|teacher|admin)\.csv$/);
  return match ? allowedRoles.get(match[1]) : null;
}

async function importRecords(csvPaths) {
  const files = Array.isArray(csvPaths) ? csvPaths : [csvPaths];
  if (files.length === 0 || files.some((file) => !file)) {
    throw new Error('Provide at least one CSV file.');
  }

  const records = files.flatMap((csvPath) => {
    const absolutePath = path.resolve(csvPath);
    if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) {
      throw new Error('A CSV file was not found.');
    }

    return parseCsv(
      fs.readFileSync(absolutePath, 'utf8'),
      inferRoleFromFilename(absolutePath),
    );
  });
  const { normalizedRecords, errors } = validateRecords(records);
  if (errors.length > 0) {
    throw new Error(`CSV validation failed:\n${errors.join('\n')}`);
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    for (const record of normalizedRecords) {
      await client.query(
        `INSERT INTO authorized_records
           (role, full_name, usn_or_employee_id, college_email, branch, semester, section, department)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          record.role,
          record.fullName,
          record.employeeId,
          record.email,
          record.branch,
          record.semester,
          record.section,
          record.department,
        ],
      );
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    if (error.code === '23505') {
      throw new Error('A record conflicts with an existing email or ID. No records were imported.');
    }
    throw new Error(`Database import failed (${error.code || 'unknown error'}). No records were imported.`);
  } finally {
    client.release();
  }

  return normalizedRecords.length;
}

if (require.main === module) {
  const csvPaths = process.argv.slice(2);
  if (csvPaths.length === 0) {
    console.error('Usage: node import-authorized-records.js <path-to-csv> [path-to-csv ...]');
    process.exitCode = 1;
    db.pool.end();
  } else {
    importRecords(csvPaths)
      .then(async (count) => {
        console.log(`Imported ${count} authorized records.`);
        await db.pool.end();
      })
      .catch(async (error) => {
        console.error(error.message);
        await db.pool.end();
        process.exitCode = 1;
      });
  }
}

module.exports = { importRecords, inferRoleFromFilename, parseCsv, validateRecords };
