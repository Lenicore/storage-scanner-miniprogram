const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

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

    const recordData = {
      code_value: codeValue,
      code_type: codeType,
      category_id: categoryId,
      category_name: categoryName,
      user_id: openid,
      created_at: now,
      status: 'pending'
    };

    const result = await db.collection('scan_records').add({
      data: recordData
    });

    return {
      success: true,
      id: result._id,
      data: recordData
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
