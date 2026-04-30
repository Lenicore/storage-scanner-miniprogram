const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;

exports.main = async (event) => {
  try {
    const wxContext = cloud.getWXContext();
    const openid = wxContext.OPENID || '';
    const categoryId = event && event.category_id ? event.category_id : '';
    const rawName = event && event.name ? event.name : '';
    const name = rawName.trim();
    const now = new Date();

    if (!openid) {
      return {
        success: false,
        code: 'OPENID_REQUIRED',
        message: '用户信息获取失败'
      };
    }

    if (!categoryId) {
      return {
        success: false,
        code: 'CATEGORY_ID_REQUIRED',
        message: '分类信息缺失'
      };
    }

    if (!name) {
      return {
        success: false,
        code: 'CATEGORY_NAME_REQUIRED',
        message: '分类名称不能为空'
      };
    }

    const categoryResult = await db.collection('categories').where({
      _id: categoryId,
      created_by: openid
    }).limit(1).get();

    if (!categoryResult.data || !categoryResult.data.length) {
      return {
        success: false,
        code: 'CATEGORY_NOT_FOUND',
        message: '分类不存在或无权限操作'
      };
    }

    const currentCategory = categoryResult.data[0];

    if ((currentCategory.name || '') === name) {
      return {
        success: true,
        data: currentCategory
      };
    }

    const duplicateResult = await db.collection('categories').where({
      created_by: openid,
      name: name,
      _id: _.neq(categoryId)
    }).limit(1).get();

    if (duplicateResult.data && duplicateResult.data.length) {
      return {
        success: false,
        code: 'CATEGORY_EXISTS',
        message: '同一用户下分类名称不能重复'
      };
    }

    await db.collection('categories').doc(categoryId).update({
      data: {
        name: name,
        updated_at: now
      }
    });

    await db.collection('scan_records').where({
      user_id: openid,
      category_id: categoryId
    }).update({
      data: {
        category_name: name,
        updated_at: now
      }
    });

    return {
      success: true,
      data: {
        _id: categoryId,
        name: name,
        created_by: openid,
        is_locked: !!currentCategory.is_locked,
        created_at: currentCategory.created_at || null,
        updated_at: now
      }
    };
  } catch (error) {
    console.error('update category name failed:', error);

    return {
      success: false,
      code: 'UPDATE_CATEGORY_NAME_ERROR',
      message: '修改分类名称失败'
    };
  }
};
