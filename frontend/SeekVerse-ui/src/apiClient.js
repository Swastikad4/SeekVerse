import axios from 'axios';

const API = process.env.REACT_APP_API_URL || 'http://localhost:8001';

/**
 * Authenticated API helper.
 * Usage: const data = await userApi.get('/user/saved-papers', token);
 */
const userApi = {
  async call(method, path, data, token) {
    if (!token) return null;
    try {
      const res = await axios({
        method,
        url: `${API}${path}`,
        data,
        headers: { Authorization: `Bearer ${token}` },
      });
      return res.data;
    } catch (e) {
      console.error('userApi error:', e?.response?.data || e.message);
      return null;
    }
  },
  get:  (path, token)       => userApi.call('get',    path, null, token),
  post: (path, data, token) => userApi.call('post',   path, data, token),
  put:  (path, data, token) => userApi.call('put',    path, data, token),
  del:  (path, token)       => userApi.call('delete', path, null, token),
};

export default userApi;
