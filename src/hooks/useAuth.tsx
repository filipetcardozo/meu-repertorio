/* eslint-disable react-hooks/exhaustive-deps */

import {
    onAuthStateChanged, signInWithEmailAndPassword, User, signOut as callSignOut,
    getAuth, createUserWithEmailAndPassword, GoogleAuthProvider, signInWithPopup,
    sendPasswordResetEmail, updateProfile
} from "firebase/auth";
import { FirebaseError } from "firebase/app";
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { firebaseApp } from "../../firebaseConfig";
import { useRouter } from 'next/router'
import { createUserProfile, getUserInfos } from "../providers/user/services";
import { userInfosType } from "../types/userInfos";

interface Auth {
    isLogged: boolean | undefined;
    loading: boolean;
    uid?: string;
    user?: User;
    /** As funções abaixo rejeitam com um Error de mensagem já pronta para o usuário. */
    signIn(value: SignIn): Promise<void>;
    signInWithGoogle(): Promise<void>;
    signUp(value: SignUp): Promise<void>;
    resetPassword(email: string): Promise<void>;
    signOut(): void;
    userInfos?: userInfosType;
}

interface SignIn {
    email: string;
    password: string;
}

interface SignUp extends SignIn {
    name: string;
}

type Props = {
    children?: React.ReactNode;
};

const AUTH_ERRORS: Record<string, string> = {
    'auth/invalid-credential': 'E-mail ou senha incorretos.',
    'auth/invalid-login-credentials': 'E-mail ou senha incorretos.',
    'auth/wrong-password': 'E-mail ou senha incorretos.',
    'auth/user-not-found': 'E-mail ou senha incorretos.',
    'auth/invalid-email': 'E-mail inválido.',
    'auth/user-disabled': 'Esta conta foi desativada.',
    'auth/email-already-in-use': 'Já existe uma conta com este e-mail. Entre com a senha ou com o Google.',
    'auth/weak-password': 'A senha precisa ter pelo menos 6 caracteres.',
    'auth/too-many-requests': 'Muitas tentativas seguidas. Espere alguns minutos e tente de novo.',
    'auth/network-request-failed': 'Sem conexão. Verifique a internet e tente de novo.',
    'auth/popup-blocked': 'O navegador bloqueou a janela do Google. Libere pop-ups para este site e tente de novo.',
    'auth/account-exists-with-different-credential': 'Este e-mail já está cadastrado com outro método de login.',
    'auth/unauthorized-domain': 'Este endereço ainda não está autorizado para login com o Google.',
    'auth/operation-not-allowed': 'Este método de login ainda não está ativado.',
};

/** Popup fechado pelo próprio usuário não é erro. */
const SILENT_ERRORS = new Set(['auth/popup-closed-by-user', 'auth/cancelled-popup-request', 'auth/user-cancelled']);

function friendlyError(e: unknown): Error | null {
    const code = e instanceof FirebaseError ? e.code : '';
    if (SILENT_ERRORS.has(code)) return null;
    console.error('Auth error:', e);
    return new Error(AUTH_ERRORS[code] ?? 'Não foi possível concluir. Tente novamente.');
}

async function run(action: () => Promise<unknown>) {
    try {
        await action();
    } catch (e) {
        const error = friendlyError(e);
        if (error) throw error;
    }
}

const AuthContext = createContext<Auth>({} as Auth)

export const AuthProvider: React.FC<Props> = ({ children }) => {
    const [isLogged, setIsLogged] = useState<boolean | undefined>()
    const [loading, setLoading] = useState(false)
    const [uid, setUid] = useState("")
    const [user, setUser] = useState<User>()
    const [userInfos, setUserInfos] = useState<userInfosType>()
    const router = useRouter()

    const auth = getAuth(firebaseApp);

    const signIn = ({ email, password }: SignIn) =>
        run(() => signInWithEmailAndPassword(auth, email.trim(), password));

    const signInWithGoogle = () => {
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });
        return run(() => signInWithPopup(auth, provider));
    };

    const signUp = ({ name, email, password }: SignUp) =>
        run(async () => {
            const { user } = await createUserWithEmailAndPassword(auth, email.trim(), password);
            if (name.trim()) await updateProfile(user, { displayName: name.trim() });
            await createUserProfile(user);
        });

    const resetPassword = (email: string) =>
        run(() => sendPasswordResetEmail(auth, email.trim()));

    function signOut() {
        callSignOut(auth)
            .then(() => {
                setIsLogged(false)
                setUserInfos(undefined)
                router.push("/auth/login")
            })
            .catch((error) => {
                console.log(error)
            });
    }

    async function loadUserInfos(user: User) {
        try {
            // Primeiro login (Google ou conta criada antes do perfil existir): cria o perfil.
            const infos = (await getUserInfos(user.uid)) ?? (await createUserProfile(user))
            setUserInfos(infos)
        } catch (e) {
            console.log(e)
        }
    }

    function checkOnAuthStateUser(user: User | null) {
        if (user) {
            loadUserInfos(user)
            setUser(user)
            setUid(user.uid)
            setIsLogged(true)
        } else {
            setUser(undefined)
            setUid("")
            setIsLogged(false)
        }

        setLoading(false)
    }

    const userProvider = useMemo((): Auth => ({
        isLogged,
        loading,
        user,
        uid,
        signIn,
        signInWithGoogle,
        signUp,
        resetPassword,
        signOut,
        userInfos
    }), [isLogged, loading, uid, user, userInfos])

    useEffect(() => {
        setLoading(true)
        const subscribe = onAuthStateChanged(auth, checkOnAuthStateUser)
        return subscribe;
    }, [])

    return (
        <AuthContext.Provider value={userProvider}>
            {children}
        </AuthContext.Provider>
    )
}

export const useAuth = (): Auth => {
    const context = useContext(AuthContext)

    return context;
}

export const useProtectPage = ({ redirectTo = "/auth/login" }) => {
    const { isLogged } = useAuth()
    const router = useRouter()

    useEffect(() => {
        if (isLogged === false) {
            // Depois do login, volta para a página que a pessoa tentou abrir
            const back = router.asPath && router.asPath !== '/' ? `?next=${encodeURIComponent(router.asPath)}` : ''
            router.replace(`${redirectTo}${back}`)
        }
    }, [isLogged])
}

/** Telas de login/cadastro: quem já está logado vai para o início (ou para ?next=). */
export const useRedirectIfLogged = () => {
    const { isLogged } = useAuth()
    const router = useRouter()

    useEffect(() => {
        if (isLogged !== true) return
        const next = typeof router.query.next === 'string' && router.query.next.startsWith('/') && !router.query.next.startsWith('//')
            ? router.query.next
            : '/'
        router.replace(next)
    }, [isLogged])
}
