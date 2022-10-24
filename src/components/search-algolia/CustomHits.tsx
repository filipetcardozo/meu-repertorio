import Grid from '@mui/material/Grid';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import ListItemAvatar from '@mui/material/ListItemAvatar';
import Avatar from '@mui/material/Avatar';
import { useRouter } from 'next/router'

export const CustomHits = ({ hits }: any) => {
    const router = useRouter()

    return <>
        {
            hits.length > 0 ? hits.map((value: any, index: number) => {
                return <Grid item key={index} sx={{ p: 1 }}
                    xs={12}
                    sm={6}
                    lg={4}
                    xl={3}
                >
                    <ListItem
                        onClick={() => {
                            let newValue = {
                                composerId: value.composerId,
                                composerName: value.composerName,
                                lyricId: value.objectID,
                                lyricName: value.lyricName,
                                lyricStyle: value.lyricStyle,
                                originalTone: "A"
                            }
                            router.push(`/lyric/lyric-show/${value.objectID}`)
                        }}
                        key={index}
                        sx={{
                            padding: 2, backgroundColor: "#dff0ff", borderRadius: 2,
                            '&:hover': {
                                cursor: "pointer",
                                backgroundColor: "#d5ebff"
                            },
                        }}
                    >
                        <ListItemAvatar>
                            <Avatar>
                                {index + 1}
                            </Avatar>
                        </ListItemAvatar>
                        <ListItemText
                            primary={value.lyricName}
                            secondary={value.composerName}
                        />
                    </ListItem>
                </Grid>
            }) : <></>
        }
    </>
}