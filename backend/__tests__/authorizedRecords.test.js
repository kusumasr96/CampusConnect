const {
  inferRoleFromFilename,
  parseCsv,
  validateRecords,
} = require('../import-authorized-records');

describe('authorized record CSV import', () => {
  test('parses and normalizes a valid roster row', () => {
    const records = parseCsv(
      'role,full_name,usn_or_employee_id,college_email,branch,semester,section,department\n' +
      'student,Example Student,STU-001,Student@Example.edu,Computing,2,A,',
    );
    const { normalizedRecords, errors } = validateRecords(records);

    expect(errors).toEqual([]);
    expect(normalizedRecords).toEqual([{
      role: 'Student',
      fullName: 'Example Student',
      employeeId: 'STU-001',
      email: 'student@example.edu',
      branch: 'Computing',
      semester: 2,
      section: 'A',
      department: null,
    }]);
  });

  test('accepts a syntactically valid Gmail address', () => {
    const records = parseCsv(
      'role,full_name,usn_or_employee_id,college_email\n' +
      'Student,Example Student,STU-001,student@gmail.com',
    );

    expect(validateRecords(records).errors).toEqual([]);
  });

  test('maps name/email headers and infers role from a role-specific CSV filename', () => {
    const records = parseCsv(
      'name,email,usn_or_employee_id\nExample Student,student@example.edu,STU-001',
      inferRoleFromFilename('student.csv'),
    );
    const { normalizedRecords, errors } = validateRecords(records);

    expect(errors).toEqual([]);
    expect(normalizedRecords[0]).toMatchObject({
      role: 'Student',
      fullName: 'Example Student',
      employeeId: 'STU-001',
      email: 'student@example.edu',
    });
  });

  test('rejects a role that does not match its role-specific CSV filename', () => {
    const records = parseCsv(
      'role,name,email,usn_or_employee_id\nTeacher,Example Student,student@example.edu,STU-001',
      inferRoleFromFilename('student.csv'),
    );

    expect(validateRecords(records).errors).toEqual([
      'Line 2: invalid role does not match filename.',
    ]);
  });

  test('rejects missing required headers', () => {
    expect(() => parseCsv('full_name,college_email\nExample,student@example.edu'))
      .toThrow('CSV is missing required headers');
  });

  test('reports invalid rows without including the submitted values', () => {
    const records = parseCsv(
      'role,full_name,usn_or_employee_id,college_email\n' +
      'Visitor,Example Student,STU-001,not-an-email',
    );
    const { normalizedRecords, errors } = validateRecords(records);

    expect(normalizedRecords).toEqual([]);
    expect(errors).toEqual(['Line 2: invalid role, college_email.']);
  });

  test('rejects duplicate email addresses in the same CSV regardless of case', () => {
    const records = parseCsv(
      'role,full_name,usn_or_employee_id,college_email\n' +
      'Student,First Student,STU-001,student@example.edu\n' +
      'Student,Second Student,STU-002,STUDENT@example.edu',
    );
    const { normalizedRecords, errors } = validateRecords(records);

    expect(normalizedRecords).toHaveLength(1);
    expect(errors).toEqual(['Line 3: invalid duplicate college_email.']);
  });
});
