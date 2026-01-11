/**
 * SongInput Component
 *
 * Inline song editing component for setlist management.
 * Includes song title, key picker, optional YouTube URL, and delete button.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../providers/ThemeProvider';
import { useLanguage } from '../providers/LanguageProvider';
import { spacing, borderRadius, fontSize, shadows } from '../lib/theme';
import { KeySelector } from './KeySelector';
import type { Song } from '../store/setlistStore';

interface SongInputProps {
  song: Song;
  index: number;
  onUpdate: (updates: Partial<Omit<Song, 'id'>>) => void;
  onDelete: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  isFirst?: boolean;
  isLast?: boolean;
}

export function SongInput({
  song,
  index,
  onUpdate,
  onDelete,
  onMoveUp,
  onMoveDown,
  isFirst = false,
  isLast = false,
}: SongInputProps) {
  const { colors } = useTheme();
  const { language } = useLanguage();
  const [showUrlInput, setShowUrlInput] = useState(!!song.youtubeUrl);

  const handleOpenYouTube = () => {
    if (song.youtubeUrl) {
      Linking.openURL(song.youtubeUrl);
    }
  };

  const isValidYouTubeUrl = (url: string) => {
    return url.includes('youtube.com') || url.includes('youtu.be');
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      {/* Header Row: Order Number + Title + Key + Delete */}
      <View style={styles.headerRow}>
        {/* Order/Reorder Controls */}
        <View style={styles.orderControls}>
          <TouchableOpacity
            onPress={onMoveUp}
            disabled={isFirst}
            style={[styles.orderButton, isFirst && styles.orderButtonDisabled]}
          >
            <Ionicons
              name="chevron-up"
              size={16}
              color={isFirst ? colors.textMuted : colors.textSecondary}
            />
          </TouchableOpacity>
          <Text style={[styles.orderNumber, { color: colors.textMuted }]}>
            {index + 1}
          </Text>
          <TouchableOpacity
            onPress={onMoveDown}
            disabled={isLast}
            style={[styles.orderButton, isLast && styles.orderButtonDisabled]}
          >
            <Ionicons
              name="chevron-down"
              size={16}
              color={isLast ? colors.textMuted : colors.textSecondary}
            />
          </TouchableOpacity>
        </View>

        {/* Song Title Input */}
        <View style={styles.titleContainer}>
          <TextInput
            style={[
              styles.titleInput,
              { color: colors.textPrimary, borderColor: colors.border },
            ]}
            placeholder={language === 'ko' ? '곡명' : 'Song title'}
            placeholderTextColor={colors.textMuted}
            value={song.title}
            onChangeText={(text) => onUpdate({ title: text })}
          />
        </View>

        {/* Delete Button */}
        <TouchableOpacity
          onPress={onDelete}
          style={[styles.deleteButton, { backgroundColor: colors.errorLight }]}
        >
          <Ionicons name="trash-outline" size={18} color={colors.error} />
        </TouchableOpacity>
      </View>

      {/* Key Selector Row */}
      <View style={styles.keyRow}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>
          {language === 'ko' ? '키' : 'Key'}
        </Text>
        <View style={styles.keySelector}>
          <KeySelector value={song.key} onChange={(key) => onUpdate({ key })} />
        </View>
      </View>

      {/* YouTube URL Section */}
      <View style={styles.urlSection}>
        {!showUrlInput ? (
          <TouchableOpacity
            style={[styles.addUrlButton, { borderColor: colors.border }]}
            onPress={() => setShowUrlInput(true)}
          >
            <Ionicons name="logo-youtube" size={16} color={colors.textSecondary} />
            <Text style={[styles.addUrlText, { color: colors.textSecondary }]}>
              {language === 'ko' ? 'YouTube 링크 추가' : 'Add YouTube link'}
            </Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.urlInputRow}>
            <Ionicons
              name="logo-youtube"
              size={18}
              color={song.youtubeUrl && isValidYouTubeUrl(song.youtubeUrl) ? '#FF0000' : colors.textMuted}
            />
            <TextInput
              style={[
                styles.urlInput,
                { color: colors.textPrimary, borderColor: colors.border },
              ]}
              placeholder="https://youtube.com/..."
              placeholderTextColor={colors.textMuted}
              value={song.youtubeUrl || ''}
              onChangeText={(text) => onUpdate({ youtubeUrl: text || undefined })}
              keyboardType="url"
              autoCapitalize="none"
              autoCorrect={false}
            />
            {song.youtubeUrl && isValidYouTubeUrl(song.youtubeUrl) && (
              <TouchableOpacity onPress={handleOpenYouTube} style={styles.openLinkButton}>
                <Ionicons name="open-outline" size={18} color={colors.primary} />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={() => {
                onUpdate({ youtubeUrl: undefined });
                setShowUrlInput(false);
              }}
              style={styles.removeUrlButton}
            >
              <Ionicons name="close-circle" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    gap: spacing.sm,
    ...shadows.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  orderControls: {
    alignItems: 'center',
    gap: 2,
  },
  orderButton: {
    padding: 2,
  },
  orderButtonDisabled: {
    opacity: 0.3,
  },
  orderNumber: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    width: 20,
    textAlign: 'center',
  },
  titleContainer: {
    flex: 1,
  },
  titleInput: {
    fontSize: fontSize.base,
    fontWeight: '600',
    borderWidth: 1,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs + 2,
  },
  deleteButton: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginLeft: 28, // Align with title
  },
  label: {
    fontSize: fontSize.sm,
    fontWeight: '500',
    minWidth: 24,
  },
  keySelector: {
    flex: 1,
  },
  urlSection: {
    marginLeft: 28, // Align with title
  },
  addUrlButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: borderRadius.sm,
    alignSelf: 'flex-start',
  },
  addUrlText: {
    fontSize: fontSize.sm,
  },
  urlInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  urlInput: {
    flex: 1,
    fontSize: fontSize.sm,
    borderWidth: 1,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  openLinkButton: {
    padding: spacing.xs,
  },
  removeUrlButton: {
    padding: spacing.xs,
  },
});

export default SongInput;
