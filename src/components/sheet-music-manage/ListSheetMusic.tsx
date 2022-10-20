import React, { useState } from 'react';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
// import './App.css';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemAvatar from '@mui/material/ListItemAvatar';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Avatar from '@mui/material/Avatar';
import IconButton from '@mui/material/IconButton';
import DeleteIcon from '@mui/icons-material/Delete';
import Box from '@mui/material/Box'
import MoreVertIcon from '@mui/icons-material/MoreVert';
import Typography from '@mui/material/Typography'

export const ListSheetMusic = ({ lyrics, setLyrics, handleDeleteMusicSheet }: any) => {
    function handleOnDragEnd(result: any) {
        if (!result.destination) return;

        const items = Array.from(lyrics);
        const [reorderedItem] = items.splice(result.source.index, 1);
        items.splice(result.destination.index, 0, reorderedItem);

        setLyrics(items);
    }

    return (
        <DragDropContext onDragEnd={handleOnDragEnd}>
            <Droppable droppableId="characters">
                {(provided) => (
                    <List className="characters" {...provided.droppableProps} ref={provided.innerRef}>
                        {lyrics.map((lyric: any, index: any) => {
                            return (
                                <Draggable key={lyric.lyricId} draggableId={lyric.lyricId} index={index}>
                                    {(provided) => (
                                        <ListItem
                                            ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps}
                                            sx={{
                                                padding: 2, mb: 2, backgroundColor: "#eaf0f5", borderRadius: 2, boxShadow: 1,
                                                '&:hover': {
                                                    boxShadow: 2,
                                                    backgroundColor: "#dfefff",
                                                    cursor: "pointer"
                                                },
                                                '&:active': {
                                                    backgroundColor: "#dfefff"
                                                }

                                            }}
                                            secondaryAction={
                                                <IconButton size="small" onClick={(() => handleDeleteMusicSheet(index))} edge="end" aria-label="delete">
                                                    <DeleteIcon style={{ fontSize: 19 }} />
                                                </IconButton>
                                            }
                                        >
                                            <MoreVertIcon style={{ fontSize: 16, position: "relative", right: 16, color: "#bdbdbd" }} />
                                            <Box display="flex" width={60} alignItems="center">
                                                <Typography variant="h6">
                                                    {index + 1}
                                                </Typography>
                                            </Box>
                                            <ListItemText
                                                primary={lyric.lyricName}
                                                secondary={lyric.composerName + " (" + lyric.originalTone + ")"}
                                            />
                                        </ListItem>
                                    )}
                                </Draggable>
                            );
                        })}
                        {provided.placeholder}
                    </List>
                )}
            </Droppable>
        </DragDropContext>
    );
}