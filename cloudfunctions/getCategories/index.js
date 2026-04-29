const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

function normalizeTime(value) {
  if (!value) {
    return 0;
  }

  return new Date(value).getTime();
}

function sortByCreatedAtDesc(list) {
  return list.sort((left, right) => {
    return normalizeTime(right.created_at) - normalizeTime(left.created_at);
  });
}

exports.main = async () => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;

  try {
    const ownResult = await db.collection('categories')
      .where({
        created_by: openid
      })
      .get();

    const publicResult = await db.collection('categories')
      .where({
        is_locked: true
      })
      .get();

    const map = {};
    const combined = []
      .concat(ownResult.data || [])
      .concat(publicResult.data || []);

    combined.forEach((item) => {
      if (!item || !item._id || map[item._id]) {
        return;
      }

      map[item._id] = true;
    });

    const data = combined.filter((item) => {
      return item && item._id && map[item._id];
    }).filter((item, index, arr) => {
      return arr.findIndex((current) => current._id === item._id) === index;
    });

    return {
      success: true,
      data: sortByCreatedAtDesc(data)
    };
  } catch (error) {
    console.error('getCategories failed:', error);

    return {
      success: false,
      error: 'CATEGORY_FETCH_ERROR',
      message: '分类加载失败',
      data: []
    };
  }
};
