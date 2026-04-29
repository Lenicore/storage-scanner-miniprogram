function padNumber(value) {
  return value < 10 ? `0${value}` : `${value}`;
}

function formatSecondTime(date) {
  const year = date.getFullYear();
  const month = padNumber(date.getMonth() + 1);
  const day = padNumber(date.getDate());
  const hour = padNumber(date.getHours());
  const minute = padNumber(date.getMinutes());
  const second = padNumber(date.getSeconds());

  return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}

function formatMinuteTime(date) {
  const year = date.getFullYear();
  const month = padNumber(date.getMonth() + 1);
  const day = padNumber(date.getDate());
  const hour = padNumber(date.getHours());
  const minute = padNumber(date.getMinutes());

  return `${year}-${month}-${day} ${hour}:${minute}`;
}

function normalizeDate(value) {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return value;
  }

  return new Date(value);
}

function formatCloudRecord(record) {
  const createdAt = normalizeDate(record.created_at) || new Date();
  const batchTime = normalizeDate(record.batch_time) || createdAt;
  const batchId = record.batch_id || '';
  const fallbackBatchKey = formatMinuteTime(batchTime);

  return {
    id: record._id || `${Date.now()}`,
    batchId: batchId,
    batchKey: batchId || fallbackBatchKey,
    batchTitle: formatMinuteTime(batchTime),
    codeValue: record.code_value || '',
    codeType: record.code_type || 'BAR_CODE',
    categoryName: record.category_name || '未分类',
    scanTime: formatSecondTime(createdAt),
    status: record.status || 'pending'
  };
}

function groupRecordsByBatch(records) {
  const groupMap = {};
  const groups = [];
  let index = 0;

  for (index = 0; index < records.length; index += 1) {
    const item = records[index];
    const key = item.batchKey || item.id;
    let group = groupMap[key];

    if (!group) {
      group = {
        id: key,
        title: item.batchTitle,
        items: []
      };
      groupMap[key] = group;
      groups.push(group);
    }

    group.items.push(item);
  }

  return groups;
}

Page({
  data: {
    batchGroups: [],
    isLoadingRecords: false
  },

  onLoad: function () {
  },

  onShow: function () {
    this.initRecords();
  },

  initRecords: async function () {
    return this.fetchRecords();
  },

  fetchRecords: async function () {
    if (this.data.isLoadingRecords) {
      return Promise.resolve([]);
    }

    this.setData({
      isLoadingRecords: true
    });

    return wx.cloud.callFunction({
      name: 'getUserScanRecords'
    }).then((res) => {
      const result = res.result || {};
      const list = result.records || [];

      if (result.success === false) {
        wx.showToast({
          title: result.message || '记录加载失败',
          icon: 'none'
        });
      }

      const records = list.map((item) => formatCloudRecord(item));
      const batchGroups = groupRecordsByBatch(records);

      this.setData({
        batchGroups: batchGroups
      });

      return batchGroups;
    }).catch((error) => {
      console.error('fetch records failed:', error);
      wx.showToast({
        title: '记录加载失败',
        icon: 'none'
      });
      return [];
    }).finally(() => {
      this.setData({
        isLoadingRecords: false
      });
    });
  }
});
