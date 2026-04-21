import { useState, useEffect } from 'react';
import api from '../utils/api';

export const useAuth = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedUser = localStorage.getItem('soq_user');
    if (savedUser) {
      const parsed = JSON.parse(savedUser);
      setUser(parsed);
      api.get(`/auth/me/${parsed.id}`).then(res => {
        setUser(res.data);
        localStorage.setItem('soq_user', JSON.stringify(res.data));
      }).catch(() => {
        localStorage.removeItem('soq_user');
        setUser(null);
      });
    }
    setLoading(false);
  }, []);

  const logout = () => {
    localStorage.removeItem('soq_user');
    setUser(null);
  };

  return { user, setUser, loading, logout };
};