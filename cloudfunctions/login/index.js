const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

exports.main = async () => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  const usersCollection = db.collection('users');

  try {
    const userRes = await usersCollection.where({
      openid: openid
    }).limit(1).get();

    if (userRes.data && userRes.data.length) {
      const currentUser = userRes.data[0];

      return {
        success: true,
        openid: openid,
        userInfo: {
          openid: currentUser.openid || openid,
          name: currentUser.name || '未命名用户',
          role: currentUser.role || 'user',
          status: currentUser.status || 'active'
        }
      };
    }
  } catch (error) {
    console.error('query users failed:', error);

    return {
      success: false,
      openid: openid,
      error: 'USER_DB_ERROR',
      message: '用户信息初始化失败'
    };
  }

  const now = new Date();
  const newUser = {
    openid: openid,
    name: '未命名用户',
    role: 'user',
    status: 'active',
    created_at: now,
    updated_at: now
  };

  try {
    await usersCollection.add({
      data: newUser
    });

    return {
      success: true,
      openid: openid,
      userInfo: {
        openid: newUser.openid,
        name: newUser.name,
        role: newUser.role,
        status: newUser.status
      }
    };
  } catch (error) {
    console.error('create user failed:', error);

    return {
      success: false,
      openid: openid,
      error: 'USER_DB_ERROR',
      message: '用户信息初始化失败'
    };
  }
};
