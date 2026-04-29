const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const BATCH_EXPIRE_MS = 30 * 60 * 1000;

function normalizeDate(value) {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return value;
  }

  return new Date(value);
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

    const latestBatchResult = await db.collection('batches')
      .where({
        category_id: categoryId,
        created_by: openid
      })
      .orderBy('created_at', 'desc')
      .limit(1)
      .get();

    let currentBatch = null;
    const latestBatch = latestBatchResult.data && latestBatchResult.data.length
      ? latestBatchResult.data[0]
      : null;
    const latestBatchTime = latestBatch ? normalizeDate(latestBatch.created_at) : null;

    if (latestBatch && latestBatchTime && now.getTime() - latestBatchTime.getTime() < BATCH_EXPIRE_MS) {
      currentBatch = latestBatch;
    } else {
      const batchData = {
        category_id: categoryId,
        category_name: categoryName,
        created_by: openid,
        created_at: now
      };
      const batchResult = await db.collection('batches').add({
        data: batchData
      });

      currentBatch = {
        _id: batchResult._id,
        category_id: categoryId,
        category_name: categoryName,
        created_by: openid,
        created_at: now
      };
    }

    const batchTime = normalizeDate(currentBatch.created_at) || now;
    const recordData = {
      code_value: codeValue,
      code_type: codeType,
      category_id: categoryId,
      category_name: categoryName,
      user_id: openid,
      batch_id: currentBatch._id,
      batch_time: batchTime,
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
      batch: {
        _id: currentBatch._id,
        created_at: batchTime
      }
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
