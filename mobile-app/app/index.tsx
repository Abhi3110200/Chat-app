"use client"

import React, { useEffect, useState } from "react"
import { View, Text, FlatList, TouchableOpacity, StyleSheet, StatusBar, TextInput, ActivityIndicator } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import axios from "axios"
import { useAuth } from "../context/AuthContext"
import { router, useFocusEffect } from "expo-router"
import getSocket from "../services/socket"
import { SafeAreaView } from "react-native-safe-area-context"
import { getStatusIcon } from "@/utils/messageUtils"

const API_URL = "https://chat-app-tvkg.onrender.com"

interface Message {
  _id: string
  content: string
  sender: string
  receiver: string
  conversationId: string
  createdAt: string
  read: boolean
  delivered: boolean
  status: 'sending' | 'sent' | 'delivered' | 'read' | 'error'
}

interface ChatItem {
  _id: string
  __v: number
  email: string
  name: string
  online: boolean
  lastMessage?: string
  lastMessageTime?: string
  unreadCount?: number
  avatar?: string
  status: string
}

export default function HomeScreen() {
  const { user, authToken, logout } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [chatList, setChatList] = useState<
    Array<{
      _id: string
      username: string
      name: string
      online: boolean
      lastMessage?: string | null
      lastMessageTime?: string | null
      status?: string
      unreadCount?: number
    }>
  >([])

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchChats = React.useCallback(async () => {
    if (!authToken) return;

    try {
      console.log("Fetching users...");
      const res = await axios.get(`${API_URL}/users`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      if (res.data && Array.isArray(res.data)) {
        // Ensure lastMessage is always a string
        const processedData = res.data.map(chat => ({
          ...chat,
          lastMessage: typeof chat.lastMessage === 'string' 
            ? chat.lastMessage 
            : chat.lastMessage?.text,
          lastMessageTime: chat.lastMessage?.createdAt || chat.lastMessageTime
        }));
        console.log("Processed data:", processedData);
        setChatList(processedData);
      } else {
        console.error("Unexpected response format:", res.data);
        setError('Failed to load chat list: Invalid response format');
      }
    } catch (error: any) {
      setError(`Error loading chats: ${error.message}`);
      console.error("Error fetching users:", {
        message: error.message,
        status: error.response?.status,
      });

      // If unauthorized, clear the token and redirect to login
      if (error.response?.status === 401) {
        logout();
      }
    }
  }, [authToken, logout]);

  // Function to load chats
  const loadChats = React.useCallback(() => {
    if (!authToken) {
      return;
    }
    
    setIsLoading(true);
    setError(null);
    fetchChats().finally(() => setIsLoading(false));
  }, [authToken, fetchChats]);

  // Initial load
  useEffect(() => {
    loadChats();
  }, [loadChats]);

  // Reload when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      loadChats();
    }, [loadChats])
  );

  // Socket setup and message handling
  useEffect(() => {
    if (!authToken || !user?._id) {
      return;
    }

    let socket: any;
    const eventListeners: Array<() => void> = [];

    const initializeSocket = async () => {
      try {
        socket = await getSocket();
        
        // Request initial unread counts
        socket.emit('getUnreadCounts', { userId: user._id }, (counts: Record<string, number>) => {
          setChatList(prev => 
            prev.map(chat => ({
              ...chat,
              unreadCount: counts[chat._id] || 0
            }))
          );
        });

        // Listen for user status updates
        const onStatusUpdate = (data: { userId: string; online: boolean }) => {
          const { userId, online } = data;
          console.log("User status update:", { userId, online });
          setChatList(prev => 
            prev.map(chat => 
              chat._id === userId ? { ...chat, online } : chat
            )
          );
        };

        // Listen for new messages
        const onNewMessage = (message: Message) => {
          console.log('New message received:', message);
          
          // For received messages
          if (message.sender !== user._id) {
            setChatList(prev => 
              prev.map(chat => 
                chat._id === message.sender
                  ? {
                      ...chat, 
                      unreadCount: (chat.unreadCount || 0) + 1,
                      lastMessage: message.content,
                      lastMessageTime: message.createdAt || new Date().toISOString()
                    }
                  : chat
              )
            );
          } 
          // For sent messages
          else if (message.receiver) {
            setChatList(prev => 
              prev.map(chat => 
                chat._id === message.receiver
                  ? {
                      ...chat,
                      lastMessage: message.content,
                      lastMessageTime: message.createdAt || new Date().toISOString()
                    }
                  : chat
              )
            );
          }
        };

        // Listen for read receipts
        const onMessagesRead = ({ conversationId }: { conversationId: string }) => {
          console.log('Messages read for conversation:', conversationId);
          setChatList(prev => 
            prev.map(chat => 
              chat._id === conversationId 
                ? { ...chat, unreadCount: 0 }
                : chat
            )
          );
        };

        // Add event listeners with consistent event names
        socket.on("user:status", onStatusUpdate);
        socket.on("message:new", onNewMessage);
        socket.on("messages:read", onMessagesRead);

        // Store cleanup functions
        eventListeners.push(
          () => {
            console.log('Cleaning up user:status listener');
            socket.off("user:status", onStatusUpdate);
          },
          () => {
            console.log('Cleaning up message:new listener');
            socket.off("message:new", onNewMessage);
          },
          () => {
            console.log('Cleaning up messages:read listener');
            socket.off("messages:read", onMessagesRead);
          }
        );

        // Return cleanup function
        return () => {
          console.log('Running socket cleanup');
          eventListeners.forEach(cleanup => {
            try {
              cleanup();
            } catch (err) {
              console.error('Error during cleanup:', err);
            }
          });
          
          if (socket) {
            console.log('Disconnecting socket');
            socket.disconnect();
          }
        };
      } catch (error) {
        console.error('Socket connection error:', error);
      }
    };

    // Initialize socket
    initializeSocket();

    // Cleanup function
    return () => {
      console.log('Running effect cleanup');
      eventListeners.forEach(cleanup => {
        try {
          cleanup();
        } catch (err) {
          console.error('Error during cleanup:', err);
        }
      });
      
      if (socket) {
        console.log('Disconnecting socket in effect cleanup');
        socket.disconnect();
      }
    };
  }, [authToken, user?._id]);

  // Render loading state
  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color="#4A90E2" />
        <Text style={styles.loadingText}>Loading chats...</Text>
      </SafeAreaView>
    );
  }

  // Render error state
  if (error) {
    return (
      <SafeAreaView style={[styles.container, styles.centerContent]}>
        <Ionicons name="warning-outline" size={48} color="#FF3B30" />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity 
          style={styles.retryButton}
          onPress={() => {
            setError(null);
            setIsLoading(true);
            fetchChats().finally(() => setIsLoading(false));
          }}
        >
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1A1A1A" />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Chats</Text>
        <TouchableOpacity style={styles.headerIcon} onPress={() => logout()}>
          <Ionicons name="log-out" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color="#8B8B8B" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search or start a new chat"
            placeholderTextColor="#8B8B8B"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      <FlatList
        data={chatList}
        keyExtractor={(item, index) => `${item._id}-${index}`}
        removeClippedSubviews={true}
        maxToRenderPerBatch={10}
        updateCellsBatchingPeriod={50}
        initialNumToRender={10}
        windowSize={10}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.chatItem}
            onPress={() =>
              router.push({
                pathname: "/chat/[id]",
                params: { id: item._id },
              } as any)
            }
          >
            <View style={styles.chatContent}>
              <View style={styles.avatarContainer}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{item.name[0]}</Text>
                </View>
                {item.online && <View style={styles.onlineIndicator} />}
              </View>

              <View style={styles.messageContent}>
                <View style={styles.messageHeader}>
                  <Text style={styles.username} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.lastMessageTime}>
                    {item.lastMessageTime ? new Date(item.lastMessageTime).toLocaleTimeString(
                      "en-US",
                      {
                        hour: "numeric",
                        minute: "numeric",
                        hour12: true,
                      },
                    ) : ''}
                  </Text>
                </View>
                <View style={styles.messageRow}>
                  {item.status && (
                    <Ionicons
                      name={getStatusIcon(item.status, item.online).name}
                      size={14}
                      color={getStatusIcon(item.status, item.online).color}
                      style={styles.statusIcon}
                    />
                  )}
                  <Text style={styles.lastMessage} numberOfLines={1}>
                    {item.lastMessage || 'No messages yet'}
                  </Text>
                </View>
              </View>
            </View>
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#1A1A1A" },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    color: '#888',
    marginTop: 16,
    fontSize: 16,
  },
  errorText: {
    color: '#FF3B30',
    textAlign: 'center',
    marginVertical: 16,
    fontSize: 16,
  },
  retryButton: {
    backgroundColor: '#4A90E2',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  header: {
    padding: 16,
    backgroundColor: "#1A1A1A",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  headerIcons: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerIcon: {
    marginLeft: 16,
  },
  searchContainer: {
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#2D2D2D",
    borderRadius: 20,
    paddingHorizontal: 12,
    height: 56,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: 16,
  },
  chatItem: {
    backgroundColor: "transparent",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: "#2D2D2D",
  },
  chatContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatarContainer: {
    position: "relative",
    marginRight: 12,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#4A9EFF",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    color: "#FFFFFF",
    fontWeight: "bold",
    fontSize: 18,
  },
  onlineIndicator: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#4ADE80",
    borderWidth: 2,
    borderColor: "#1A1A1A",
  },
  messageContent: {
    flex: 1,
    justifyContent: "center",
  },
  messageHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  username: {
    fontSize: 17,
    fontWeight: "600",
    color: "#FFFFFF",
    flex: 1,
    marginRight: 8,
  },
  lastMessageTime: {
    color: "#8B8B8B",
    fontSize: 13,
    fontWeight: "400",
  },
  messageRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  checkmark: {
    marginRight: 6,
  },
  statusIcon: {
    marginRight: 6,
  },
  lastMessage: {
    color: "#8B8B8B",
    fontSize: 15,
    flex: 1,
  },
})