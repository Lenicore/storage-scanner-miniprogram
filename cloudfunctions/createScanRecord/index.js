const cloud = require('wx-server-sdk');
const QRCode = require('qrcode');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

async function createQrAsset(openid, codeValue, now) {
  const timestamp = now.getTime();
  const randomSuffix = Math.floor(Math.random() * 1000000);
  const cloudPath = `scan-qrcodes/${openid}/${timestamp}-${randomSuffix}.png`;
  const fileContent = await QRCode.toBuffer(codeValue, {
    type: 'png',
    width: 360,
    margin: 1
  });
  const uploadResult = await cloud.uploadFile({
    cloudPath: cloudPath,
    fileContent: fileContent
  });

  return {
    qrFileId: uploadResult.fileID || '',
    qrCloudPath: cloudPath
  };
}

async function findDuplicateRecord(openid, categoryId, codeValue) {
  const result = await db.collection('scan_records').where({
    user_id: openid,
    category_id: categoryId,
    code_value: codeValue
  }).limit(1).get();

  if (!result.data || !result.data.length) {
    return null;
  }

  return result.data[0];
}

async function getUserProfile(openid) {
  const result = await db.collection('users').where({
    openid: openid
  }).limit(1).get();

  if (!result.data || !result.data.length) {
    return null;
  }

  return result.data[0];
}

exports.main = async (event) => {
  try {
    const wxContext = cloud.getWXContext();
    const openid = wxContext.OPENID || '';
    const codeValue = event.code_value || '';
    const codeType = event.code_type || 'BAR_CODE';
    const categoryId = event.category_id || '';
    const categoryName = event.category_name || '';
    const now = new Date();

    if (!codeValue) {
      return {
        success: false,
        message: 'code_value is required'
      };
    }

    if (!categoryId || !categoryName) {
      return {
        success: false,
        error: 'CATEGORY_REQUIRED',
        message: '请先选择分类'
      };
    }

    if (!openid) {
      return {
        success: false,
        error: 'OPENID_REQUIRED',
        message: '用户信息获取失败'
      };
    }

    const duplicateRecord = await findDuplicateRecord(openid, categoryId, codeValue);
    const currentUser = await getUserProfile(openid);

    if (duplicateRecord) {
      return {
        success: false,
        code: 'DUPLICATE_CODE',
        message: '该码已存在于当前分类',
        existingRecord: {
          _id: duplicateRecord._id || '',
          code_value: duplicateRecord.code_value || '',
          category_name: duplicateRecord.category_name || categoryName,
          created_at: duplicateRecord.created_at || null,
          status: duplicateRecord.status || 'pending'
        }
      };
    }

    const qrAsset = await createQrAsset(openid, codeValue, now);
    const recordData = {
      code_value: codeValue,
      code_type: codeType,
      qr_file_id: qrAsset.qrFileId,
      qr_cloud_path: qrAsset.qrCloudPath,
      category_id: categoryId,
      category_name: categoryName,
      user_id: openid,
      user_name: currentUser && currentUser.name ? currentUser.name : '未命名用户',
      user_avatar_url: currentUser && currentUser.avatar_url ? currentUser.avatar_url : '',
      updated_at: now,
      created_at: now,
      status: 'pending'
    };

    const result = await db.collection('scan_records').add({
      data: recordData
    });

    return {
      success: true,
      id: result._id,
      data: recordData,
      qr_file_id: qrAsset.qrFileId
    };
  } catch (error) {
    console.error('create scan record failed:', error);

    return {
      success: false,
      error: 'SCAN_RECORD_CREATE_ERROR',
      message: '扫码记录保存失败'
    };
  }
};
