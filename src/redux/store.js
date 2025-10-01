import { configureStore } from '@reduxjs/toolkit';
import { persistStore, persistReducer } from 'redux-persist';
import storage from 'redux-persist/lib/storage';
import { combineReducers } from '@reduxjs/toolkit';
import userReducer from './userSlice';
import interviewReducer from './interviewSlice';

// Persist configuration
const persistConfig = {
  key: 'root',
  storage,
  whitelist: ['interview'] // Only persist interview state
};

const rootReducer = combineReducers({
  user: userReducer,
  interview: interviewReducer
});

const persistedReducer = persistReducer(persistConfig, rootReducer);

export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['persist/PERSIST', 'persist/REHYDRATE']
      }
    })
});

export const persistor = persistStore(store);