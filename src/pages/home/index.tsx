import React, { useEffect } from 'react'
import styles from './style.module.scss'

// Components
import { Layout } from '../../components/app-layout'

// Redux
import { useDispatch, useSelector } from 'react-redux'

// Next
import { useRouter } from 'next/router'

// Authentication
import { useAuth } from '../../hooks/useAuth'
import { useProtectPage } from '../../hooks/useAuth'


const HomePage = () => {
    const { isLogged } = useAuth()

    useProtectPage({ redirectTo: "/login" })

    if (isLogged != true) {
        return <Layout activeMenu={0}>
            Carregando...
        </ Layout>
    }

    return <Layout activeMenu={0}>
        Page loaded
        {/* <HomeLyrics /> */}
    </ Layout>



}

export default HomePage;