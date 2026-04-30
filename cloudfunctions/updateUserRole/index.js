const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const VALID_ROLES = {
  user: true,
  warehouse: true,
  admin: true
};

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

exports.main = async (event) => {
  try {
    const wxContext = cloud.getWXContext();
    const openid = wxContext.OPENID || '';
    const targetOpenid = event && event.target_openid ? event.target_openid : '';
    const role = event && event.role ? event.role : '';
    const now = new Date();
    let targetUser = null;
    let fromRole = 'user';
    const currentUser = await getCurrentUser(openid);

    if (!openid) {
      return {
        success: false,
        code: 'OPENID_REQUIRED',
        message: '用户信息获取失败'
      };
    }

    if (!currentUser || currentUser.role !== 'admin') {
      return {
        success: false,
        code: 'FORBIDDEN',
        message: '仅管理员可修改用户角色'
      };
    }

    if (!targetOpenid) {
      return {
        success: false,
        code: 'TARGET_OPENID_REQUIRED',
        message: '目标用户不能为空'
      };
    }

    if (!VALID_ROLES[role]) {
      return {
        success: false,
        code: 'INVALID_ROLE',
        message: '角色不合法'
      };
    }

    const targetUserResult = await db.collection('users')
      .where({
        openid: targetOpenid
      })
      .limit(1)
      .get();

    if (!targetUserResult.data || !targetUserResult.data.length) {
      return {
        success: false,
        code: 'TARGET_USER_NOT_FOUND',
        message: '目标用户不存在'
      };
    }

    targetUser = targetUserResult.data[0];
    fromRole = targetUser.role || 'user';

    await db.collection('users')
      .doc(targetUser._id)
      .update({
        data: {
          role: role,
          updated_at: now
        }
      });

    await db.collection('operation_logs').add({
      data: {
        user_id: openid,
        target_openid: targetOpenid,
        action: 'UPDATE_USER_ROLE',
        from_role: fromRole,
        to_role: role,
        created_at: now
      }
    });

    return {
      success: true,
      userInfo: {
        openid: targetOpenid,
        name: targetUser.name || '未命名用户',
        avatar_url: targetUser.avatar_url || '',
        role: role,
        status: targetUser.status || 'active',
        created_at: targetUser.created_at || null,
        updated_at: now
      }
    };
  } catch (error) {
    console.error('update user role failed:', error);

    return {
      success: false,
      code: 'UPDATE_USER_ROLE_ERROR',
      message: '修改用户角色失败'
    };
  }
};
