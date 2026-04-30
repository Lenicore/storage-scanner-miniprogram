const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

async function getCurrentUser(openid) {
  const userResult = await db.collection('users')
    .where({
      openid: openid
    })
    .limit(1)
    .get();

  if (!userResult.data || !userResult.data.length) {
    return null;
  }

  return userResult.data[0];
}

exports.main = async () => {
  try {
    const wxContext = cloud.getWXContext();
    const openid = wxContext.OPENID || '';
    const currentUser = await getCurrentUser(openid);

    if (!openid) {
      return {
        success: false,
        code: 'OPENID_REQUIRED',
        message: '用户信息获取失败',
        users: []
      };
    }

    if (!currentUser || currentUser.role !== 'admin') {
      return {
        success: false,
        code: 'FORBIDDEN',
        message: '仅管理员可查看用户列表',
        users: []
      };
    }

    const userResult = await db.collection('users')
      .orderBy('created_at', 'desc')
      .limit(200)
      .get();

    return {
      success: true,
      users: userResult.data || []
    };
  } catch (error) {
    console.error('get users for admin failed:', error);

    return {
      success: false,
      code: 'GET_USERS_FOR_ADMIN_ERROR',
      message: '获取用户列表失败',
      users: []
    };
  }
};
