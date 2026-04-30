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

    if (record.status !== 'marked') {
      return {
        success: false,
        error: 'INVALID_STATUS_TRANSITION',
        message: '仅已标记记录可归档'
      };
    }

    await db.collection('scan_records')
      .doc(recordId)
      .update({
        data: {
          status: 'archived',
          updated_at: now
        }
      });

    await db.collection('operation_logs').add({
      data: {
        user_id: openid,
        record_id: recordId,
        action: 'ARCHIVE_RECORD',
        from_status: 'marked',
        to_status: 'archived',
        created_at: now
      }
    });

    return {
      success: true,
      record_id: recordId,
      status: 'archived'
    };
  } catch (error) {
    console.error('archive record failed:', error);

    return {
      success: false,
      error: 'ARCHIVE_RECORD_ERROR',
      message: '归档记录失败'
    };
  }
};
