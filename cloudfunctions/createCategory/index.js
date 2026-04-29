const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

exports.main = async (event) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  const rawName = event && event.name ? event.name : '';
  const name = rawName.trim();

  if (!name) {
    return {
      success: false,
      error: 'CATEGORY_NAME_REQUIRED',
      message: '分类名称不能为空'
    };
  }

  try {
    const duplicateResult = await db.collection('categories')
      .where({
        name: name
      })
      .limit(1)
      .get();

    if (duplicateResult.data && duplicateResult.data.length) {
      return {
        success: false,
        error: 'CATEGORY_EXISTS',
        message: '分类已存在'
      };
    }
  } catch (error) {
    console.error('check category duplicate failed:', error);

    return {
      success: false,
      error: 'CATEGORY_CREATE_ERROR',
      message: '分类创建失败'
    };
  }

  const now = new Date();
  const categoryData = {
    name: name,
    created_by: openid,
    is_locked: false,
    created_at: now,
    updated_at: now
  };

  try {
    const result = await db.collection('categories').add({
      data: categoryData
    });

    return {
      success: true,
      data: {
        _id: result._id,
        name: categoryData.name,
        created_by: categoryData.created_by,
        is_locked: categoryData.is_locked,
        created_at: categoryData.created_at,
        updated_at: categoryData.updated_at
      }
    };
  } catch (error) {
    console.error('create category failed:', error);

    return {
      success: false,
      error: 'CATEGORY_CREATE_ERROR',
      message: '分类创建失败'
    };
  }
};
