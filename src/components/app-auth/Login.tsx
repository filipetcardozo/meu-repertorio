import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import { useAuth } from '../../hooks/useAuth';
import { AuthLink, AuthShell, authFieldSx, GoogleButton, isEmail, OrDivider, SubmitButton } from './AuthShell';

export const LoginComponent = () => {
  const { signIn, signInWithGoogle } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const emailError = submitted && !isEmail(email);
  const passwordError = submitted && !password;
  // Mantém o ?next= ao trocar para o cadastro
  const next = typeof router.query.next === 'string' ? `?next=${encodeURIComponent(router.query.next)}` : '';

  const attempt = async (action: () => Promise<void>) => {
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível entrar.');
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (!isEmail(email) || !password) return;
    setLoading(true);
    await attempt(() => signIn({ email, password }));
    setLoading(false);
  };

  return (
    <AuthShell
      title='Entrar'
      subtitle='Acesse seus repertórios e cifras.'
      footer={<>Ainda não tem conta? <Link href={`/auth/create-account${next}`}>Criar conta</Link></>}
    >
      <GoogleButton label='Entrar com o Google' onClick={() => attempt(signInWithGoogle)} disabled={loading} />
      <OrDivider />

      <Box component='form' noValidate onSubmit={submit} sx={{ display: 'grid', gap: 2 }}>
        {error && <Alert severity='error'>{error}</Alert>}
        <TextField variant='outlined'
          label='E-mail'
          type='email'
          autoComplete='email'
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={emailError}
          helperText={emailError ? 'Informe um e-mail válido.' : undefined}
          fullWidth
          sx={authFieldSx}
        />
        <TextField variant='outlined'
          label='Senha'
          type='password'
          autoComplete='current-password'
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={passwordError}
          helperText={passwordError ? 'Informe a senha.' : undefined}
          fullWidth
          sx={authFieldSx}
        />
        <Box sx={{ textAlign: 'right', mt: -1, fontSize: 14, '& a': { color: 'primary.main' } }}>
          <AuthLink href='/auth/forget-password'>Esqueceu a senha?</AuthLink>
        </Box>
        <SubmitButton loading={loading}>Entrar</SubmitButton>
      </Box>
    </AuthShell>
  );
};
