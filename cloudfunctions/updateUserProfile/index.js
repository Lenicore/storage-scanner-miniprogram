const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

exports.main = async (event) => {
  try {
    const wxContext = cloud.getWXContext();
    const openid = wxContext.OPENID || '';
    const now = new Date();
    const rawName = event.name || '';
    const avatarUrl = event.avatar_url || '';
    const name = typeof rawName === 'string' ? rawName.trim() : '';

    if (!openid) {
      return {
        success: false,
        code: 'OPENID_REQUIRED',
        message: '用户信息获取失败'
      };
    }

    await db.collection('users').where({
      openid: openid
    }).update({
      data: {
        name: name || '未命名用户',
        avatar_url: avatarUrl,
        updated_at: now
      }
    });

    const userResult = await db.collection('users').where({
      openid: openid
    }).limit(1).get();
    const currentUser = userResult.data && userResult.data.length ? userResult.data[0] : null;

    if (!currentUser) {
      return {
        success: false,
        code: 'USER_NOT_FOUND',
        message: '用户不存在'
      };
    }

    return {
      success: true,
      userInfo: {
        openid: currentUser.openid || openid,
        name: currentUser.name || '未命名用户',
        avatar_url: currentUser.avatar_url || '',
        role: currentUser.role || 'user',
        status: currentUser.status || 'active',
        created_at: currentUser.created_at || null,
        updated_at: currentUser.updated_at || now
      }
    };
  } catch (error) {
    console.error('update user profile failed:', error);

    return {
      success: false,
      code: 'UPDATE_USER_PROFILE_ERROR',
      message: '保存用户资料失败'
    };
  }
};
