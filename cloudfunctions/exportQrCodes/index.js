const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

function normalizeDate(value) {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return value;
  }

  if (value && typeof value === 'object') {
    if (typeof value.toDate === 'function') {
      return value.toDate();
    }

    if (typeof value.seconds === 'number') {
      return new Date(value.seconds * 1000);
    }

    if (value.$date) {
      return new Date(value.$date);
    }
  }

  return new Date(value);
}

function parseDateFilter(input) {
  const value = (input || '').trim();
  let year = 0;
  let month = 0;
  let day = 0;
  let startDate = null;
  let endDate = null;

  if (!/^\d{8}$/.test(value)) {
    return null;
  }

  year = Number(value.slice(0, 4));
  month = Number(value.slice(4, 6));
  day = Number(value.slice(6, 8));
  startDate = new Date(year, month - 1, day, 0, 0, 0, 0);
  endDate = new Date(year, month - 1, day, 23, 59, 59, 999);

  if (
    startDate.getFullYear() !== year ||
    startDate.getMonth() !== month - 1 ||
    startDate.getDate() !== day
  ) {
    return null;
  }

  return {
    startMs: startDate.getTime(),
    endMs: endDate.getTime()
  };
}

function isSameDate(recordCreatedAt, parsedDate) {
  const date = normalizeDate(recordCreatedAt);
  let createdAtMs = 0;

  if (!parsedDate) {
    return true;
  }

  if (!date || isNaN(date.getTime())) {
    return false;
  }

  createdAtMs = date.getTime();

  return createdAtMs >= parsedDate.startMs && createdAtMs <= parsedDate.endMs;
}

async function getCurrentUser(openid) {
  const userResult = await db.collection('users')
    .where({
      openid: openid
    })
    .limit(1)
    .get();

  if (!userResult.data || !userResult.data.length) {
    return null;
  }

  return userResult.data[0];
}

exports.main = async (event) => {
  try {
    const wxContext = cloud.getWXContext();
    const openid = wxContext.OPENID || '';
    const statusFilter = event && event.status_filter ? event.status_filter : 'all';
    const categoryFilter = event && event.category_filter ? event.category_filter : 'all';
    const currentCategoryId = event && event.current_category_id ? event.current_category_id : '';
    const userKeyword = event && event.user_keyword ? event.user_keyword.trim() : '';
    const parsedDate = parseDateFilter(event && event.date_input ? event.date_input : '');
    const limitValue = Number(event && event.limit);
    const limit = limitValue > 0 ? limitValue : 100;
    const currentUser = await getCurrentUser(openid);
    let list = [];
    const resultRecords = [];
    const qrFileIds = [];
    let index = 0;

    if (!openid) {
      return {
        success: false,
        code: 'OPENID_REQUIRED',
        message: '用户信息获取失败',
        qr_file_ids: [],
        records: []
      };
    }

    if (!currentUser || currentUser.role !== 'admin') {
      return {
        success: false,
        code: 'FORBIDDEN',
        message: '仅管理员可导出二维码',
        qr_file_ids: [],
        records: []
      };
    }

    list = (await db.collection('scan_records')
      .orderBy('created_at', 'desc')
      .limit(limit)
      .get()).data || [];

    for (index = 0; index < list.length; index += 1) {
      const item = list[index];
      let matched = true;
      const userText = `${item.user_id || ''} ${item.user_name || ''}`;

      if (matched && statusFilter !== 'all' && item.status !== statusFilter) {
        matched = false;
      }

      if (matched && categoryFilter !== 'all' && item.category_id !== categoryFilter) {
        matched = false;
      }

      if (matched && currentCategoryId && item.category_id !== currentCategoryId) {
        matched = false;
      }

      if (matched && userKeyword && userText.indexOf(userKeyword) === -1) {
        matched = false;
      }

      if (matched && !isSameDate(item.created_at, parsedDate)) {
        matched = false;
      }

      if (matched) {
        resultRecords.push({
          _id: item._id || '',
          code_value: item.code_value || '',
          category_id: item.category_id || '',
          category_name: item.category_name || '',
          status: item.status || 'pending',
          user_id: item.user_id || '',
          user_name: item.user_name || '',
          qr_file_id: item.qr_file_id || '',
          created_at: item.created_at || null
        });

        if (item.qr_file_id) {
          qrFileIds.push(item.qr_file_id);
        }
      }
    }

    return {
      success: true,
      qr_file_ids: qrFileIds,
      records: resultRecords
    };
  } catch (error) {
    console.error('export qr codes failed:', error);

    return {
      success: false,
      code: 'EXPORT_QR_CODES_ERROR',
      message: '导出二维码失败',
      qr_file_ids: [],
      records: []
    };
  }
};
