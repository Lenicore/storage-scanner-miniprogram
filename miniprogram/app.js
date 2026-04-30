// app.js
App({
  onLaunch: function () {
    this.globalData = {
      // env 参数说明：
      // env 参数决定接下来小程序发起的云开发调用（wx.cloud.xxx）会请求到哪个云环境的资源
      // 此处请填入环境 ID, 环境 ID 可在微信开发者工具右上顶部工具栏点击云开发按钮打开获取
      env: "cloud1-d1g72efa79e78d785",
      userInfo: null,
      openid: "",
      loginPromise: null
    };
    if (!wx.cloud) {
      console.error("请使用 2.2.3 或以上的基础库以使用云能力");
    } else {
      wx.cloud.init({
        env: this.globalData.env,
        traceUser: true,
      });
      this.fetchLoginUserInfo();
    }
  },

  setUserInfo: function (userInfo) {
    const nextUserInfo = userInfo || null;

    this.globalData.userInfo = nextUserInfo;
    this.globalData.openid = nextUserInfo && nextUserInfo.openid ? nextUserInfo.openid : "";
    this.globalData.loginPromise = Promise.resolve(nextUserInfo);

    return nextUserInfo;
  },

  isProfileIncomplete: function (userInfo) {
    const rawName = userInfo && userInfo.name ? userInfo.name : "";
    const name = typeof rawName === "string" ? rawName.trim() : "";

    return !name || name === "未命名用户";
  },

  fetchLoginUserInfo: function (forceRefresh) {
    if (!wx.cloud) {
      return Promise.resolve(null);
    }

    if (this.globalData.loginPromise && !forceRefresh) {
      return this.globalData.loginPromise;
    }

    this.globalData.loginPromise = wx.cloud.callFunction({
      name: "login"
    }).then((res) => {
      const result = res && res.result ? res.result : {};
      const userInfo = result.userInfo || result || {};

      if (result.success === false) {
        return null;
      }

      return this.setUserInfo(userInfo);
    }).catch((error) => {
      console.error("fetch login user info failed:", error);
      return null;
    });

    return this.globalData.loginPromise;
  },

  ensureOnboardingIfNeeded: function (currentPath) {
    return this.fetchLoginUserInfo().then((userInfo) => {
      if (!userInfo) {
        return {
          redirected: false,
          userInfo: null
        };
      }

      if (currentPath === "pages/onboarding/index") {
        return {
          redirected: false,
          userInfo: userInfo
        };
      }

      if (this.isProfileIncomplete(userInfo)) {
        wx.reLaunch({
          url: "/pages/onboarding/index"
        });

        return {
          redirected: true,
          userInfo: userInfo
        };
      }

      return {
        redirected: false,
        userInfo: userInfo
      };
    });
  },
});
