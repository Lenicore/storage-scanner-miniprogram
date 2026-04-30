const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

async function getCurrentUserRole(openid) {
  const userResult = await db.collection('users')
    .where({
      openid: openid
    })
    .limit(1)
    .get();

  if (!userResult.data || !userResult.data.length) {
    return 'user';
  }

  return userResult.data[0].role || 'user';
}

exports.main = async (event) => {
  try {
    const wxContext = cloud.getWXContext();
    const openid = wxContext.OPENID || '';
    const recordId = event.record_id || '';
    const now = new Date();
    const role = await getCurrentUserRole(openid);
    const recordQuery = {
      _id: recordId
    };

    if (!openid) {
      return {
        success: false,
        error: 'OPENID_REQUIRED',
        message: '用户信息获取失败'
      };
    }

    if (!recordId) {
      return {
        success: false,
        error: 'RECORD_ID_REQUIRED',
        message: 'record_id 不能为空'
      };
    }

    if (role !== 'admin') {
      recordQuery.user_id = openid;
    }

    const recordResult = await db.collection('scan_records')
      .where(recordQuery)
      .limit(1)
      .get();

    if (!recordResult.data || !recordResult.data.length) {
      return {
        success: false,
        error: 'RECORD_NOT_FOUND',
        message: '记录不存在或无权限操作'
      };
    }

    const record = recordResult.data[0];

    if (record.status !== 'marked') {
      return {
        success: false,
        error: 'INVALID_STATUS_TRANSITION',
        message: '仅已标记记录可撤回'
      };
    }

    await db.collection('scan_records')
      .doc(recordId)
      .update({
        data: {
          status: 'pending',
          updated_at: now
        }
      });

    await db.collection('operation_logs').add({
      data: {
        user_id: openid,
        record_id: recordId,
        operator_role: role,
        action: 'UNDO_MARK_RECORD',
        from_status: 'marked',
        to_status: 'pending',
        created_at: now
      }
    });

    return {
      success: true,
      record_id: recordId,
      status: 'pending'
    };
  } catch (error) {
    console.error('undo mark record failed:', error);

    return {
      success: false,
      error: 'UNDO_MARK_RECORD_ERROR',
      message: '撤回标记失败'
    };
  }
};
