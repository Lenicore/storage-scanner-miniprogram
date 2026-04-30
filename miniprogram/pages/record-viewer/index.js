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

function shouldShowCodeValue(codeType) {
  const value = codeType || '';

  if (value === 'QR_CODE' || value === 'QR' || value === '二维码') {
    return false;
  }

  return true;
}

function formatStatusText(status) {
  const value = status || 'pending';

  if (value === 'marked') {
    return '已标记';
  }

  if (value === 'archived') {
    return '已归档';
  }

  return '未处理';
}

function formatStatusClassName(status) {
  const value = status || 'pending';

  if (value === 'marked') {
    return 'status-marked';
  }

  if (value === 'archived') {
    return 'status-archived';
  }

  return 'status-pending';
}

function formatCloudRecord(record) {
  const createdAt = normalizeDate(record.created_at) || new Date();
  const rawName = record.category_name || '';
  const trimmed = typeof rawName === 'string' ? rawName.trim() : '';
  const categoryName = trimmed ? trimmed : '未分类';
  const categoryId = record.category_id || '';
  const codeType = record.code_type || 'BAR_CODE';
  const status = record.status || 'pending';

  return {
    id: record._id || `${Date.now()}`,
    codeValue: record.code_value || '',
    codeType: codeType,
    showCodeValue: shouldShowCodeValue(codeType),
    codeTypeText: formatCodeTypeText(codeType),
    categoryId: categoryId,
    categoryName: categoryName,
    status: status,
    statusText: formatStatusText(status),
    statusClassName: formatStatusClassName(status),
    qrFileId: record.qr_file_id || '',
    scanTime: formatSecondTime(createdAt),
    createdAtMs: createdAt.getTime()
  };
}

function getCurrentRecord(records, index) {
  if (!records.length) {
    return null;
  }

  if (index < 0 || index >= records.length) {
    return records[0];
  }

  return records[index];
}

function sortRecordsByTimeDesc(records) {
  return records.slice().sort(function (a, b) {
    return b.createdAtMs - a.createdAtMs;
  });
}

Page({
  data: {
    records: [],
    currentIndex: 0,
    currentRecord: null,
    categoryId: '',
    categoryName: '',
    recordId: '',
    totalCount: 0,
    isLoading: false,
    isProcessing: false,
    processingAction: ''
  },

  onLoad: function (options) {
    this.setData({
      categoryId: options.category_id || '',
      recordId: options.record_id || ''
    });

    this.fetchViewerRecords();
  },

  updateCurrentRecord: function (index) {
    const currentRecord = getCurrentRecord(this.data.records, index);

    this.setData({
      currentIndex: index,
      currentRecord: currentRecord,
      categoryName: currentRecord ? currentRecord.categoryName : ''
    });
  },

  fetchViewerRecords: function () {
    if (this.data.isLoading) {
      return Promise.resolve([]);
    }

    this.setData({
      isLoading: true
    });

    return wx.cloud.callFunction({
      name: 'getUserScanRecords'
    }).then((res) => {
      const result = res.result || {};
      const list = result.records || [];
      const categoryId = this.data.categoryId;
      const records = [];
      let currentIndex = 0;
      let index = 0;

      if (result.success === false) {
        wx.showToast({
          title: result.message || '记录加载失败',
          icon: 'none'
        });
      }

      for (index = 0; index < list.length; index += 1) {
        if ((list[index].category_id || '') === categoryId) {
          records.push(formatCloudRecord(list[index]));
        }
      }

      const sortedRecords = sortRecordsByTimeDesc(records);

      for (index = 0; index < sortedRecords.length; index += 1) {
        if (sortedRecords[index].id === this.data.recordId) {
          currentIndex = index;
          break;
        }
      }

      this.setData({
        records: sortedRecords,
        totalCount: sortedRecords.length
      });

      this.updateCurrentRecord(currentIndex);
      return sortedRecords;
    }).catch((error) => {
      console.error('fetch viewer records failed:', error);
      wx.showToast({
        title: '记录加载失败',
        icon: 'none'
      });
      return [];
    }).finally(() => {
      this.setData({
        isLoading: false
      });
    });
  },

  handleSwiperChange: function (event) {
    const current = event.detail.current || 0;

    this.updateCurrentRecord(current);
  },

  confirmCurrentRecordAction: function (options) {
    const currentRecord = this.data.currentRecord;
    const title = options.title || '确认操作';
    const content = currentRecord ? `${options.content}\n${currentRecord.codeValue}` : options.content;

    if (!currentRecord || this.data.isProcessing) {
      return;
    }

    wx.showModal({
      title: title,
      content: content,
      success: (res) => {
        if (!res.confirm) {
          return;
        }

        this.runCurrentRecordAction(options);
      }
    });
  },

  runCurrentRecordAction: function (options) {
    const currentRecord = this.data.currentRecord;
    const currentIndex = this.data.currentIndex;

    if (!currentRecord || this.data.isProcessing) {
      return Promise.resolve(false);
    }

    this.setData({
      isProcessing: true,
      processingAction: options.functionName || ''
    });

    wx.showLoading({
      title: options.loadingText || '处理中',
      mask: true
    });

    return wx.cloud.callFunction({
      name: options.functionName,
      data: {
        record_id: currentRecord.id
      }
    }).then((res) => {
      const result = res.result || {};
      const records = this.data.records.slice();
      let nextStatus = currentRecord.status;

      if (!result.success) {
        wx.showToast({
          title: result.message || '操作失败',
          icon: 'none'
        });
        return false;
      }

      if (options.functionName === 'markRecord') {
        nextStatus = 'marked';
      } else if (options.functionName === 'undoMarkRecord') {
        nextStatus = 'pending';
      } else if (options.functionName === 'archiveRecord') {
        nextStatus = 'archived';
      }

      records[currentIndex] = {
        id: currentRecord.id,
        codeValue: currentRecord.codeValue,
        codeType: currentRecord.codeType,
        showCodeValue: currentRecord.showCodeValue,
        codeTypeText: currentRecord.codeTypeText,
        categoryId: currentRecord.categoryId,
        categoryName: currentRecord.categoryName,
        status: nextStatus,
        statusText: formatStatusText(nextStatus),
        statusClassName: formatStatusClassName(nextStatus),
        qrFileId: currentRecord.qrFileId,
        scanTime: currentRecord.scanTime,
        createdAtMs: currentRecord.createdAtMs
      };

      this.setData({
        records: records
      });
      this.updateCurrentRecord(currentIndex);

      wx.showToast({
        title: options.successText || '操作成功',
        icon: 'success'
      });
      return true;
    }).catch((error) => {
      console.error('viewer action failed:', error);
      wx.showToast({
        title: '操作失败',
        icon: 'none'
      });
      return false;
    }).finally(() => {
      wx.hideLoading();
      this.setData({
        isProcessing: false,
        processingAction: ''
      });
    });
  },

  handleMarkRecord: function () {
    this.confirmCurrentRecordAction({
      functionName: 'markRecord',
      title: '确认标记',
      content: '确认将当前记录标记为已标记？',
      loadingText: '标记中',
      successText: '标记成功'
    });
  },

  handleUndoMarkRecord: function () {
    this.confirmCurrentRecordAction({
      functionName: 'undoMarkRecord',
      title: '确认撤回',
      content: '确认撤回当前记录的标记？',
      loadingText: '撤回中',
      successText: '撤回成功'
    });
  },

  handleArchiveRecord: function () {
    this.confirmCurrentRecordAction({
      functionName: 'archiveRecord',
      title: '确认归档',
      content: '确认归档当前记录？',
      loadingText: '归档中',
      successText: '归档成功'
    });
  }
});
