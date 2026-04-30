function formatRoleText(role) {
  return role === 'admin' ? '管理员' : '普通员工';
}

function formatStatusText(status) {
  if (status === 'pending') {
    return '待审核';
  }

  if (status === 'disabled') {
    return '已禁用';
  }

  return '正常';
}

function buildUserInfo(userInfo) {
  const source = userInfo || {};
  const role = source.role || 'user';
  const status = source.status || 'active';

  return {
    openid: source.openid || '',
    name: source.name || '未命名用户',
    avatar_url: source.avatar_url || '',
    role: role,
    roleText: formatRoleText(role),
    status: status,
    statusText: formatStatusText(status)
  };
}

Page({
  data: {
    userInfo: null,
    formName: '',
    formAvatarUrl: '',
    isSaving: false,
    isLoadingUser: false
  },

  onLoad: function () {
    this.initUserInfo();
  },

  onShow: function () {
    if (this.data.userInfo) {
      return;
    }

    this.initUserInfo();
  },

  initUserInfo: function () {
    const app = getApp();

    if (app.globalData && app.globalData.userInfo) {
      this.applyUserInfo(app.globalData.userInfo);
      return Promise.resolve(app.globalData.userInfo);
    }

    return this.fetchUserInfo();
  },

  fetchUserInfo: function () {
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
      const userInfo = result.userInfo || {};
      const app = getApp();

      if (!result.success) {
        wx.showToast({
          title: result.message || '用户信息加载失败',
          icon: 'none'
        });
        return null;
      }

      app.globalData.openid = userInfo.openid || '';
      app.globalData.userInfo = userInfo;
      this.applyUserInfo(userInfo);
      return userInfo;
    }).catch((error) => {
      console.error('fetch user info failed:', error);
      wx.showToast({
        title: '用户信息加载失败',
        icon: 'none'
      });
      return null;
    }).finally(() => {
      this.setData({
        isLoadingUser: false
      });
    });
  },

  applyUserInfo: function (userInfo) {
    const nextUserInfo = buildUserInfo(userInfo);

    this.setData({
      userInfo: nextUserInfo,
      formName: nextUserInfo.name,
      formAvatarUrl: nextUserInfo.avatar_url
    });
  },

  handleChooseAvatar: function (event) {
    const avatarUrl = event.detail.avatarUrl || '';

    if (!avatarUrl) {
      return;
    }

    this.setData({
      formAvatarUrl: avatarUrl
    });
  },

  handleNameInput: function (event) {
    this.setData({
      formName: event.detail.value || ''
    });
  },

  uploadAvatarIfNeeded: function () {
    const avatarUrl = this.data.formAvatarUrl || '';
    const currentUser = this.data.userInfo || {};
    const openid = currentUser.openid || getApp().globalData.openid || '';
    const now = Date.now();

    if (!avatarUrl) {
      return Promise.resolve('');
    }

    if (avatarUrl.indexOf('cloud://') === 0) {
      return Promise.resolve(avatarUrl);
    }

    if (avatarUrl.indexOf('http://tmp/') === 0 || avatarUrl.indexOf('wxfile://') === 0 || avatarUrl.indexOf('http://') === 0 || avatarUrl.indexOf('https://') === 0) {
      if (!openid) {
        return Promise.resolve('');
      }

      return wx.cloud.uploadFile({
        cloudPath: `user-avatars/${openid}/${now}.png`,
        filePath: avatarUrl
      }).then((res) => {
        return res.fileID || '';
      });
    }

    return Promise.resolve(avatarUrl);
  },

  handleSaveProfile: function () {
    const userInfo = this.data.userInfo;
    const name = (this.data.formName || '').trim();

    if (!userInfo || this.data.isSaving) {
      return;
    }

    this.setData({
      isSaving: true
    });

    wx.showLoading({
      title: '保存中',
      mask: true
    });

    this.uploadAvatarIfNeeded().then((avatarUrl) => {
      return wx.cloud.callFunction({
        name: 'updateUserProfile',
        data: {
          name: name || '未命名用户',
          avatar_url: avatarUrl
        }
      });
    }).then((res) => {
      const result = res.result || {};
      const nextUserInfo = result.userInfo || {};
      const app = getApp();

      if (!result.success) {
        wx.showToast({
          title: result.message || '保存失败',
          icon: 'none'
        });
        return;
      }

      app.globalData.openid = nextUserInfo.openid || userInfo.openid || '';
      app.globalData.userInfo = nextUserInfo;
      this.applyUserInfo(nextUserInfo);

      wx.showToast({
        title: '保存成功',
        icon: 'success'
      });
    }).catch((error) => {
      console.error('save profile failed:', error);
      wx.showToast({
        title: '保存失败',
        icon: 'none'
      });
    }).finally(() => {
      wx.hideLoading();
      this.setData({
        isSaving: false
      });
    });
  }
});
