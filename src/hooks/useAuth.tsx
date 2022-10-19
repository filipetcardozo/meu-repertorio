/* eslint-disable react-hooks/exhaustive-deps */

import { onAuthStateChanged, signInWithEmailAndPassword, User, signOut as callSignOut, getAuth, setPersistence, browserLocalPersistence } from "firebase/auth";
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { firebaseApp } from "../../firebaseConfig";
import { useRouter } from 'next/router'
import { CollectionsBookmarkOutlined, ConstructionOutlined, Router } from "@mui/icons-material";
import { isSymbolObject } from "util/types";

interface Auth {
    isLogged: boolean | undefined;
    loading: boolean;
    error?: string;
    uid?: string;
    user?: User;
    signIn(value: SignIn): void;
    signUp(value: any): void;
    signOut(): void;
}

interface SignIn {
    email: string;
    password: string;
}

type Props = {
    children?: React.ReactNode;
};

const AuthContext = createContext<Auth>({} as Auth)

export const AuthProvider: React.FC<Props> = ({ children }) => {
    const [isLogged, setIsLogged] = useState<boolean | undefined>()
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState("")
    const [uid, setUid] = useState("")
    const [user, setUser] = useState<User>()
    const router = useRouter()

    const auth = getAuth(firebaseApp);

    function signIn(credentials: SignIn) {
        setLoading(true)

        signInWithEmailAndPassword(auth, credentials.email, credentials.password)
            .then(() => {
                router.push("/home")
            })
            .catch((err) => {
                console.log("Error in loggin: ", err)
            })
            .finally(() => {
                setLoading(false)
                console.log("Logged")
            })
    }

    function signUp() {
        console.log("Function user sign up called")
    }

    function signOut() {
        callSignOut(auth)
            .then(() => {
                setIsLogged(false)
                router.push("/login")
            })
            .catch((error) => {
                console.log(error)
            });
    }

    function checkOnAuthStateUser(user: User | null) {
        if (user) {
            setUser(user)
            setUid(user.uid)
            setIsLogged(true)
        } else {
            setUser(undefined)
            setIsLogged(false)
        }

        setLoading(false)
    }

    const userProvider = useMemo((): Auth => ({
        isLogged,
        loading,
        error,
        user,
        uid,
        signIn,
        signOut,
        signUp,
    }), [isLogged, loading, error, uid, user])

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

export const useProtectPage = ({ redirectTo = "/login" }) => {
    const { isLogged } = useAuth()
    const router = useRouter()

    useEffect(() => {
        if (isLogged === false) {
            router.push(redirectTo)
        }
    }, [isLogged])
}