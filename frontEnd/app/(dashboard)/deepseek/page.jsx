"use client";

import * as React from 'react';
import { 
  Box, 
  TextField, 
  Button, 
  List, 
  ListItem, 
  ListItemText, 
  Typography, 
  CircularProgress,
  Divider
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';

export default function DeepSeekPage() {
  const [messages, setMessages] = React.useState([]);
  const [inputText, setInputText] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  const ws = React.useRef(null);

  React.useEffect(() => {
    // 连接到后端WebSocket
    ws.current = new WebSocket(`ws://132.181.62.177:10188/ws`);
    
    ws.current.onmessage = (event) => {
      const response = JSON.parse(event.data);
      if (response.type === 'deepseek_response') {
        setMessages(prev => [...prev, {
          content: response.data,
          isBot: true,
          timestamp: new Date().toLocaleTimeString()
        }]);
        setIsLoading(false);
      }
    };

    return () => ws.current.close();
  }, []);

  const handleSend = async () => {
    if (!inputText.trim()) return;

    // 添加用户消息
    setMessages(prev => [...prev, {
      content: inputText,
      isBot: false,
      timestamp: new Date().toLocaleTimeString()
    }]);
    
    // 发送到后端
    setIsLoading(true);
    ws.current.send(JSON.stringify({
      action: "deepseek_chat",
      message: inputText
    }));
    
    setInputText('');
  };

  return (
    <Box sx={{ 
      maxWidth: 800, 
      margin: 'auto', 
      height: '80vh',
      display: 'flex',
      flexDirection: 'column'
    }}>
      <Typography variant="h4" gutterBottom>
        DeepSeek Assistant
      </Typography>
      
      <List sx={{ 
        flexGrow: 1,
        overflow: 'auto',
        bgcolor: 'background.paper'
      }}>
        {messages.map((msg, index) => (
          <React.Fragment key={index}>
            <ListItem alignItems="flex-start">
              <ListItemText
                primary={msg.isBot ? "DeepSeek" : "You"}
                secondary={
                  <Typography
                    component="span"
                    variant="body2"
                    color="text.primary"
                    dangerouslySetInnerHTML={{ 
                      __html: msg.content.replace(/\n/g, '<br />') 
                    }}
                  />
                }
                sx={{
                  textAlign: msg.isBot ? 'left' : 'right',
                  backgroundColor: msg.isBot ? '#f5f5f5' : '#e3f2fd',
                  borderRadius: 2,
                  p: 2,
                  maxWidth: '70%',
                  ml: msg.isBot ? 0 : 'auto'
                }}
              />
            </ListItem>
            <Divider variant="inset" component="li" />
          </React.Fragment>
        ))}
        {isLoading && (
          <ListItem>
            <CircularProgress size={24} />
          </ListItem>
        )}
      </List>

      <Box sx={{ 
        display: 'flex', 
        gap: 2, 
        pt: 2,
        position: 'sticky',
        bottom: 0,
        bgcolor: 'background.default'
      }}>
        <TextField
          fullWidth
          variant="outlined"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Ask me anything..."
          disabled={isLoading}
        />
        <Button
          variant="contained"
          onClick={handleSend}
          disabled={isLoading}
          endIcon={<SendIcon />}
        >
          send
        </Button>
      </Box>
    </Box>
  );
}