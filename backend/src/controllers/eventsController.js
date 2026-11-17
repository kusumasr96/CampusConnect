const db = require('../db');
const { uploadBuffer, deleteAsset } = require('../utils/cloudinary');

const eventTypes = new Set(['Technical', 'Cultural', 'Workshop', 'Notice']);
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

const isValidDate = (date) => {
  if (typeof date !== 'string' || !datePattern.test(date)) return false;
  const parsedDate = new Date(`${date}T00:00:00.000Z`);
  return !Number.isNaN(parsedDate.getTime()) && parsedDate.toISOString().slice(0, 10) === date;
};

exports.createEvent = async (req, res) => {
  const {
    title,
    type,
    description,
    date,
    startTime,
    endTime,
    venue,
    registrationLink
  } = req.body;
  if (typeof title !== 'string' || !title.trim() || title.trim().length > 150) {
    return res.status(400).json({ error: 'Title must contain 1 to 150 characters' });
  }
  if (!eventTypes.has(type)) {
    return res.status(400).json({ error: 'Select a valid event type' });
  }
  if (description !== undefined && (typeof description !== 'string' || description.length > 5000)) {
    return res.status(400).json({ error: 'Description must be 5,000 characters or fewer' });
  }
  if (!isValidDate(date) || !timePattern.test(startTime || '') || !timePattern.test(endTime || '') ||
      startTime >= endTime) {
    return res.status(400).json({ error: 'Provide a valid event date and time range' });
  }
  if (typeof venue !== 'string' || !venue.trim() || venue.trim().length > 100) {
    return res.status(400).json({ error: 'Venue must contain 1 to 100 characters' });
  }
  if (registrationLink) {
    try {
      const link = new URL(registrationLink);
      if (!['http:', 'https:'].includes(link.protocol)) throw new Error('Unsupported protocol');
    } catch {
      return res.status(400).json({ error: 'Registration link must be a valid HTTP or HTTPS URL' });
    }
  }
  if (!req.file || req.file.mimetype !== 'application/pdf' ||
      req.file.buffer.subarray(0, 5).toString('ascii') !== '%PDF-') {
    return res.status(400).json({ error: 'Upload a valid PDF brochure' });
  }

  let uploadedAsset;
  try {
    uploadedAsset = await uploadBuffer(req.file, 'campusconnect/events', 'raw');
    const result = await db.query(
      `INSERT INTO events
         (title, type, date, start_time, end_time, venue, description,
          registration_link, brochure_url, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id, title, type, date, start_time, end_time, venue, description,
                 registration_link, brochure_url, created_by, created_at`,
      [
        title.trim(),
        type,
        date,
        startTime,
        endTime,
        venue.trim(),
        description ? description.trim() : null,
        registrationLink ? registrationLink.trim() : null,
        uploadedAsset.secure_url,
        req.user.id
      ]
    );
    return res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create Event Error:', error);
    if (uploadedAsset) {
      try {
        await deleteAsset(uploadedAsset, 'raw');
      } catch (cleanupError) {
        console.error('Failed to clean up uploaded event brochure:', cleanupError);
      }
    }
    return res.status(500).json({ error: 'Failed to create event' });
  }
};

exports.getEvents = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT e.id, e.title, e.type, e.date, e.start_time, e.end_time, e.venue,
              e.description, e.registration_link, e.brochure_url, e.created_at,
              u.username AS creator_username
       FROM events e
       LEFT JOIN users u ON u.id = e.created_by
       ORDER BY e.date, e.start_time, e.created_at DESC`
    );
    return res.json(result.rows);
  } catch (error) {
    console.error('Event List Error:', error);
    return res.status(500).json({ error: 'Failed to fetch events' });
  }
};
