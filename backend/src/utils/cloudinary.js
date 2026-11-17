const { randomUUID } = require('crypto');
const { v2: cloudinary } = require('cloudinary');

const configureCloudinary = () => {
  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    throw new Error('Cloudinary upload is not configured');
  }

  cloudinary.config({
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key: CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET
  });
};

const uploadBuffer = (file, folder, resourceType) => new Promise((resolve, reject) => {
  try {
    configureCloudinary();
  } catch (error) {
    reject(error);
    return;
  }

  cloudinary.uploader.upload_stream({
    folder,
    resource_type: resourceType,
    ...(resourceType === 'raw' ? { public_id: `${randomUUID()}.pdf` } : {})
  }, (error, result) => {
    if (error) {
      reject(error);
      return;
    }
    if (!result || !result.secure_url || !result.public_id) {
      reject(new Error('Cloudinary returned an incomplete upload result'));
      return;
    }
    resolve(result);
  }).end(file.buffer);
});

const deleteAsset = (asset, resourceType) => new Promise((resolve, reject) => {
  cloudinary.uploader.destroy(asset.public_id, { resource_type: resourceType }, (error, result) => {
    if (error) {
      reject(error);
      return;
    }
    resolve(result);
  });
});

module.exports = { uploadBuffer, deleteAsset };
