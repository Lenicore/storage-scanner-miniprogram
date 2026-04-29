const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

exports.main = async () => {
  try {
    const wxContext = cloud.getWXContext();
    const openid = wxContext.OPENID || '';

    if (!openid) {
      return {
        success: false,
        error: 'OPENID_REQUIRED',
        message: '用户信息获取失败',
        records: []
      };
    }

    const result = await db.collection('scan_records')
      .where({
        user_id: openid
      })
      .orderBy('created_at', 'desc')
      .limit(100)
      .get();

    return {
      success: true,
      records: result.data || []
    };
  } catch (error) {
    console.error('get user scan records failed:', error);

    return {
      success: false,
      error: 'GET_SCAN_RECORDS_ERROR',
      message: '获取扫码记录失败',
      records: []
    };
  }
};
