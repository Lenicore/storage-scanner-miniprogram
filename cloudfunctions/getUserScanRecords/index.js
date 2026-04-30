const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

exports.main = async (event) => {
  try {
    const wxContext = cloud.getWXContext();
    const openid = wxContext.OPENID || '';
    const eventLimit = Number(event && event.limit);
    const limit = eventLimit > 0 ? eventLimit : 100;

    if (!openid) {
      return {
        success: false,
        error: 'OPENID_REQUIRED',
        message: '用户信息获取失败',
        records: [],
        role: 'user',
        is_admin: false
      };
    }

    const userResult = await db.collection('users')
      .where({
        openid: openid
      })
      .limit(1)
      .get();

    const currentUser = userResult.data && userResult.data.length
      ? userResult.data[0]
      : null;
    const role = currentUser && currentUser.role ? currentUser.role : 'user';
    const isAdmin = role === 'admin';
    const recordsQuery = db.collection('scan_records');
    let result;

    if (isAdmin) {
      result = await recordsQuery
        .orderBy('created_at', 'desc')
        .limit(limit)
        .get();
    } else {
      result = await recordsQuery
        .where({
          user_id: openid
        })
        .orderBy('created_at', 'desc')
        .limit(limit)
        .get();
    }

    return {
      success: true,
      records: result.data || [],
      role: role,
      is_admin: isAdmin,
      limit: limit
    };
  } catch (error) {
    console.error('get user scan records failed:', error);

    return {
      success: false,
      error: 'GET_SCAN_RECORDS_ERROR',
      message: '获取扫码记录失败',
      records: [],
      role: 'user',
      is_admin: false
    };
  }
};
