import { supabase } from '../lib/supabase';

export interface User {
  id: string;
  username: string;
  isAdmin?: boolean;
}

const EMAIL_SUFFIX = '@qstv.local';

export const register = async (username: string, password: string): Promise<User> => {
  if (!username || !password) throw new Error('用户名或密码不能为空');
  if (username.length < 3) throw new Error('用户名至少3个字符');
  if (password.length < 6) throw new Error('密码至少6个字符');
  if (username === 'qishuo') throw new Error('该用户名已被系统保留');

  const { data, error } = await supabase.auth.signUp({
    email: `${username}${EMAIL_SUFFIX}`,
    password,
    options: {
      data: {
        username,
        is_admin: false,
      }
    }
  });

  if (error) {
    if (error.message.includes('already registered')) throw new Error('用户名已被注册');
    throw new Error(error.message);
  }

  if (!data.user) throw new Error('注册失败');

  return {
    id: data.user.id,
    username: data.user.user_metadata.username,
    isAdmin: data.user.user_metadata.is_admin || false,
  };
};

export const login = async (username: string, password: string): Promise<User> => {
  const email = `${username}${EMAIL_SUFFIX}`;

  // System Super Admin (Auto-register if not exists so data is stored in DB)
  if (username === 'qishuo' && password === 'wy961010') {
    let { data, error } = await supabase.auth.signInWithPassword({ email, password });
    
    // If it fails, try to register the admin account
    if (error) {
      const signUpRes = await supabase.auth.signUp({
        email,
        password,
        options: { data: { username, is_admin: true } }
      });
      if (!signUpRes.error && signUpRes.data.user) {
        data = { user: signUpRes.data.user, session: signUpRes.data.session } as any;
        error = null;
      }
    }

    if (error) throw new Error('管理员账号初始化失败');
    if (!data.user) throw new Error('登录失败');

    return {
      id: data.user.id,
      username: 'qishuo',
      isAdmin: true,
    };
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    throw new Error('用户名或密码错误');
  }

  if (!data.user) throw new Error('登录失败');

  return {
    id: data.user.id,
    username: data.user.user_metadata.username,
    isAdmin: data.user.user_metadata.is_admin || false,
  };
};

export const logout = async (): Promise<void> => {
  await supabase.auth.signOut();
};

export const getCurrentUser = async (): Promise<User | null> => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return null;
  return {
    id: session.user.id,
    username: session.user.user_metadata.username,
    isAdmin: session.user.user_metadata.is_admin || false,
  };
};
