import * as React from 'react';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import IconButton from '@mui/material/IconButton';
import DeleteIcon from '@mui/icons-material/Delete';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Avatar from '@mui/material/Avatar';
import { alpha } from '@mui/material/styles';
import { lyricInSheetMusicType } from '../../types/sheetMusicType';

type Props = {
  lyrics: lyricInSheetMusicType[];
  setLyrics: React.Dispatch<React.SetStateAction<lyricInSheetMusicType[]>>;
  handleDeleteMusicSheet: (index: number) => void;
};

export const ListSheetMusic: React.FC<Props> = ({ lyrics, setLyrics, handleDeleteMusicSheet }) => {
  function handleOnDragEnd(result: any) {
    if (!result.destination) return;

    const items = Array.from(lyrics);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    setLyrics(items);
  }

  if (!lyrics?.length) return null;

  return (
    <DragDropContext onDragEnd={handleOnDragEnd}>
      <Droppable droppableId="lyrics">
        {(provided) => (
          <List {...provided.droppableProps} ref={provided.innerRef} sx={{ p: 0 }}>
            {lyrics.map((lyric, index) => (
              <Draggable key={lyric.lyricId} draggableId={lyric.lyricId} index={index}>
                {(provided) => (
                  <ListItem
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    {...provided.dragHandleProps}
                    sx={(theme) => ({
                      mb: 1.5,
                      py: 1,
                      px: 1.25,
                      borderRadius: 2,
                      backgroundColor: alpha(
                        theme.palette.primary.main,
                        theme.palette.mode === 'dark' ? 0.10 : 0.06
                      ),
                      border: `1px solid ${alpha(
                        theme.palette.primary.main,
                        theme.palette.mode === 'dark' ? 0.22 : 0.14
                      )}`,
                      boxShadow: 1,
                      transition: theme.transitions.create(['background-color', 'box-shadow'], {
                        duration: theme.transitions.duration.shortest,
                      }),
                      '&:hover': {
                        backgroundColor: alpha(
                          theme.palette.primary.main,
                          theme.palette.mode === 'dark' ? 0.18 : 0.12
                        ),
                        boxShadow: 2,
                        cursor: 'grab',
                      },
                      '&:active': {
                        cursor: 'grabbing',
                      },
                    })}
                    secondaryAction={
                      <IconButton
                        edge="end"
                        aria-label="delete"
                        size="small"
                        onClick={() => handleDeleteMusicSheet(index)}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    }
                  >
                    {/* Índice */}
                    <Box sx={{ width: 40, mr: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Avatar
                        sx={(theme) => ({
                          width: 28,
                          height: 28,
                          fontSize: 13,
                          fontWeight: 600,
                          bgcolor: alpha(
                            theme.palette.primary.main,
                            theme.palette.mode === 'dark' ? 0.30 : 0.18
                          ),
                          color: theme.palette.primary.contrastText,
                        })}
                      >
                        {index + 1}
                      </Avatar>
                    </Box>

                    <ListItemText
                      primary={lyric.lyricName}
                      secondary={`${lyric.composerName}${lyric.originalTone ? ` (${lyric.originalTone})` : ''}`}
                      primaryTypographyProps={{
                        variant: 'subtitle1',
                        color: 'text.primary',
                        fontWeight: 600,
                        lineHeight: 1.2,
                      }}
                      secondaryTypographyProps={{
                        variant: 'body2',
                        color: 'text.secondary',
                      }}
                      sx={{ mr: 5 }} // espaço para o secondaryAction
                    />
                  </ListItem>
                )}
              </Draggable>
            ))}
            {provided.placeholder}
          </List>
        )}
      </Droppable>
    </DragDropContext>
  );
};
