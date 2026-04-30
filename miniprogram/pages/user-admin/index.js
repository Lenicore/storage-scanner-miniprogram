function formatRoleText(role) {
  if (role === 'admin') {
    return '管理员';
  }

  if (role === 'warehouse') {
    return '库管';
  }

  return '普通员工';
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

function formatUser(user) {
  const source = user || {};
  const role = source.role || 'user';
  const status = source.status || 'active';

  return {
    openid: source.openid || '',
    name: source.name || '未命名用户',
    role: role,
    roleText: formatRoleText(role),
    status: status,
    statusText: formatStatusText(status)
  };
}

function getRoleOptions() {
  return [{
    label: '普通员工',
    value: 'user'
  }, {
    label: '库管',
    value: 'warehouse'
  }, {
    label: '管理员',
    value: 'admin'
  }];
}

Page({
  data: {
    users: [],
    isLoadingUsers: false,
    processingOpenid: ''
  },

  onLoad: function () {
    this.fetchUsers();
  },

  fetchUsers: function () {
    if (this.data.isLoadingUsers) {
      return Promise.resolve([]);
    }

    this.setData({
      isLoadingUsers: true
    });

    return wx.cloud.callFunction({
      name: 'getUsersForAdmin'
    }).then((res) => {
      const result = res.result || {};
      const list = result.users || [];
      const users = [];
      let index = 0;

      if (!result.success) {
        wx.showToast({
          title: result.message || '加载用户失败',
          icon: 'none'
        });
        return [];
      }

      for (index = 0; index < list.length; index += 1) {
        users.push(formatUser(list[index]));
      }

      this.setData({
        users: users
      });
      return users;
    }).catch((error) => {
      console.error('get users for admin failed:', error);
      wx.showToast({
        title: '加载用户失败',
        icon: 'none'
      });
      return [];
    }).finally(() => {
      this.setData({
        isLoadingUsers: false
      });
    });
  },

  handleOpenRoleActions: function (event) {
    const targetOpenid = event.currentTarget.dataset.openid || '';
    const currentRole = event.currentTarget.dataset.role || 'user';
    const userName = event.currentTarget.dataset.name || '未命名用户';
    const options = getRoleOptions();
    const labels = [];
    let index = 0;

    if (!targetOpenid || this.data.processingOpenid) {
      return;
    }

    for (index = 0; index < options.length; index += 1) {
      labels.push(options[index].label);
    }

    wx.showActionSheet({
      itemList: labels,
      success: (res) => {
        const nextRole = options[res.tapIndex] ? options[res.tapIndex].value : '';
        const nextRoleLabel = options[res.tapIndex] ? options[res.tapIndex].label : '';

        if (!nextRole || nextRole === currentRole) {
          return;
        }

        wx.showModal({
          title: '确认修改角色',
          content: `确认将 ${userName} 修改为${nextRoleLabel}？`,
          success: (modalRes) => {
            if (!modalRes.confirm) {
              return;
            }

            this.updateUserRole(targetOpenid, nextRole);
          }
        });
      }
    });
  },

  updateUserRole: function (targetOpenid, role) {
    if (!targetOpenid) {
      return;
    }

    this.setData({
      processingOpenid: targetOpenid
    });

    wx.showLoading({
      title: '更新中',
      mask: true
    });

    wx.cloud.callFunction({
      name: 'updateUserRole',
      data: {
        target_openid: targetOpenid,
        role: role
      }
    }).then((res) => {
      const result = res.result || {};

      if (!result.success) {
        wx.showToast({
          title: result.message || '修改角色失败',
          icon: 'none'
        });
        return false;
      }

      wx.showToast({
        title: '修改成功',
        icon: 'success'
      });

      return this.fetchUsers().then(() => {
        return true;
      });
    }).catch((error) => {
      console.error('update user role failed:', error);
      wx.showToast({
        title: '修改角色失败',
        icon: 'none'
      });
      return false;
    }).finally(() => {
      wx.hideLoading();
      this.setData({
        processingOpenid: ''
      });
    });
  }
});
