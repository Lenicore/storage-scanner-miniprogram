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

function buildIdLookup(list) {
  const source = Array.isArray(list) ? list : [];
  const result = {};
  let index = 0;

  for (index = 0; index < source.length; index += 1) {
    if (source[index]) {
      result[source[index]] = true;
    }
  }

  return result;
}

function buildCategoryOptions(records) {
  const optionMap = {};
  const result = [{
    id: 'all',
    name: '全部分类'
  }];
  let index = 0;

  for (index = 0; index < records.length; index += 1) {
    const item = records[index];
    const categoryId = item.categoryId || '';
    const categoryName = item.categoryName || '未分类';

    if (!categoryId || optionMap[categoryId]) {
      continue;
    }

    optionMap[categoryId] = true;
    result.push({
      id: categoryId,
      name: categoryName
    });
  }

  return result;
}

function filterRecords(records, filters) {
  const keyword = (filters.keyword || '').trim();
  const userKeyword = (filters.userKeyword || '').trim();
  const statusFilter = filters.statusFilter || 'all';
  const categoryFilter = filters.categoryFilter || 'all';
  const result = [];
  let index = 0;

  for (index = 0; index < records.length; index += 1) {
    const item = records[index];
    let matched = true;

    if (keyword && item.codeValue.indexOf(keyword) === -1) {
      matched = false;
    }

    if (matched && userKeyword) {
      const userText = `${item.userId || ''} ${item.userName || ''}`;

      if (userText.indexOf(userKeyword) === -1) {
        matched = false;
      }
    }

    if (matched && statusFilter !== 'all' && item.status !== statusFilter) {
      matched = false;
    }

    if (matched && categoryFilter !== 'all' && item.categoryId !== categoryFilter) {
      matched = false;
    }

    if (matched) {
      result.push(item);
    }
  }

  return result;
}

function formatCloudRecord(record) {
  const createdAt = normalizeDate(record.created_at) || new Date();
  const rawName = record.category_name || '';
  const trimmed = typeof rawName === 'string' ? rawName.trim() : '';
  const categoryName = trimmed ? trimmed : '未分类';
  const categoryId = record.category_id || '';
  const codeType = record.code_type || 'BAR_CODE';
  const status = record.status || 'pending';
  const userId = record.user_id || '';
  const userName = record.user_name || '';
  const userDisplayName = userName || userId || '未知用户';
  const qrFileId = record.qr_file_id || '';
  const qrCloudPath = record.qr_cloud_path || '';

  return {
    id: record._id || `${Date.now()}`,
    groupKey: categoryName,
    codeValue: record.code_value || '',
    codeType: codeType,
    codeTypeText: formatCodeTypeText(codeType),
    categoryId: categoryId,
    status: status,
    statusText: formatStatusText(status),
    statusClassName: formatStatusClassName(status),
    categoryName: categoryName,
    userId: userId,
    userName: userName,
    userDisplayName: userDisplayName,
    qrFileId: qrFileId,
    qrCloudPath: qrCloudPath,
    scanTime: formatSecondTime(createdAt),
    createdAtMs: createdAt.getTime()
  };
}

function cloneRecordWithSelection(record, isSelected) {
  return {
    id: record.id,
    groupKey: record.groupKey,
    codeValue: record.codeValue,
    codeType: record.codeType,
    codeTypeText: record.codeTypeText,
    categoryId: record.categoryId,
    status: record.status,
    statusText: record.statusText,
    statusClassName: record.statusClassName,
    categoryName: record.categoryName,
    userId: record.userId,
    userName: record.userName,
    userDisplayName: record.userDisplayName,
    qrFileId: record.qrFileId,
    qrCloudPath: record.qrCloudPath,
    scanTime: record.scanTime,
    createdAtMs: record.createdAtMs,
    isSelected: !!isSelected
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

function sanitizeSelectedIds(records, selectedIds) {
  const recordLookup = {};
  const source = Array.isArray(selectedIds) ? selectedIds : [];
  const result = [];
  let index = 0;

  for (index = 0; index < records.length; index += 1) {
    recordLookup[records[index].id] = true;
  }

  for (index = 0; index < source.length; index += 1) {
    if (recordLookup[source[index]]) {
      result.push(source[index]);
    }
  }

  return result;
}

function buildRecordsView(records, selectedIds) {
  const groups = groupRecordsByCategoryName(records);
  const selectedLookup = buildIdLookup(selectedIds);
  const resultGroups = [];
  let selectedCount = 0;
  let selectedPendingCount = 0;
  let selectedMarkedCount = 0;
  let selectedArchivedCount = 0;
  let groupIndex = 0;

  for (groupIndex = 0; groupIndex < groups.length; groupIndex += 1) {
    const group = groups[groupIndex];
    const items = [];
    let selectedInGroupCount = 0;
    let itemIndex = 0;
    let allSelected = group.items.length > 0;

    for (itemIndex = 0; itemIndex < group.items.length; itemIndex += 1) {
      const item = group.items[itemIndex];
      const isSelected = !!selectedLookup[item.id];

      if (isSelected) {
        selectedCount += 1;
        selectedInGroupCount += 1;

        if (item.status === 'pending') {
          selectedPendingCount += 1;
        } else if (item.status === 'marked') {
          selectedMarkedCount += 1;
        } else if (item.status === 'archived') {
          selectedArchivedCount += 1;
        }
      } else {
        allSelected = false;
      }

      items.push(cloneRecordWithSelection(item, isSelected));
    }

    resultGroups.push({
      id: group.id,
      categoryName: group.categoryName,
      count: group.count,
      latestMs: group.latestMs,
      selectedCount: selectedInGroupCount,
      allSelected: allSelected,
      items: items
    });
  }

  return {
    groups: resultGroups,
    selectedCount: selectedCount,
    selectedPendingCount: selectedPendingCount,
    selectedMarkedCount: selectedMarkedCount,
    selectedArchivedCount: selectedArchivedCount
  };
}

function findGroupById(groups, groupId) {
  let index = 0;

  for (index = 0; index < groups.length; index += 1) {
    if (groups[index].id === groupId) {
      return groups[index];
    }
  }

  return null;
}

function getEligibleSelectedRecordIds(records, selectedIds, action) {
  const selectedLookup = buildIdLookup(selectedIds);
  const result = [];
  let expectedStatus = '';
  let index = 0;

  if (action === 'mark') {
    expectedStatus = 'pending';
  } else if (action === 'undo' || action === 'archive') {
    expectedStatus = 'marked';
  }

  if (!expectedStatus) {
    return result;
  }

  for (index = 0; index < records.length; index += 1) {
    if (selectedLookup[records[index].id] && records[index].status === expectedStatus) {
      result.push(records[index].id);
    }
  }

  return result;
}

function getBatchActionConfig(action) {
  if (action === 'mark') {
    return {
      label: '标记',
      modalTitle: '批量标记',
      loadingText: '批量标记中',
      summaryTitle: '批量标记完成'
    };
  }

  if (action === 'undo') {
    return {
      label: '撤回',
      modalTitle: '批量撤回',
      loadingText: '批量撤回中',
      summaryTitle: '批量撤回完成'
    };
  }

  if (action === 'archive') {
    return {
      label: '归档',
      modalTitle: '批量归档',
      loadingText: '批量归档中',
      summaryTitle: '批量归档完成'
    };
  }

  return null;
}

Page({
  data: {
    allRecords: [],
    categoryGroups: [],
    categoryOptions: [{
      id: 'all',
      name: '全部分类'
    }],
    isLoadingRecords: false,
    processingRecordId: '',
    processingAction: '',
    isBatchMode: false,
    selectedRecordIds: [],
    selectedCount: 0,
    selectedPendingCount: 0,
    selectedMarkedCount: 0,
    selectedArchivedCount: 0,
    isBatchProcessing: false,
    batchProcessingAction: '',
    searchKeyword: '',
    userKeyword: '',
    statusFilter: 'all',
    categoryFilter: 'all',
    filteredRecordCount: 0,
    isAdmin: false,
    currentUserRole: 'user'
  },

  onLoad: function () {
  },

  onShow: function () {
    this.initRecords();
  },

  initRecords: function () {
    return this.fetchRecords();
  },

  applyRecordsView: function (records, selectedIds) {
    const categoryOptions = buildCategoryOptions(records);
    const filteredRecords = filterRecords(records, {
      keyword: this.data.searchKeyword,
      userKeyword: this.data.isAdmin ? this.data.userKeyword : '',
      statusFilter: this.data.statusFilter,
      categoryFilter: this.data.categoryFilter
    });
    const safeSelectedIds = sanitizeSelectedIds(filteredRecords, selectedIds);
    const view = buildRecordsView(filteredRecords, safeSelectedIds);

    this.setData({
      allRecords: records,
      categoryOptions: categoryOptions,
      categoryGroups: view.groups,
      selectedRecordIds: safeSelectedIds,
      selectedCount: view.selectedCount,
      selectedPendingCount: view.selectedPendingCount,
      selectedMarkedCount: view.selectedMarkedCount,
      selectedArchivedCount: view.selectedArchivedCount,
      filteredRecordCount: filteredRecords.length
    });
  },

  refreshCurrentView: function () {
    this.applyRecordsView(this.data.allRecords, this.data.selectedRecordIds);
  },

  handleSearchInput: function (event) {
    this.setData({
      searchKeyword: event.detail.value || ''
    });

    this.refreshCurrentView();
  },

  handleClearSearch: function () {
    if (!this.data.searchKeyword) {
      return;
    }

    this.setData({
      searchKeyword: ''
    });

    this.refreshCurrentView();
  },

  handleUserKeywordInput: function (event) {
    this.setData({
      userKeyword: event.detail.value || ''
    });

    this.refreshCurrentView();
  },

  handleClearUserKeyword: function () {
    if (!this.data.userKeyword) {
      return;
    }

    this.setData({
      userKeyword: ''
    });

    this.refreshCurrentView();
  },

  handleChangeStatusFilter: function (event) {
    const status = event.currentTarget.dataset.status || 'all';

    if (status === this.data.statusFilter) {
      return;
    }

    this.setData({
      statusFilter: status
    });

    this.refreshCurrentView();
  },

  handleChangeCategoryFilter: function (event) {
    const categoryId = event.currentTarget.dataset.id || 'all';

    if (categoryId === this.data.categoryFilter) {
      return;
    }

    this.setData({
      categoryFilter: categoryId
    });

    this.refreshCurrentView();
  },

  handleToggleBatchMode: function () {
    const nextBatchMode = !this.data.isBatchMode;

    this.setData({
      isBatchMode: nextBatchMode
    });

    this.applyRecordsView(this.data.allRecords, []);
  },

  handleClearSelection: function () {
    if (!this.data.isBatchMode) {
      return;
    }

    this.applyRecordsView(this.data.allRecords, []);
  },

  handleToggleRecordSelect: function (event) {
    const recordId = event.currentTarget.dataset.id || '';
    const result = this.data.selectedRecordIds.slice();
    let index = 0;
    let foundIndex = -1;

    if (!this.data.isBatchMode || !recordId) {
      return;
    }

    for (index = 0; index < result.length; index += 1) {
      if (result[index] === recordId) {
        foundIndex = index;
        break;
      }
    }

    if (foundIndex > -1) {
      result.splice(foundIndex, 1);
    } else {
      result.push(recordId);
    }

    this.applyRecordsView(this.data.allRecords, result);
  },

  handleToggleCategorySelect: function (event) {
    const groupId = event.currentTarget.dataset.id || '';
    const group = findGroupById(this.data.categoryGroups, groupId);
    const nextSelectedIds = this.data.selectedRecordIds.slice();
    const currentLookup = buildIdLookup(nextSelectedIds);
    let index = 0;

    if (!this.data.isBatchMode || !group) {
      return;
    }

    if (group.allSelected) {
      const nextList = [];

      for (index = 0; index < nextSelectedIds.length; index += 1) {
        let shouldKeep = true;
        let itemIndex = 0;

        for (itemIndex = 0; itemIndex < group.items.length; itemIndex += 1) {
          if (group.items[itemIndex].id === nextSelectedIds[index]) {
            shouldKeep = false;
            break;
          }
        }

        if (shouldKeep) {
          nextList.push(nextSelectedIds[index]);
        }
      }

      this.applyRecordsView(this.data.allRecords, nextList);
      return;
    }

    for (index = 0; index < group.items.length; index += 1) {
      if (!currentLookup[group.items[index].id]) {
        nextSelectedIds.push(group.items[index].id);
      }
    }

    this.applyRecordsView(this.data.allRecords, nextSelectedIds);
  },

  handleBatchAction: function (event) {
    const action = event.currentTarget.dataset.action || '';
    const actionConfig = getBatchActionConfig(action);
    const eligibleIds = getEligibleSelectedRecordIds(this.data.allRecords, this.data.selectedRecordIds, action);
    const selectedCount = this.data.selectedCount;
    const eligibleCount = eligibleIds.length;
    let content = '';

    if (!actionConfig) {
      return;
    }

    if (!eligibleCount) {
      wx.showToast({
        title: '没有可处理记录',
        icon: 'none'
      });
      return;
    }

    content = `确认${actionConfig.label}${eligibleCount}条记录？`;

    if (eligibleCount !== selectedCount) {
      content = `${content}\n当前已选${selectedCount}条，仅处理符合条件的${eligibleCount}条。`;
    }

    wx.showModal({
      title: actionConfig.modalTitle,
      content: content,
      success: (res) => {
        if (!res.confirm) {
          return;
        }

        this.runBatchAction(action, eligibleIds, actionConfig);
      }
    });
  },

  runBatchAction: function (action, recordIds, actionConfig) {
    if (this.data.isBatchProcessing) {
      return Promise.resolve(false);
    }

    this.setData({
      isBatchProcessing: true,
      batchProcessingAction: action
    });

    wx.showLoading({
      title: actionConfig.loadingText,
      mask: true
    });

    return wx.cloud.callFunction({
      name: 'batchUpdateRecords',
      data: {
        record_ids: recordIds,
        action: action
      }
    }).then((res) => {
      const result = res.result || {};

      if (!result.success) {
        wx.showToast({
          title: result.message || '批量处理失败',
          icon: 'none'
        });
        return false;
      }

      return this.fetchRecords([]).then(() => {
        wx.showModal({
          title: actionConfig.summaryTitle,
          content: `成功 ${result.success_count || 0} 条，失败 ${result.failed_count || 0} 条`,
          showCancel: false
        });
        return true;
      });
    }).catch((error) => {
      console.error('batch update records failed:', error);
      wx.showToast({
        title: '批量处理失败',
        icon: 'none'
      });
      return false;
    }).finally(() => {
      wx.hideLoading();
      this.setData({
        isBatchProcessing: false,
        batchProcessingAction: ''
      });
    });
  },

  runRecordAction: function (options) {
    const recordId = options.recordId || '';
    const functionName = options.functionName || '';
    const loadingText = options.loadingText || '处理中';
    const successText = options.successText || '操作成功';

    if (!recordId || !functionName) {
      return Promise.resolve(false);
    }

    if (this.data.processingRecordId) {
      return Promise.resolve(false);
    }

    this.setData({
      processingRecordId: recordId,
      processingAction: functionName
    });

    wx.showLoading({
      title: loadingText,
      mask: true
    });

    return wx.cloud.callFunction({
      name: functionName,
      data: {
        record_id: recordId
      }
    }).then((res) => {
      const result = res.result || {};

      if (!result.success) {
        wx.showToast({
          title: result.message || '操作失败',
          icon: 'none'
        });
        return false;
      }

      wx.showToast({
        title: successText,
        icon: 'success'
      });

      return this.fetchRecords().then(() => {
        return true;
      });
    }).catch((error) => {
      console.error('record action failed:', error);
      wx.showToast({
        title: '操作失败',
        icon: 'none'
      });
      return false;
    }).finally(() => {
      wx.hideLoading();
      this.setData({
        processingRecordId: '',
        processingAction: ''
      });
    });
  },

  confirmRecordAction: function (options) {
    const title = options.title || '确认操作';
    const content = options.content || '';

    wx.showModal({
      title: title,
      content: content,
      success: (res) => {
        if (!res.confirm) {
          return;
        }

        this.runRecordAction(options);
      }
    });
  },

  handleMarkRecord: function (event) {
    const recordId = event.currentTarget.dataset.id || '';
    const codeValue = event.currentTarget.dataset.code || '';

    this.confirmRecordAction({
      recordId: recordId,
      functionName: 'markRecord',
      title: '确认标记',
      content: `确认将该记录标记为已标记？\n${codeValue}`,
      loadingText: '标记中',
      successText: '标记成功'
    });
  },

  handleUndoMarkRecord: function (event) {
    const recordId = event.currentTarget.dataset.id || '';
    const codeValue = event.currentTarget.dataset.code || '';

    this.confirmRecordAction({
      recordId: recordId,
      functionName: 'undoMarkRecord',
      title: '确认撤回',
      content: `确认撤回该记录的标记？\n${codeValue}`,
      loadingText: '撤回中',
      successText: '撤回成功'
    });
  },

  handleArchiveRecord: function (event) {
    const recordId = event.currentTarget.dataset.id || '';
    const codeValue = event.currentTarget.dataset.code || '';

    this.confirmRecordAction({
      recordId: recordId,
      functionName: 'archiveRecord',
      title: '确认归档',
      content: `确认归档该记录？\n${codeValue}`,
      loadingText: '归档中',
      successText: '归档成功'
    });
  },

  fetchRecords: function (selectedIds) {
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
      const isAdmin = !!result.is_admin;
      const role = result.role || 'user';

      if (result.success === false) {
        wx.showToast({
          title: result.message || '记录加载失败',
          icon: 'none'
        });
      }

      const records = list.map((item) => formatCloudRecord(item));
      const nextSelectedIds = typeof selectedIds === 'undefined'
        ? this.data.selectedRecordIds
        : selectedIds;

      this.setData({
        isAdmin: isAdmin,
        currentUserRole: role,
        userKeyword: isAdmin ? this.data.userKeyword : ''
      });

      this.applyRecordsView(records, nextSelectedIds);

      return records;
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
