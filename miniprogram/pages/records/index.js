function padNumber(value) {
  return value < 10 ? `0${value}` : `${value}`;
}

const RECORDS_CACHE_KEY = 'scan_records_cache';
const RECORDS_FETCH_LIMIT = 100;
const REFRESH_INTERVAL_MS = 5000;

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

  if (!value) {
    return null;
  }

  if (!/^\d{8}$/.test(value)) {
    return {
      valid: false,
      message: '日期格式应为 YYYYMMDD'
    };
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
    return {
      valid: false,
      message: '日期格式应为 YYYYMMDD'
    };
  }

  return {
    valid: true,
    input: value,
    startMs: startDate.getTime(),
    endMs: endDate.getTime()
  };
}

function isSameDate(recordCreatedAt, parsedDate) {
  const date = normalizeDate(recordCreatedAt);
  let createdAtMs = 0;

  if (!parsedDate || !parsedDate.valid) {
    return true;
  }

  if (!date || isNaN(date.getTime())) {
    return false;
  }

  createdAtMs = date.getTime();

  return createdAtMs >= parsedDate.startMs && createdAtMs <= parsedDate.endMs;
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

function getStatusFilterText(status) {
  if (status === 'pending') {
    return '未处理';
  }

  if (status === 'marked') {
    return '已标记';
  }

  if (status === 'archived') {
    return '已归档';
  }

  return '全部';
}

function buildStatusFilterOptions() {
  return [{
    label: '全部',
    value: 'all'
  }, {
    label: '未处理',
    value: 'pending'
  }, {
    label: '已标记',
    value: 'marked'
  }, {
    label: '已归档',
    value: 'archived'
  }];
}

function buildCategoryFilterSheetOptions(options) {
  const source = Array.isArray(options) ? options : [];
  const result = [];
  let index = 0;

  for (index = 0; index < source.length; index += 1) {
    result.push({
      label: source[index].name,
      value: source[index].id
    });
  }

  return result;
}

function getCategoryFilterText(options, categoryId) {
  const source = Array.isArray(options) ? options : [];
  let index = 0;

  for (index = 0; index < source.length; index += 1) {
    if (source[index].id === categoryId) {
      return source[index].name;
    }
  }

  return '全部分类';
}

function filterRecords(records, filters) {
  const userKeyword = (filters.userKeyword || '').trim();
  const statusFilter = filters.statusFilter || 'all';
  const categoryFilter = filters.categoryFilter || 'all';
  const currentCategoryId = filters.currentCategoryId || '';
  const parsedDate = filters.parsedDate || null;
  const result = [];
  let index = 0;

  for (index = 0; index < records.length; index += 1) {
    const item = records[index];
    let matched = true;

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

    if (matched && currentCategoryId && item.categoryId !== currentCategoryId) {
      matched = false;
    }

    if (matched && parsedDate && parsedDate.valid && !isSameDate(item.createdAtValue, parsedDate)) {
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
    showCodeValue: shouldShowCodeValue(codeType),
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
    createdAtMs: createdAt.getTime(),
    createdAtValue: record.created_at || createdAt
  };
}

function cloneRecordWithSelection(record, isSelected) {
  return {
    id: record.id,
    groupKey: record.groupKey,
    codeValue: record.codeValue,
    codeType: record.codeType,
    showCodeValue: record.showCodeValue,
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
    createdAtValue: record.createdAtValue,
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

function formatCloudRecords(list) {
  const source = Array.isArray(list) ? list : [];
  const records = [];
  let index = 0;

  for (index = 0; index < source.length; index += 1) {
    records.push(formatCloudRecord(source[index]));
  }

  return records;
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
    dateFilterInput: '',
    dateFilterTip: '',
    userKeyword: '',
    statusFilter: 'all',
    statusFilterText: '全部',
    categoryFilter: 'all',
    categoryFilterText: '全部分类',
    currentCategoryViewId: '',
    currentCategoryViewName: '',
    filterSheetVisible: false,
    filterSheetTitle: '',
    filterSheetMode: '',
    filterSheetSelectedValue: '',
    filterSheetOptions: [],
    categoryRenameDialogVisible: false,
    categoryActionCategoryId: '',
    categoryActionCategoryName: '',
    categoryRenameValue: '',
    isCategoryActionProcessing: false,
    filteredRecordCount: 0,
    isAdmin: false,
    currentUserRole: 'user'
  },

  noop: function () {
  },

  onLoad: function () {
    this._hasInitialized = false;
    this._lastFetchAt = 0;
    this._parsedDateFilter = null;
    this.initRecords();
  },

  onShow: function () {
    if (!this._hasInitialized) {
      return;
    }

    this.refreshRecordsInBackground();
  },

  initRecords: function () {
    this._hasInitialized = true;

    if (!this.data.categoryGroups.length) {
      this.setData({
        isLoadingRecords: true
      });
    }

    this.restoreRecordsCache();
    return this.fetchRecords(undefined, true);
  },

  restoreRecordsCache: function () {
    let cache = null;

    try {
      cache = wx.getStorageSync(RECORDS_CACHE_KEY);
    } catch (error) {
      console.error('read records cache failed:', error);
      return;
    }

    if (!cache || !cache.records || !cache.records.length) {
      return;
    }

    this.renderRecordsState(formatCloudRecords(cache.records), [], {
      isAdmin: !!cache.is_admin,
      currentUserRole: cache.role || 'user',
      userKeyword: cache.is_admin ? this.data.userKeyword : '',
      isLoadingRecords: true
    });
  },

  saveRecordsCache: function (payload) {
    try {
      wx.setStorageSync(RECORDS_CACHE_KEY, {
        records: payload.records || [],
        role: payload.role || 'user',
        is_admin: !!payload.is_admin,
        saved_at: Date.now()
      });
    } catch (error) {
      console.error('save records cache failed:', error);
    }
  },

  renderRecordsState: function (records, selectedIds, extraState) {
    const nextState = extraState || {};
    const nextIsAdmin = typeof nextState.isAdmin === 'boolean' ? nextState.isAdmin : this.data.isAdmin;
    const categoryOptions = buildCategoryOptions(records);
    const filteredRecords = filterRecords(records, {
      userKeyword: nextIsAdmin ? this.data.userKeyword : '',
      statusFilter: this.data.statusFilter,
      categoryFilter: this.data.categoryFilter,
      currentCategoryId: this.data.currentCategoryViewId,
      parsedDate: this._parsedDateFilter
    });
    const safeSelectedIds = sanitizeSelectedIds(filteredRecords, selectedIds);
    const view = buildRecordsView(filteredRecords, safeSelectedIds);

    this.setData({
      allRecords: records,
      categoryOptions: categoryOptions,
      statusFilterText: getStatusFilterText(this.data.statusFilter),
      categoryFilterText: getCategoryFilterText(categoryOptions, this.data.categoryFilter),
      categoryGroups: view.groups,
      selectedRecordIds: safeSelectedIds,
      selectedCount: view.selectedCount,
      selectedPendingCount: view.selectedPendingCount,
      selectedMarkedCount: view.selectedMarkedCount,
      selectedArchivedCount: view.selectedArchivedCount,
      filteredRecordCount: filteredRecords.length,
      isAdmin: nextIsAdmin,
      currentUserRole: nextState.currentUserRole || this.data.currentUserRole,
      userKeyword: typeof nextState.userKeyword === 'string' ? nextState.userKeyword : this.data.userKeyword,
      isLoadingRecords: typeof nextState.isLoadingRecords === 'boolean' ? nextState.isLoadingRecords : this.data.isLoadingRecords
    });
  },

  applyRecordsView: function (records, selectedIds) {
    this.renderRecordsState(records, selectedIds);
  },

  refreshCurrentView: function () {
    this.applyRecordsView(this.data.allRecords, this.data.selectedRecordIds);
  },

  refreshRecordsInBackground: function () {
    const now = Date.now();

    if (this.data.isLoadingRecords) {
      return Promise.resolve([]);
    }

    if (now - this._lastFetchAt < REFRESH_INTERVAL_MS) {
      return Promise.resolve(this.data.allRecords);
    }

    return this.fetchRecords();
  },

  handleDateFilterInput: function (event) {
    const nextValue = (event.detail.value || '').replace(/\D/g, '').slice(0, 8);
    const parsedDate = parseDateFilter(nextValue);
    let tip = '';

    if (!nextValue) {
      this._parsedDateFilter = null;
    } else if (nextValue.length === 8 && parsedDate && parsedDate.valid) {
      this._parsedDateFilter = parsedDate;
    } else if (nextValue.length === 8) {
      this._parsedDateFilter = null;
      tip = parsedDate && parsedDate.message ? parsedDate.message : '日期格式应为 YYYYMMDD';
    } else {
      this._parsedDateFilter = null;
    }

    this.setData({
      dateFilterInput: nextValue,
      dateFilterTip: tip
    });

    this.refreshCurrentView();
  },

  handleClearDateFilter: function () {
    if (!this.data.dateFilterInput) {
      return;
    }

    this._parsedDateFilter = null;
    this.setData({
      dateFilterInput: '',
      dateFilterTip: ''
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

  openStatusFilterSheet: function () {
    this.setData({
      filterSheetVisible: true,
      filterSheetTitle: '选择状态',
      filterSheetMode: 'status',
      filterSheetSelectedValue: this.data.statusFilter,
      filterSheetOptions: buildStatusFilterOptions()
    });
  },

  openCategoryFilterSheet: function () {
    this.setData({
      filterSheetVisible: true,
      filterSheetTitle: '选择分类',
      filterSheetMode: 'category',
      filterSheetSelectedValue: this.data.categoryFilter,
      filterSheetOptions: buildCategoryFilterSheetOptions(this.data.categoryOptions)
    });
  },

  handleCloseFilterSheet: function () {
    this.setData({
      filterSheetVisible: false,
      filterSheetTitle: '',
      filterSheetMode: '',
      filterSheetSelectedValue: '',
      filterSheetOptions: []
    });
  },

  handleSelectFilterOption: function (event) {
    const mode = event.currentTarget.dataset.mode || '';
    const value = event.currentTarget.dataset.value || '';

    if (!mode) {
      return;
    }

    if (mode === 'status') {
      this.handleCloseFilterSheet();

      if (value === this.data.statusFilter) {
        return;
      }

      this.setData({
        statusFilter: value
      }, () => {
        this.refreshCurrentView();
      });
      return;
    }

    if (mode === 'category') {
      this.handleCloseFilterSheet();

      if (value === this.data.categoryFilter) {
        return;
      }

      this.setData({
        categoryFilter: value
      }, () => {
        this.refreshCurrentView();
      });
    }
  },

  handleEnterCategoryView: function (event) {
    const categoryId = event.currentTarget.dataset.categoryId || '';
    const categoryName = event.currentTarget.dataset.categoryName || '';

    if (!categoryId) {
      return;
    }

    this.setData({
      currentCategoryViewId: categoryId,
      currentCategoryViewName: categoryName || '未分类'
    });

    this.refreshCurrentView();
  },

  handleExitCategoryView: function () {
    if (!this.data.currentCategoryViewId) {
      return;
    }

    this.setData({
      currentCategoryViewId: '',
      currentCategoryViewName: ''
    });

    this.refreshCurrentView();
  },

  handleOpenCategoryActions: function (event) {
    const categoryId = event.currentTarget.dataset.categoryId || '';
    const categoryName = event.currentTarget.dataset.categoryName || '';

    if (!categoryId || this.data.isCategoryActionProcessing) {
      return;
    }

    this.setData({
      categoryActionCategoryId: categoryId,
      categoryActionCategoryName: categoryName || '未分类'
    });

    wx.showActionSheet({
      itemList: ['修改分类名称', '删除分类'],
      success: (res) => {
        if (res.tapIndex === 0) {
          this.openCategoryRenameDialog(categoryId, categoryName);
          return;
        }

        if (res.tapIndex === 1) {
          this.confirmDeleteCategory(categoryId, categoryName);
        }
      }
    });
  },

  openCategoryRenameDialog: function (categoryId, categoryName) {
    this.setData({
      categoryRenameDialogVisible: true,
      categoryActionCategoryId: categoryId || '',
      categoryActionCategoryName: categoryName || '未分类',
      categoryRenameValue: categoryName || ''
    });
  },

  handleCloseCategoryRenameDialog: function () {
    if (this.data.isCategoryActionProcessing) {
      return;
    }

    this.setData({
      categoryRenameDialogVisible: false,
      categoryRenameValue: ''
    });
  },

  handleCategoryRenameInput: function (event) {
    this.setData({
      categoryRenameValue: event.detail.value || ''
    });
  },

  handleConfirmCategoryRename: function () {
    const categoryId = this.data.categoryActionCategoryId || '';
    const nextName = (this.data.categoryRenameValue || '').trim();

    if (!categoryId) {
      return;
    }

    if (!nextName) {
      wx.showToast({
        title: '分类名称不能为空',
        icon: 'none'
      });
      return;
    }

    this.setData({
      isCategoryActionProcessing: true
    });

    wx.showLoading({
      title: '修改中',
      mask: true
    });

    wx.cloud.callFunction({
      name: 'updateCategoryName',
      data: {
        category_id: categoryId,
        name: nextName
      }
    }).then((res) => {
      const result = res.result || {};

      if (!result.success) {
        wx.showToast({
          title: result.message || '修改分类失败',
          icon: 'none'
        });
        return false;
      }

      if (this.data.currentCategoryViewId === categoryId) {
        this.setData({
          currentCategoryViewName: nextName
        });
      }

      this.setData({
        categoryRenameDialogVisible: false,
        categoryRenameValue: '',
        categoryActionCategoryName: nextName
      });

      wx.showToast({
        title: '修改成功',
        icon: 'success'
      });

      return this.fetchRecords([]).then(() => {
        return true;
      });
    }).catch((error) => {
      console.error('update category name failed:', error);
      wx.showToast({
        title: '修改分类失败',
        icon: 'none'
      });
      return false;
    }).finally(() => {
      wx.hideLoading();
      this.setData({
        isCategoryActionProcessing: false
      });
    });
  },

  confirmDeleteCategory: function (categoryId, categoryName) {
    wx.showModal({
      title: '确认删除',
      content: `确认删除该分类？删除后无法恢复\n${categoryName || '未分类'}`,
      success: (res) => {
        if (!res.confirm) {
          return;
        }

        this.deleteCategory(categoryId);
      }
    });
  },

  deleteCategory: function (categoryId) {
    if (!categoryId) {
      return;
    }

    this.setData({
      isCategoryActionProcessing: true
    });

    wx.showLoading({
      title: '删除中',
      mask: true
    });

    wx.cloud.callFunction({
      name: 'deleteCategory',
      data: {
        category_id: categoryId
      }
    }).then((res) => {
      const result = res.result || {};

      if (!result.success) {
        wx.showToast({
          title: result.message || '删除分类失败',
          icon: 'none'
        });
        return false;
      }

      if (this.data.currentCategoryViewId === categoryId) {
        this.setData({
          currentCategoryViewId: '',
          currentCategoryViewName: ''
        });
      }

      wx.showToast({
        title: '删除成功',
        icon: 'success'
      });

      return this.fetchRecords([]).then(() => {
        return true;
      });
    }).catch((error) => {
      console.error('delete category failed:', error);
      wx.showToast({
        title: '删除分类失败',
        icon: 'none'
      });
      return false;
    }).finally(() => {
      wx.hideLoading();
      this.setData({
        isCategoryActionProcessing: false
      });
    });
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

  handleOpenViewer: function (event) {
    const recordId = event.currentTarget.dataset.id || '';
    const categoryId = event.currentTarget.dataset.categoryId || '';

    if (this.data.isBatchMode || !recordId || !categoryId) {
      return;
    }

    wx.navigateTo({
      url: `/pages/record-viewer/index?record_id=${encodeURIComponent(recordId)}&category_id=${encodeURIComponent(categoryId)}`
    });
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

  fetchRecords: function (selectedIds, skipLock) {
    if (this.data.isLoadingRecords && !skipLock) {
      return Promise.resolve([]);
    }

    this._lastFetchAt = Date.now();
    this.setData({
      isLoadingRecords: true
    });

    return wx.cloud.callFunction({
      name: 'getUserScanRecords',
      data: {
        limit: RECORDS_FETCH_LIMIT
      }
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

        this.setData({
          isLoadingRecords: false
        });
        return this.data.allRecords;
      }

      const records = formatCloudRecords(list);
      const nextSelectedIds = typeof selectedIds === 'undefined'
        ? this.data.selectedRecordIds
        : selectedIds;

      this.saveRecordsCache(result);
      this.renderRecordsState(records, nextSelectedIds, {
        isAdmin: isAdmin,
        currentUserRole: role,
        userKeyword: isAdmin ? this.data.userKeyword : '',
        isLoadingRecords: false
      });

      return records;
    }).catch((error) => {
      console.error('fetch records failed:', error);
      wx.showToast({
        title: '记录加载失败',
        icon: 'none'
      });
      this.setData({
        isLoadingRecords: false
      });
      return this.data.allRecords;
    });
  }
});
