import React, { useState } from 'react';
import Link from 'next/link';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import { useAuth } from '../../hooks/useAuth';
import { AuthShell, authFieldSx, isEmail, SubmitButton } from './AuthShell';

export const ForgotPassword = () => {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const emailError = submitted && !isEmail(email);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (!isEmail(email)) return;
    setLoading(true);
    setError(null);
    try {
      await resetPassword(email);
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível enviar o e-mail.');
    }
    setLoading(false);
  };

  return (
    <AuthShell
      title='Recuperar senha'
      subtitle='Enviamos um link para você criar uma senha nova.'
      footer={<Link href='/auth/login'>Voltar para o login</Link>}
    >
      {sent ? (
        <Alert severity='success'>
          Se existir uma conta com esse e-mail, o link chega em alguns minutos. Confira também o spam.
          Contas criadas com o Google não têm senha: use &quot;Entrar com o Google&quot;.
        </Alert>
      ) : (
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
            autoFocus
            sx={authFieldSx}
          />
          <SubmitButton loading={loading}>Enviar link</SubmitButton>
        </Box>
      )}
    </AuthShell>
  );
};
