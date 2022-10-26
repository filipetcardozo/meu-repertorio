/* eslint-disable react-hooks/exhaustive-deps */
import { profile } from 'console'
import React, { useEffect, useState } from 'react'
import { profileConfigsType } from '../types/localStorageProfileConfigsType'
import { useAuth } from "./useAuth"

export const useStorageProfileConfigs = () => {
    const { uid } = useAuth()

    const [profileConfigs, setProfileConfigs] = useState<profileConfigsType>()

    useEffect(() => {
        if (uid) {
            setProfileConfigs(getProfileConfigs())
        }
    }, [uid])

    const getProfileConfigs = (): profileConfigsType | undefined => {
        let pConfigs = localStorage.getItem("profile-configs-" + uid)
        if (pConfigs) {
            return JSON.parse(pConfigs) as profileConfigsType
        } else {
            putProfileConfigs({ expandedSidebar: true, userId: uid! })
            return { expandedSidebar: true, userId: uid! }
        }
    }

    const putProfileConfigs = (pConfigs: profileConfigsType) => {
        let newProfileConfigs = JSON.stringify(pConfigs)
        localStorage.setItem("profile-configs-" + pConfigs.userId, newProfileConfigs);
        setProfileConfigs(profileConfigs)
    }

    const changeSidebar = (newState: boolean) => {
        if (profileConfigs) {
            profileConfigs.expandedSidebar = newState
            setProfileConfigs({ ...profileConfigs })
            putProfileConfigs(profileConfigs)
        }
    }

    return {
        profileConfigs,
        changeSidebar
    }
}