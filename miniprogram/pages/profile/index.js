Page({
  data: {
    userInfo: {
      name: '测试用户',
      role: 'user',
      status: 'active',
      openid: 'mock-openid'
    }
  },

  onLoad: function () {
    // 临时隔离测试：页面加载时不自动调用云函数
  }
});
