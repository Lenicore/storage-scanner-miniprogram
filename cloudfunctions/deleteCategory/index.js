const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

exports.main = async (event) => {
  try {
    const wxContext = cloud.getWXContext();
    const openid = wxContext.OPENID || '';
    const categoryId = event && event.category_id ? event.category_id : '';

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

    const recordResult = await db.collection('scan_records').where({
      category_id: categoryId
    }).limit(1).get();

    if (recordResult.data && recordResult.data.length) {
      return {
        success: false,
        code: 'CATEGORY_NOT_EMPTY',
        message: '该分类下还有记录，无法删除'
      };
    }

    await db.collection('categories').doc(categoryId).remove();

    return {
      success: true
    };
  } catch (error) {
    console.error('delete category failed:', error);

    return {
      success: false,
      code: 'DELETE_CATEGORY_ERROR',
      message: '删除分类失败'
    };
  }
};
