import { useState, useCallback, useEffect } from 'react';
import { searchUsers } from '@/features/social/socialService';

interface UserSuggestion {
    id: string;
    displayName: string;
    username?: string;
}

interface UseUserTaggingProps {
    onTextChange: (text: string) => void;
}

export const useUserTagging = ({ onTextChange }: UseUserTaggingProps) => {
    const [showUserSuggestions, setShowUserSuggestions] = useState(false);
    const [userSuggestions, setUserSuggestions] = useState<UserSuggestion[]>([]);
    const [currentMentionStart, setCurrentMentionStart] = useState(-1);
    const [currentMentionQuery, setCurrentMentionQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);

    const handleTextChange = useCallback(async (text: string, cursorPosition?: number) => {
        onTextChange(text);

        // Find @ mentions in the text
        const mentionRegex = /@(\w*)/g;
        let match;
        let foundMention = false;

        while ((match = mentionRegex.exec(text)) !== null) {
            const mentionStart = match.index;
            const mentionEnd = mentionStart + match[0].length;

            // Check if cursor is within this mention
            if (cursorPosition !== undefined &&
                cursorPosition >= mentionStart &&
                cursorPosition <= mentionEnd) {
                foundMention = true;
                const query = match[1]; // The part after @

                setCurrentMentionStart(mentionStart);
                setCurrentMentionQuery(query);

                if (query.length > 0) {
                    setIsSearching(true);
                    try {
                        const users = await searchUsers(query);
                        setUserSuggestions(users);
                        setShowUserSuggestions(true);
                    } catch (error) {
                        console.error('Error searching users:', error);
                        setUserSuggestions([]);
                    } finally {
                        setIsSearching(false);
                    }
                } else {
                    setShowUserSuggestions(false);
                    setUserSuggestions([]);
                }
                break;
            }
        }

        if (!foundMention) {
            setShowUserSuggestions(false);
            setCurrentMentionStart(-1);
            setCurrentMentionQuery('');
            setUserSuggestions([]);
        }
    }, [onTextChange]);

    const selectUser = useCallback((user: UserSuggestion, currentText: string) => {
        if (currentMentionStart === -1) return currentText;

        // Replace the @ mention with the selected user
        const beforeMention = currentText.substring(0, currentMentionStart);
        const afterMention = currentText.substring(
            currentMentionStart + currentMentionQuery.length + 1
        );

        const newText = `${beforeMention}@${user.displayName} ${afterMention}`;

        // Reset mention state
        setShowUserSuggestions(false);
        setCurrentMentionStart(-1);
        setCurrentMentionQuery('');
        setUserSuggestions([]);

        return newText;
    }, [currentMentionStart, currentMentionQuery]);

    const hideSuggestions = useCallback(() => {
        setShowUserSuggestions(false);
        setCurrentMentionStart(-1);
        setCurrentMentionQuery('');
        setUserSuggestions([]);
    }, []);

    return {
        showUserSuggestions,
        userSuggestions,
        isSearching,
        handleTextChange,
        selectUser,
        hideSuggestions,
    };
};
