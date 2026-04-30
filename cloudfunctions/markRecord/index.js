const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

exports.main = async (event) => {
  try {
    const wxContext = cloud.getWXContext();
    const openid = wxContext.OPENID || '';
    const recordId = event.record_id || '';
    const now = new Date();

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

    const recordResult = await db.collection('scan_records')
      .where({
        _id: recordId,
        user_id: openid
      })
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

    if (record.status !== 'pending') {
      return {
        success: false,
        error: 'INVALID_STATUS_TRANSITION',
        message: '仅未处理记录可标记'
      };
    }

    await db.collection('scan_records')
      .doc(recordId)
      .update({
        data: {
          status: 'marked',
          updated_at: now
        }
      });

    await db.collection('operation_logs').add({
      data: {
        user_id: openid,
        record_id: recordId,
        action: 'MARK_RECORD',
        from_status: 'pending',
        to_status: 'marked',
        created_at: now
      }
    });

    return {
      success: true,
      record_id: recordId,
      status: 'marked'
    };
  } catch (error) {
    console.error('mark record failed:', error);

    return {
      success: false,
      error: 'MARK_RECORD_ERROR',
      message: '标记记录失败'
    };
  }
};
