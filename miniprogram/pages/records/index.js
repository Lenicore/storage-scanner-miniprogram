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

function normalizeDate(value) {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return value;
  }

  return new Date(value);
}

function formatCodeTypeText(codeType) {
  const value = codeType || '';

  if (value === 'QR_CODE' || value === 'QR') {
    return '二维码';
  }

  if (value === 'BAR_CODE' || value === 'BAR') {
    return '条形码';
  }

  return '其他';
}

function formatCloudRecord(record) {
  const createdAt = normalizeDate(record.created_at) || new Date();
  const rawName = record.category_name || '';
  const trimmed = typeof rawName === 'string' ? rawName.trim() : '';
  const categoryName = trimmed ? trimmed : '未分类';
  const codeType = record.code_type || 'BAR_CODE';

  return {
    id: record._id || `${Date.now()}`,
    groupKey: categoryName,
    codeValue: record.code_value || '',
    codeType: codeType,
    codeTypeText: formatCodeTypeText(codeType),
    categoryName: categoryName,
    scanTime: formatSecondTime(createdAt),
    createdAtMs: createdAt.getTime()
  };
}

function sortRecordsByTimeDesc(items) {
  return items.slice().sort(function (a, b) {
    return b.createdAtMs - a.createdAtMs;
  });
}

function groupRecordsByCategoryName(records) {
  const groupMap = {};
  const groups = [];
  let index = 0;
  let gi = 0;

  for (index = 0; index < records.length; index += 1) {
    const item = records[index];
    const key = item.groupKey || item.categoryName || '未分类';
    let group = groupMap[key];

    if (!group) {
      group = {
        id: key,
        categoryName: item.categoryName || '未分类',
        count: 0,
        latestMs: 0,
        items: []
      };
      groupMap[key] = group;
      groups.push(group);
    }

    group.items.push(item);
    group.count += 1;

    if (item.createdAtMs > group.latestMs) {
      group.latestMs = item.createdAtMs;
    }
  }

  for (gi = 0; gi < groups.length; gi += 1) {
    groups[gi].items = sortRecordsByTimeDesc(groups[gi].items);
  }

  groups.sort(function (a, b) {
    return b.latestMs - a.latestMs;
  });

  return groups;
}

Page({
  data: {
    categoryGroups: [],
    isLoadingRecords: false
  },

  onLoad: function () {
  },

  onShow: function () {
    this.initRecords();
  },

  initRecords: function () {
    return this.fetchRecords();
  },

  fetchRecords: function () {
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
      const categoryGroups = groupRecordsByCategoryName(records);

      this.setData({
        categoryGroups: categoryGroups
      });

      return categoryGroups;
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
