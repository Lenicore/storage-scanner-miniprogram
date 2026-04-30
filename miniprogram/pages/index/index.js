function padNumber(value) {
  return value < 10 ? `0${value}` : `${value}`;
}

function formatTime(date) {
  const year = date.getFullYear();
  const month = padNumber(date.getMonth() + 1);
  const day = padNumber(date.getDate());
  const hour = padNumber(date.getHours());
  const minute = padNumber(date.getMinutes());
  const second = padNumber(date.getSeconds());

  return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}

function getCodeType(scanType) {
  return scanType === 'QR_CODE' ? 'QR_CODE' : 'BAR_CODE';
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

function normalizeDate(value) {
  if (!value) {
    return new Date();
  }

  if (value instanceof Date) {
    return value;
  }

  return new Date(value);
}

function formatCloudRecord(record) {
  return {
    id: record._id || `${Date.now()}`,
    codeValue: record.code_value,
    codeType: record.code_type,
    codeTypeText: formatCodeTypeText(record.code_type),
    qrFileId: record.qr_file_id || '',
    qrCloudPath: record.qr_cloud_path || '',
    categoryId: record.category_id || '',
    categoryName: record.category_name || '',
    scanTime: formatTime(normalizeDate(record.created_at)),
    status: record.status || 'pending',
    statusText: formatStatusText(record.status)
  };
}

function formatCategory(record) {
  return {
    id: record._id || '',
    name: record.name || '未命名分类',
    isLocked: !!record.is_locked
  };
}

function getLoginUserInfo(response) {
  const result = response && response.result ? response.result : {};

  if (result.userInfo) {
    return result.userInfo;
  }

  return result || {};
}

function findCategoryById(list, id) {
  let index = 0;

  for (index = 0; index < list.length; index += 1) {
    if (list[index].id === id) {
      return list[index];
    }
  }

  return null;
}

function prependCategory(list, category) {
  const result = [];

  if (category && category.id) {
    result.push(category);
  }

  list.forEach((item) => {
    if (!category || item.id !== category.id) {
      result.push(item);
    }
  });

  return result;
}

function updateLocalRecordWithCloudData(localRecord, cloudResult) {
  const result = cloudResult || {};
  const recordData = result.data || {};

  return {
    id: result.id || localRecord.id,
    codeValue: recordData.code_value || localRecord.codeValue,
    codeType: recordData.code_type || localRecord.codeType,
    codeTypeText: formatCodeTypeText(recordData.code_type || localRecord.codeType),
    qrFileId: recordData.qr_file_id || localRecord.qrFileId || '',
    qrCloudPath: recordData.qr_cloud_path || localRecord.qrCloudPath || '',
    categoryId: recordData.category_id || localRecord.categoryId,
    categoryName: recordData.category_name || localRecord.categoryName,
    scanTime: formatTime(normalizeDate(recordData.created_at || localRecord.scanTime)),
    status: recordData.status || localRecord.status || 'pending',
    statusText: formatStatusText(recordData.status || localRecord.status || 'pending')
  };
}

function buildDuplicateRecord(localRecord, existingRecord) {
  const source = existingRecord || {};
  const status = source.status || localRecord.status || 'pending';

  return {
    id: source._id || localRecord.id,
    codeValue: source.code_value || localRecord.codeValue,
    codeType: localRecord.codeType,
    codeTypeText: localRecord.codeTypeText,
    qrFileId: '',
    qrCloudPath: '',
    categoryId: localRecord.categoryId,
    categoryName: source.category_name || localRecord.categoryName,
    scanTime: formatTime(normalizeDate(source.created_at || new Date())),
    status: status,
    statusText: formatStatusText(status),
    isDuplicate: true
  };
}

function replaceRecordAtTop(list, record, sourceRecord) {
  const result = [record];
  let index = 0;

  for (index = 0; index < list.length; index += 1) {
    if (
      list[index].id !== record.id &&
      list[index].id !== sourceRecord.id &&
      !(list[index].codeValue === sourceRecord.codeValue && list[index].scanTime === sourceRecord.scanTime)
    ) {
      result.push(list[index]);
    }
  }

  return result.slice(0, 6);
}

Page({
  data: {
    scanResult: null,
    scanNotice: '',
    recentRecords: [],
    categories: [],
    selectedCategory: null,
    categoryPickerVisible: false,
    isLoadingUser: false,
    isLoadingRecords: false,
    isLoadingCategories: false,
    isCreatingCategory: false
  },

  noop: function () {
  },

  onLoad: function () {
    this.initPageData();
  },

  initPageData: function () {
    this.ensureUserInfo().then(() => {
      this.fetchCategories();
      this.fetchUserRecords();
    });
  },

  ensureUserInfo: function () {
    const app = getApp();

    if (app.globalData && app.globalData.openid) {
      return Promise.resolve(app.globalData.userInfo || {});
    }

    if (this.data.isLoadingUser) {
      return Promise.resolve(null);
    }

    this.setData({
      isLoadingUser: true
    });

    return wx.cloud.callFunction({
      name: 'login'
    }).then((res) => {
      const result = res.result || {};
      const userInfo = getLoginUserInfo(res);

      if (result.success === false) {
        wx.showToast({
          title: result.message || '登录失败',
          icon: 'none'
        });
        return null;
      }

      app.globalData.openid = userInfo.openid || '';
      app.globalData.userInfo = userInfo;

      return userInfo;
    }).catch((error) => {
      console.error('login cloud function failed:', error);
      wx.showToast({
        title: '登录失败',
        icon: 'none'
      });
      return null;
    }).finally(() => {
      this.setData({
        isLoadingUser: false
      });
    });
  },

  fetchCategories: function () {
    if (this.data.isLoadingCategories) {
      return Promise.resolve([]);
    }

    this.setData({
      isLoadingCategories: true
    });

    return wx.cloud.callFunction({
      name: 'getCategories'
    }).then((res) => {
      const result = res.result || {};
      const list = (result.data || []).map((item) => formatCategory(item));
      let selectedCategory = this.data.selectedCategory;

      if (selectedCategory && selectedCategory.id) {
        selectedCategory = findCategoryById(list, selectedCategory.id);
      }

      this.setData({
        categories: list,
        selectedCategory: selectedCategory || null
      });

      return list;
    }).catch((error) => {
      console.error('get categories failed:', error);
      wx.showToast({
        title: '分类加载失败',
        icon: 'none'
      });
      return [];
    }).finally(() => {
      this.setData({
        isLoadingCategories: false
      });
    });
  },

  fetchUserRecords: function () {
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
      const data = result.records || [];
      const records = data.map((item) => formatCloudRecord(item)).slice(0, 6);

      this.setData({
        recentRecords: records
      });

      return records;
    }).catch((error) => {
      console.error('fetch scan records failed:', error);
      return [];
    }).finally(() => {
      this.setData({
        isLoadingRecords: false
      });
    });
  },

  handleOpenCategoryPicker: function () {
    if (!this.data.categories.length) {
      wx.showToast({
        title: '请先新建分类',
        icon: 'none'
      });
      return;
    }

    this.setData({
      categoryPickerVisible: true
    });
  },

  handleCloseCategoryPicker: function () {
    this.setData({
      categoryPickerVisible: false
    });
  },

  handlePickCategoryRow: function (event) {
    const categoryId = event.currentTarget.dataset.id;
    const category = findCategoryById(this.data.categories, categoryId);

    if (!category) {
      return;
    }

    this.setData({
      selectedCategory: category,
      categoryPickerVisible: false
    });
  },

  handleCreateCategory: function () {
    if (this.data.isCreatingCategory) {
      return;
    }

    wx.showModal({
      title: '新建分类',
      editable: true,
      placeholderText: '请输入分类名称',
      success: (res) => {
        if (!res.confirm) {
          return;
        }

        this.createCategory(res.content || '');
      }
    });
  },

  createCategory: function (name) {
    const categoryName = (name || '').trim();

    if (!categoryName) {
      wx.showToast({
        title: '分类名称不能为空',
        icon: 'none'
      });
      return;
    }

    this.setData({
      isCreatingCategory: true
    });

    wx.cloud.callFunction({
      name: 'createCategory',
      data: {
        name: categoryName
      }
    }).then((res) => {
      const result = res.result || {};

      if (!result.success) {
        wx.showToast({
          title: result.message || '分类创建失败',
          icon: 'none'
        });
        return;
      }

      const category = formatCategory(result.data || {});

      this.setData({
        categories: prependCategory(this.data.categories, category),
        selectedCategory: category
      });

      wx.showToast({
        title: '创建成功',
        icon: 'success'
      });
    }).catch((error) => {
      console.error('create category failed:', error);
      wx.showToast({
        title: '分类创建失败',
        icon: 'none'
      });
    }).finally(() => {
      this.setData({
        isCreatingCategory: false
      });
    });
  },

  saveScanRecordToCloud: function (record) {
    const selectedCategory = this.data.selectedCategory;

    if (!selectedCategory || !selectedCategory.id) {
      wx.showToast({
        title: '请先选择分类',
        icon: 'none'
      });
      return Promise.resolve({
        success: false,
        error: 'CATEGORY_REQUIRED'
      });
    }

    return wx.cloud.callFunction({
      name: 'createScanRecord',
      data: {
        code_value: record.codeValue,
        code_type: record.codeType,
        category_id: selectedCategory.id,
        category_name: selectedCategory.name
      }
    }).then((res) => {
      const result = res.result || {};

      if (!result.success) {
        if (result.code === 'DUPLICATE_CODE') {
          return result;
        }

        wx.showToast({
          title: result.message || '扫码记录保存失败',
          icon: 'none'
        });
        return result;
      }

      this.fetchUserRecords();
      return result;
    }).catch((error) => {
      console.error('create scan record failed:', error);
      wx.showToast({
        title: '扫码记录保存失败',
        icon: 'none'
      });
      return {
        success: false
      };
    });
  },

  showDuplicateRecordNotice: function (record) {
    wx.showModal({
      title: '重复扫码',
      content: `该码已存在于当前分类\n分类：${record.categoryName || '未分类'}\n时间：${record.scanTime}\n状态：${record.statusText}`,
      showCancel: false
    });
  },

  handleScan: function () {
    const selectedCategory = this.data.selectedCategory;

    if (!selectedCategory || !selectedCategory.id) {
      wx.showToast({
        title: '请先选择或新建分类',
        icon: 'none'
      });
      return;
    }

    wx.scanCode({
      success: (res) => {
        const codeValue = res.result || '';
        const codeType = getCodeType(res.scanType);
        const scanTime = formatTime(new Date());
        const record = {
          id: `${Date.now()}`,
          codeValue: codeValue,
          codeType: codeType,
          codeTypeText: formatCodeTypeText(codeType),
          qrFileId: '',
          qrCloudPath: '',
          categoryId: selectedCategory.id,
          categoryName: selectedCategory.name,
          scanTime: scanTime,
          status: 'pending',
          statusText: formatStatusText('pending'),
          isDuplicate: false
        };

        this.saveScanRecordToCloud(record).then((result) => {
          if (!result || !result.success) {
            if (result && result.code === 'DUPLICATE_CODE') {
              const duplicateRecord = buildDuplicateRecord(record, result.existingRecord || {});

              this.setData({
                scanResult: duplicateRecord,
                scanNotice: '该码已存在于当前分类'
              });

              this.showDuplicateRecordNotice(duplicateRecord);
            }

            return;
          }

          const cloudRecord = updateLocalRecordWithCloudData(record, result);

          this.setData({
            scanResult: cloudRecord,
            scanNotice: '',
            recentRecords: replaceRecordAtTop(this.data.recentRecords, cloudRecord, record)
          });

          wx.showToast({
            title: '扫码成功',
            icon: 'success'
          });
        });
      },
      fail: (error) => {
        if (error && error.errMsg && error.errMsg.indexOf('cancel') > -1) {
          return;
        }

        wx.showToast({
          title: '扫码失败',
          icon: 'none'
        });
      }
    });
  }
});
