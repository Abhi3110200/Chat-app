"use client"

import { useEffect, useState, useRef } from "react"
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  Pressable,
  ActivityIndicator,
  FlatList,
  Animated,
  Easing,
  ViewToken,
} from "react-native"
import { useAuth } from "../../context/AuthContext"
import { useLocalSearchParams, useRouter } from "expo-router"
import axios from "axios"
import getSocket from "../../services/socket"
import { LegendList } from "@legendapp/list"
import { SafeAreaView } from "react-native-safe-area-context"
import { Ionicons } from "@expo/vector-icons"

const API_URL = "https://chat-app-tvkg.onrender.com"

interface User {
  _id: string
  email: string
  name: string
  online: boolean
  lastSeen?: string | Date | null
  __v?: number
}

interface Message {
  _id: string
  text: string
  sender: string | { _id: string; name?: string }
  receiver: string
  type: "sender" | "receiver"
  createdAt: string
  status: "sending" | "sent" | "delivered" | "read" | "error"
  read: boolean
  delivered: boolean
  readAt?: string | null
  deliveredAt?: string | null
  readBy?: Array<{ user: string; readAt: string }>
}

export default function ChatScreen() {
  const { user, authToken } = useAuth()
  const router = useRouter()
  const { id: chatUserId } = useLocalSearchParams()
  console.log(user, chatUserId)

  const [messages, setMessages] = useState<Message[]>([])
  const [chatUser, setChatUser] = useState<User | null>(null)
  const [state, setState] = useState({
    text: "",
    isLoading: true,
    isUserOnline: false,
    isTyping: false,
    typingTimeout: null as NodeJS.Timeout | null,
  })

  // Fetch chat user details
  useEffect(() => {
    const fetchChatUser = async () => {
      try {
        const response = await axios.get<User>(`${API_URL}/users/${chatUserId}`, {
          headers: { Authorization: `Bearer ${authToken}` },
        })

        console.log("Fetched chat user:", response.data)

        // Update chatUser state with all user data
        setChatUser({
          _id: response.data._id,
          email: response.data.email,
          name: response.data.name,
          online: response.data.online || false,
        })

        // Also update the online status in the state
        setState((prev) => ({
          ...prev,
          isUserOnline: response.data.online || false,
        }))
      } catch (error) {
        console.error("Error fetching chat user:", error)
      }
    }

    if (chatUserId && authToken) {
      fetchChatUser()
    }
  }, [chatUserId, authToken])

  // Handle typing indicator from other users
  useEffect(() => {
    let socket: any
    let typingTimeout: NodeJS.Timeout

    const setupTypingListener = async () => {
      try {
        socket = await getSocket()

        // Handle incoming typing events
        const handleTyping = (data: {
          userId: string;
          isTyping: boolean;
          chatId: string;
          userName?: string;
          timestamp: number;
        }) => {
          console.log("Typing event received:", data)

          // Make sure this typing event is for the current chat
          if (data.userId === chatUserId) {
            // Clear any existing timeout
            if (typingTimeout) {
              clearTimeout(typingTimeout)
            }

            // Only update if the event is for the current user
            if (data.chatId === user?._id) {
              setState((prev) => ({ ...prev, isTyping: data.isTyping }))

              // Auto-hide typing indicator after 3 seconds
              if (data.isTyping) {
                typingTimeout = setTimeout(() => {
                  setState((prev) => ({ ...prev, isTyping: false }))
                }, 3000) as unknown as NodeJS.Timeout
              }
            }
          }
        }

        // Listen for typing events
        socket.on("typing", handleTyping)

        // Listen for message read events
        socket.on("message:read", (data: { messageId: string; userId: string }) => {
          if (data.userId === chatUserId) {
            // Update message status to 'read' in the UI
            setMessages((prev) => prev.map((msg) => (msg._id === data.messageId ? { ...msg, status: "read" } : msg)))
          }
        })
      } catch (error) {
        console.error("Error setting up socket listeners:", error)
      }
    }

    setupTypingListener()

    return () => {
      if (socket) {
        socket.off("typing")
      }
      if (typingTimeout) {
        clearTimeout(typingTimeout)
      }
    }
  }, [user?._id, chatUserId])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (state.typingTimeout) {
        clearTimeout(state.typingTimeout)
      }
    }
  }, [state.typingTimeout])

  // Update online status when chatUser changes
  useEffect(() => {
    if (chatUser) {
      setState((prev) => ({
        ...prev,
        isUserOnline: chatUser.online,
      }))
    }
  }, [chatUser])

  // Mark messages as read when the chat is opened
  useEffect(() => {
    const markMessagesAsRead = async () => {
      if (messages.length > 0 && chatUser) {
        const unreadMessages = messages.filter(
          (msg) => !msg.read && typeof msg.sender !== 'string' && msg.sender._id === chatUser._id
        )

        if (unreadMessages.length > 0) {
          // Update local state
          const updatedMessages = messages.map((msg) => {
            if (!msg.read && typeof msg.sender !== 'string' && msg.sender._id === chatUser._id) {
              return { ...msg, read: true, status: 'read' as const }
            }
            return msg
          })
          setMessages(updatedMessages)

          // Emit read receipt
          try {
            const socket = await getSocket()
            socket.emit('markAsRead', {
              messageIds: unreadMessages.map((msg) => msg._id),
              conversationId: chatUser._id,
              readerId: user?._id,
            })
          } catch (error) {
            console.error('Error marking messages as read:', error)
          }
        }
      }
    }

    markMessagesAsRead()
  }, [messages, chatUser, user?._id])

  useEffect(() => {
    let socket: any

    const setupSocket = async () => {
      try {
        // Initialize socket connection
        socket = await getSocket()

        // Notify server that user is connected
        if (user?._id) {
          socket.emit("user:connect", user._id)
        }

        // Join room for this conversation
        socket.emit("join", { userId: user?._id, chatUserId })

        // Set up socket listeners
        const handleNewMessage = (msg: Message) => {
          setMessages((prev) => [...prev, msg])
        }

        // Listen for online status updates
        const handleOnlineStatus = (status: {
          userId: string;
          online: boolean;
          lastSeen?: Date | string | null
        }) => {
          console.log("Received status update:", status)
          if (status.userId === chatUserId) {
            // Update both the local state and chatUser state
            setState((prev) => ({ ...prev, isUserOnline: status.online }))

            // Update chatUser with all current properties plus the new online status
            setChatUser((prev) => {
              if (!prev) return null;

              // Safely handle lastSeen conversion to string
              let lastSeenValue: string | null = null;
              if (status.lastSeen) {
                lastSeenValue = typeof status.lastSeen === 'string'
                  ? status.lastSeen
                  : status.lastSeen.toISOString();
              }

              return {
                ...prev,
                online: status.online,
                ...(status.lastSeen !== undefined && {
                  lastSeen: lastSeenValue,
                }),
              };
            })

            console.log("Updated chat user status:", {
              userId: status.userId,
              online: status.online,
              lastSeen: status.lastSeen,
            })
          }
        }

        // Set up socket listeners with correct event names
        socket.on("message:new", handleNewMessage)
        socket.on("user:status", handleOnlineStatus)

        // Handle message status updates
        socket.on("message:status", (update: {
          messageId: string;
          status: 'sent' | 'delivered' | 'read' | 'error';
          deliveredAt?: string;
          readAt?: string;
        }) => {
          setMessages(prev => prev.map(msg => {
            if (msg._id === update.messageId) {
              // Only update if the new status is more recent than current status
              const statusOrder = ['error', 'sending', 'sent', 'delivered', 'read'];
              const currentStatusIndex = statusOrder.indexOf(msg.status);
              const newStatusIndex = statusOrder.indexOf(update.status);

              if (newStatusIndex > currentStatusIndex) {
                const updatedMsg = { ...msg, status: update.status };

                // Update timestamps and flags based on status
                switch (update.status) {
                  case 'delivered':
                    updatedMsg.delivered = true;
                    updatedMsg.deliveredAt = update.deliveredAt || new Date().toISOString();
                    break;
                  case 'read':
                    updatedMsg.read = true;
                    updatedMsg.readAt = update.readAt || new Date().toISOString();
                    break;
                  case 'error':
                    console.error(`Message ${update.messageId} failed to send`);
                    break;
                  default:
                    break;
                }

                return updatedMsg;
              }
            }
            return msg;
          }));
        });

        // Request initial online status after a short delay to ensure socket is ready
        setTimeout(() => {
          console.log("Requesting initial status for user:", chatUserId)
          socket.emit("user:status", { userId: chatUserId }, (response: any) => {
            console.log("Initial status response:", response)
            if (response && response.online !== undefined) {
              setState(prev => ({ ...prev, isUserOnline: response.online }))
            }
          })
        }, 1000)

        const fetchMessages = async () => {
          try {
            const response = await axios.get(`${API_URL}/messages/${chatUserId}`, {
              headers: { Authorization: `Bearer ${authToken}` },
              params: { populate: "sender" },
            })

            const processedMessages = response.data.map((msg: any) => ({
              ...msg,
              sender: typeof msg.sender === "string" ? { _id: msg.sender } : msg.sender,
            }))

            setMessages(processedMessages)
          } catch (error) {
            console.error("Error fetching messages:", error)
          } finally {
            setState((prev) => ({ ...prev, isLoading: false }))
          }
        }

        fetchMessages()

        return () => {
          if (socket) {
            socket.off("message:new", handleNewMessage)
            socket.off("user:status", handleOnlineStatus)
            socket.emit("leave", { userId: user?._id, chatUserId })
          }
        }
      } catch (error) {
        console.error("Socket setup error:", error)
        setState((prev) => ({ ...prev, isLoading: false }))
      }
    }

    setupSocket()

    return () => {
      if (socket) {
        socket.off("message:new")
      }
    }
  }, [chatUserId, authToken, user?._id])

  const handleTextChange = async (text: string) => {
    setState((prev) => ({ ...prev, text }))

    // Only emit typing events if there's text and we're not already typing
    if (text.trim().length > 0) {
      try {
        const socket = await getSocket()

        // Clear any existing timeout
        if (state.typingTimeout) {
          clearTimeout(state.typingTimeout)
        } else {
          // Only emit start typing if we weren't already typing
          socket.emit("typing", {
            chatId: chatUserId,
            isTyping: true,
            userId: user?._id,
            userName: user?.name,
            timestamp: Date.now()
          })
        }

        // Set a timeout to stop typing indicator after 2 seconds of inactivity
        const timeout = setTimeout(async () => {
          const socket = await getSocket()
          socket.emit("typing", {
            chatId: chatUserId,
            isTyping: false,
            userId: user?._id,
            userName: user?.name,
            timestamp: Date.now()
          })
          setState(prev => ({ ...prev, typingTimeout: null }))
        }, 2000)

        setState((prev) => ({
          ...prev,
          typingTimeout: timeout as unknown as NodeJS.Timeout,
        }))
      } catch (error) {
        console.error("Error emitting typing event:", error)
      }
    } else if (state.typingTimeout) {
      // If text is empty and we have a typing timeout, clear it and send stop typing
      clearTimeout(state.typingTimeout)
      try {
        const socket = await getSocket()
        socket.emit("typing", {
          chatId: chatUserId,
          isTyping: false,
          userId: user?._id,
          userName: user?.name,
          timestamp: Date.now()
        })
      } catch (error) {
        console.error("Error sending stop typing:", error)
      }
      setState(prev => ({ ...prev, typingTimeout: null }))
    }
  }

  const sendMessage = async () => {
    if (!state.text.trim() || !chatUserId) {
      console.log("Cannot send message: missing required fields", {
        hasText: !!state.text.trim(),
        hasChatUserId: !!chatUserId,
        userObject: user,
      })
      return
    }

    // Clear typing indicator when sending a message
    if (state.typingTimeout) {
      clearTimeout(state.typingTimeout)
      setState((prev) => ({ ...prev, typingTimeout: null }))
    }

    // Generate tempId outside try-catch to ensure it's in scope for both
    const tempId = `temp-${Date.now()}`

    try {
      const socket = await getSocket()
      // Notify that user has stopped typing
      socket.emit("typing", {
        chatId: chatUserId,
        isTyping: false,
        userId: user?._id,
        userName: user?.name,
        timestamp: Date.now()
      })

      const messageData = {
        text: state.text.trim(),
        senderId: user?._id,
        receiverId: chatUserId,
        type: "sender" as const,
        status: "sending" as const,
        read: false,
        delivered: false,
        createdAt: new Date().toISOString(),
      }

      // Clear input immediately when sending message
      setState(prev => ({ ...prev, text: "" }));

      // Send message via socket
      socket.emit("message:send", messageData, (acknowledgement: any) => {
        console.log("Server acknowledgement:", acknowledgement)
      })
    } catch (error) {
      console.error('Error storing last opened chat:', error);
    }
  };

  // Helper function to get sender ID
  const getSenderId = (sender: string | { _id: string; name?: string }): string => {
    return typeof sender === "string" ? sender : sender._id;
  }

  const renderMessage = ({ item }: { item: Message }) => {
    // Check if the message is from the current user
    const isCurrentUser = getSenderId(item.sender) === user?._id

    // Render message status indicators
    const renderStatusIndicator = () => {
      if (!isCurrentUser) return null;

      // If message is read (blue double ticks)
      if (item.status === 'read') {
        return (
          <View style={{ flexDirection: 'row', marginLeft: 4, alignItems: 'center' }}>
            <Ionicons name="checkmark-done" size={16} color="green" />
          </View>
        );
      }

      // If message is delivered but not read (gray double ticks)
      if (item.status === 'delivered') {
        return (
          <View style={{ flexDirection: 'row', marginLeft: 4, alignItems: 'center' }}>
            <Ionicons name="checkmark-done" size={16} color="rgba(255, 255, 255, 0.5)" />
          </View>
        );
      }

      // If message is sent but not delivered (single gray tick)
      if (item.status === 'sent') {
        return (
          <View style={{ marginLeft: 4 }}>
            <Ionicons name="checkmark" size={16} color="rgba(255, 255, 255, 0.5)" />
          </View>
        );
      }

      // If message is still sending (clock icon)
      return (
        <View style={{ marginLeft: 4 }}>
          <Ionicons name="time-outline" size={16} color="rgba(255, 255, 255, 0.3)" />
        </View>
      );
    };

    return (
      <View style={[styles.messageContainer, isCurrentUser ? styles.senderMessage : styles.receiverMessage]}>
        <Text style={{ color: isCurrentUser ? "#FFFFFF" : "#FFFFFF", marginBottom: 4, fontSize: 16 }}>{item.text}</Text>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <Text
            style={{
              color: "rgba(255, 255, 255, 0.7)",
              fontSize: 12,
            }}
          >
            {item.createdAt
              ? new Date(item.createdAt).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })
              : ""}
          </Text>
          {isCurrentUser && renderStatusIndicator()}
        </View>
      </View>
    )
  }

  if (state.isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FFFFFF" />
      </View>
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <StatusBar barStyle="light-content" backgroundColor="#1A1A1A" />
      {/* User info and online status */}
      <View style={styles.header}>
        <Ionicons name="arrow-back" size={24} color="#FFFFFF" onPress={() => router.back()} />
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{chatUser?.name?.[0] || "?"}</Text>
        </View>
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{chatUser?.name || "Loading..."}</Text>
          <View style={styles.statusRow}>
            <View style={styles.statusContainer}>
              {state.isUserOnline && <View style={[styles.statusIndicator, { backgroundColor: state.isUserOnline ? "#4A9EFF" : "#8B8B8B" }]} />}
              <Text style={styles.statusText}>
                {state.isUserOnline
                  ? state.isTyping
                    ? "typing..."
                    : "Online"
                  : chatUser?.lastSeen
                    ? `Last seen ${new Date(chatUser.lastSeen).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                    : "Offline"}
              </Text>
            </View>
          </View>
        </View>
      </View>


      <LegendList
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item: Message, index: number) => `${item._id}-${index}`}
        contentContainerStyle={styles.messagesContainer}
        estimatedItemSize={100}
        recycleItems={true}
        showsVerticalScrollIndicator={true}
        alignItemsAtEnd
        maintainScrollAtEnd
        maintainScrollAtEndThreshold={0.5}
        maintainVisibleContentPosition
        initialScrollIndex={messages.length - 1}
        ListEmptyComponent={<Text style={styles.emptyListText}>No messages yet</Text>}
      />


      <KeyboardAvoidingView
        behavior="padding"
        // style={{ flex: 1 }}
      >
        <View style={styles.inputContainer}>
          <TextInput
            style={{ minHeight: 40, color: "#FFFFFF", flexGrow: 1, flexShrink: 1 }}
            value={state.text}
            onChangeText={handleTextChange}
            placeholder="Type a message..."
            placeholderTextColor="#8B8B8B"
            multiline
          />
          <Pressable
            style={[styles.sendButton, !state.text.trim() && styles.sendButtonDisabled]}
            onPress={sendMessage}
            disabled={!state.text.trim()}
          >
            <Ionicons name="paper-plane-outline" size={24} color={state.text.trim() ? "#FFFFFF" : "#8B8B8B"} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>

    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1A1A1A",
  },
  messagesWrapper: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#1A1A1A",
    borderBottomWidth: 1,
    borderBottomColor: "#404040",
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#4A9EFF",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 12,
  },
  avatarText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  userInfo: {
    marginLeft: 12,
    flex: 1,
  },
  userName: {
    fontWeight: "600",
    fontSize: 16,
    color: "#FFFFFF",
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  statusContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 8,
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    color: "#8B8B8B",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#1A1A1A",
  },
  messagesContainer: {
    padding: 4,
    paddingBottom: 5,
  },
  messageContainer: {
    maxWidth: "80%",
    padding: 12,
    borderRadius: 16,
    marginVertical: 3,
    marginHorizontal: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  messageFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    marginTop: 4,
  },
  messageTime: {
    fontSize: 10,
    opacity: 0.7,
  },
  statusIcon: {
    fontSize: 12,
    lineHeight: 12,
  },
  senderMessage: {
    alignSelf: "flex-end",
    backgroundColor: "#4A9EFF",
    borderTopRightRadius: 4,
  },
  receiverMessage: {
    alignSelf: "flex-start",
    backgroundColor: "#2D2D2D",
    borderTopLeftRadius: 4,
  },
  keyboardAvoidingView: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
  },
  inputContainer: {
    flexDirection: "row",
    padding: 12,
    marginBottom: 12,
    marginHorizontal: 12,
    backgroundColor: "#2D2D2D",
    borderWidth: 1,
    borderColor: "#404040",
    borderRadius: 25,
    gap: 12,
    alignItems: "center",
  },
  input: {
    flex: 1,
    backgroundColor: "#2D2D2D",
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingTop: 10,
    paddingBottom: 10,
    marginRight: 5,
    fontSize: 16,
    maxHeight: 100,
    color: "#FFFFFF",
  },
  sendButton: {
    height: 40,
    borderRadius: 20,
    width: 40,
    backgroundColor: "#4A9EFF",
    justifyContent: "center",
    alignItems: "center",
  },
  sendButtonDisabled: {
    backgroundColor: "#404040",
  },
  sendButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  typingText: {
    fontSize: 12,
    color: "#8B8B8B",
    fontStyle: "italic",
    marginLeft: 8,
  },
  emptyListText: {
    color: "#8B8B8B",
    textAlign: "center",
    marginTop: 20,
  },
})
