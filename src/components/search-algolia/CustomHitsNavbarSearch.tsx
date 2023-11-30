import Grid from '@mui/material/Grid';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import ListItemAvatar from '@mui/material/ListItemAvatar';
import Avatar from '@mui/material/Avatar';
import { useRouter } from 'next/router'

export const CustomHitsNavbarSearch = ({ hits, closePopper }: any) => {
  const router = useRouter()

  return <>
    {
      hits.length > 0 ? hits.map((value: any, index: number) => {
        return <Grid item key={index} sx={{ p: 0.5 }} xs={6}
        >
          <ListItem
            onClick={() => {
              closePopper();
              router.push(`/lyric/lyric-show/${value.objectID}`, undefined, { shallow: true })
            }}
            key={index}
            sx={{
              padding: 0.5, backgroundColor: "#dff0ff", borderRadius: 2,
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