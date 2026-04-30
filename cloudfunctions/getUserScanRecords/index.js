const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

function canViewAllRecords(role) {
  return role === 'admin' || role === 'warehouse';
}

function canOperateRecord(role, recordUserId, openid) {
  if (role === 'admin') {
    return true;
  }

  return recordUserId === openid;
}

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
    const canViewAll = canViewAllRecords(role);
    const recordsQuery = db.collection('scan_records');
    let result;
    let records = [];
    let index = 0;

    if (canViewAll) {
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

    for (index = 0; index < (result.data || []).length; index += 1) {
      const item = result.data[index];

      records.push({
        _id: item._id || '',
        code_value: item.code_value || '',
        code_type: item.code_type || '',
        qr_file_id: item.qr_file_id || '',
        qr_cloud_path: item.qr_cloud_path || '',
        category_id: item.category_id || '',
        category_name: item.category_name || '',
        user_id: item.user_id || '',
        user_name: item.user_name || '',
        user_avatar_url: item.user_avatar_url || '',
        status: item.status || 'pending',
        created_at: item.created_at || null,
        updated_at: item.updated_at || null,
        can_operate: canOperateRecord(role, item.user_id || '', openid)
      });
    }

    return {
      success: true,
      records: records,
      role: role,
      is_admin: isAdmin,
      can_view_all: canViewAll,
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
      is_admin: false,
      can_view_all: false
    };
  }
};
