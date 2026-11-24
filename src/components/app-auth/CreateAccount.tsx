import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useAuth } from '../../hooks/useAuth';
import { AuthShell, authFieldSx, GoogleButton, isEmail, OrDivider, SubmitButton } from './AuthShell';

const MIN_PASSWORD = 8;

export const CreateAccount = () => {
  const { signUp, signInWithGoogle } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const errors = {
    name: !form.name.trim() ? 'Informe seu nome.' : undefined,
    email: !isEmail(form.email) ? 'Informe um e-mail válido.' : undefined,
    password: form.password.length < MIN_PASSWORD ? `Use pelo menos ${MIN_PASSWORD} caracteres.` : undefined,
    confirm: form.confirm !== form.password ? 'As senhas não são iguais.' : undefined,
  };
  const show = (k: keyof typeof errors) => (submitted ? errors[k] : undefined);
  const next = typeof router.query.next === 'string' ? `?next=${encodeURIComponent(router.query.next)}` : '';

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const attempt = async (action: () => Promise<void>) => {
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível criar a conta.');
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (Object.values(errors).some(Boolean)) return;
    setLoading(true);
    await attempt(() => signUp({ name: form.name, email: form.email, password: form.password }));
    setLoading(false);
  };

  return (
    <AuthShell
      title='Criar conta'
      subtitle='Monte seus repertórios e leve as cifras para o palco.'
      footer={<>Já tem conta? <Link href={`/auth/login${next}`}>Entrar</Link></>}
    >
      <GoogleButton label='Continuar com o Google' onClick={() => attempt(signInWithGoogle)} disabled={loading} />
      <OrDivider />

      <Box component='form' noValidate onSubmit={submit} sx={{ display: 'grid', gap: 2 }}>
        {error && <Alert severity='error'>{error}</Alert>}
        <TextField variant='outlined' label='Nome' autoComplete='name' value={form.name} onChange={set('name')}
          error={!!show('name')} helperText={show('name')} fullWidth sx={authFieldSx} />
        <TextField variant='outlined' label='E-mail' type='email' autoComplete='email' value={form.email} onChange={set('email')}
          error={!!show('email')} helperText={show('email')} fullWidth sx={authFieldSx} />
        <TextField variant='outlined' label='Senha' type='password' autoComplete='new-password' value={form.password} onChange={set('password')}
          error={!!show('password')} helperText={show('password') ?? `Mínimo de ${MIN_PASSWORD} caracteres.`} fullWidth sx={authFieldSx} />
        <TextField variant='outlined' label='Confirmar senha' type='password' autoComplete='new-password' value={form.confirm} onChange={set('confirm')}
          error={!!show('confirm')} helperText={show('confirm')} fullWidth sx={authFieldSx} />
        <SubmitButton loading={loading}>Criar conta</SubmitButton>
        <Typography variant='caption' sx={{ color: 'text.secondary', textAlign: 'center' }}>
          Seus repertórios ficam visíveis só para você.
        </Typography>
      </Box>
    </AuthShell>
  );
};
