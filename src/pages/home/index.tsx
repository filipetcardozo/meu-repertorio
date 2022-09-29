import React from 'react'
import styles from './style.module.scss'

// Components
import { LyricCard } from '../../components/lyrics-components/lyric-card'
import { Layout } from '../../components/layout'

const HomePage = () => {
    return <Layout>
        <h1>Home Page</h1>
        <LyricCard />
    </Layout>
}

export default HomePage;