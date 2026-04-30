function buildUserInfo(userInfo) {
  const source = userInfo || {};
  const rawName = source.name || '';
  const name = rawName === '未命名用户' ? '' : rawName;

  return {
    openid: source.openid || '',
    name: name,
    avatar_url: source.avatar_url || ''
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

  initUserInfo: function () {
    const app = getApp();

    if (app.globalData && app.globalData.userInfo) {
      if (!app.isProfileIncomplete(app.globalData.userInfo)) {
        wx.reLaunch({
          url: '/pages/index/index'
        });
        return Promise.resolve(app.globalData.userInfo);
      }

      this.applyUserInfo(app.globalData.userInfo);
      return Promise.resolve(app.globalData.userInfo);
    }

    return this.fetchUserInfo();
  },

  fetchUserInfo: function () {
    const app = getApp();

    if (this.data.isLoadingUser) {
      return Promise.resolve(null);
    }

    this.setData({
      isLoadingUser: true
    });

    return app.fetchLoginUserInfo().then((userInfo) => {
      if (!userInfo) {
        wx.showToast({
          title: '用户信息加载失败',
          icon: 'none'
        });
        return null;
      }

      if (!app.isProfileIncomplete(userInfo)) {
        wx.reLaunch({
          url: '/pages/index/index'
        });
        return userInfo;
      }

      this.applyUserInfo(userInfo);
      return userInfo;
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

  handleStartUsing: function () {
    const app = getApp();
    const userInfo = this.data.userInfo;
    const name = (this.data.formName || '').trim();

    if (!userInfo || this.data.isSaving) {
      return;
    }

    if (!name) {
      wx.showToast({
        title: '请输入昵称',
        icon: 'none'
      });
      return;
    }

    if (name === '未命名用户') {
      wx.showToast({
        title: '请使用其他昵称',
        icon: 'none'
      });
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
          name: name,
          avatar_url: avatarUrl
        }
      });
    }).then((res) => {
      const result = res.result || {};
      const nextUserInfo = result.userInfo || {};

      if (!result.success) {
        wx.showToast({
          title: result.message || '保存失败',
          icon: 'none'
        });
        return;
      }

      app.setUserInfo(nextUserInfo);

      wx.reLaunch({
        url: '/pages/index/index'
      });
    }).catch((error) => {
      console.error('save onboarding profile failed:', error);
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
