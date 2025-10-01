import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  isAuthenticated: false,
  user: null,
  loading: true
};

const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {
    setUser: (state, action) => {
      state.isAuthenticated = true;
      state.user = action.payload;
      state.loading = false;
    },
    clearUser: (state) => {
      state.isAuthenticated = false;
      state.user = null;
      state.loading = false;
    },
    setLoading: (state, action) => {
      state.loading = action.payload;
    }
  }
});

export const { setUser, clearUser, setLoading } = userSlice.actions;
export default userSlice.reducer;