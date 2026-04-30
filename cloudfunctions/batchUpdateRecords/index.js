const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;

function normalizeRecordIds(recordIds) {
  const source = Array.isArray(recordIds) ? recordIds : [];
  const result = [];
  const idMap = {};
  let index = 0;

  for (index = 0; index < source.length; index += 1) {
    const item = source[index];

    if (typeof item !== 'string' || !item || idMap[item]) {
      continue;
    }

    idMap[item] = true;
    result.push(item);
  }

  return result;
}

function chunkArray(list, size) {
  const result = [];
  let index = 0;

  for (index = 0; index < list.length; index += size) {
    result.push(list.slice(index, index + size));
  }

  return result;
}

function getActionConfig(action) {
  if (action === 'mark') {
    return {
      fromStatus: 'pending',
      toStatus: 'marked',
      logAction: 'BATCH_MARK_RECORD',
      errorMessage: '仅未处理记录可批量标记'
    };
  }

  if (action === 'undo') {
    return {
      fromStatus: 'marked',
      toStatus: 'pending',
      logAction: 'BATCH_UNDO_MARK_RECORD',
      errorMessage: '仅已标记记录可批量撤回'
    };
  }

  if (action === 'archive') {
    return {
      fromStatus: 'marked',
      toStatus: 'archived',
      logAction: 'BATCH_ARCHIVE_RECORD',
      errorMessage: '仅已标记记录可批量归档'
    };
  }

  return null;
}

async function getOwnedRecords(openid, recordIds) {
  const chunks = chunkArray(recordIds, 100);
  const records = [];
  let index = 0;

  for (index = 0; index < chunks.length; index += 1) {
    const result = await db.collection('scan_records')
      .where({
        _id: _.in(chunks[index]),
        user_id: openid
      })
      .get();

    if (result.data && result.data.length) {
      records.push.apply(records, result.data);
    }
  }

  return records;
}

exports.main = async (event) => {
  try {
    const wxContext = cloud.getWXContext();
    const openid = wxContext.OPENID || '';
    const recordIds = normalizeRecordIds(event.record_ids);
    const action = event.action || '';
    const actionConfig = getActionConfig(action);
    const now = new Date();
    let successCount = 0;
    let failedCount = 0;
    let index = 0;

    if (!openid) {
      return {
        success: false,
        error: 'OPENID_REQUIRED',
        message: '用户信息获取失败',
        success_count: 0,
        failed_count: recordIds.length
      };
    }

    if (!actionConfig) {
      return {
        success: false,
        error: 'INVALID_ACTION',
        message: '不支持的批量操作',
        success_count: 0,
        failed_count: recordIds.length
      };
    }

    if (!recordIds.length) {
      return {
        success: false,
        error: 'RECORD_IDS_REQUIRED',
        message: 'record_ids 不能为空',
        success_count: 0,
        failed_count: 0
      };
    }

    const records = await getOwnedRecords(openid, recordIds);
    const recordMap = {};

    for (index = 0; index < records.length; index += 1) {
      recordMap[records[index]._id] = records[index];
    }

    for (index = 0; index < recordIds.length; index += 1) {
      const recordId = recordIds[index];
      const record = recordMap[recordId];

      if (!record) {
        failedCount += 1;
        continue;
      }

      if (record.status !== actionConfig.fromStatus) {
        failedCount += 1;
        continue;
      }

      await db.collection('scan_records')
        .doc(recordId)
        .update({
          data: {
            status: actionConfig.toStatus,
            updated_at: now
          }
        });

      await db.collection('operation_logs').add({
        data: {
          user_id: openid,
          record_id: recordId,
          action: actionConfig.logAction,
          from_status: actionConfig.fromStatus,
          to_status: actionConfig.toStatus,
          created_at: now
        }
      });

      successCount += 1;
    }

    return {
      success: true,
      action: action,
      success_count: successCount,
      failed_count: failedCount,
      total_count: recordIds.length
    };
  } catch (error) {
    console.error('batch update records failed:', error);

    return {
      success: false,
      error: 'BATCH_UPDATE_RECORDS_ERROR',
      message: '批量处理失败',
      success_count: 0,
      failed_count: 0
    };
  }
};
