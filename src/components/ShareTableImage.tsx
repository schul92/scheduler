/**
 * ShareTableImage Component
 *
 * Renders a schedule table as an image for sharing.
 * Uses react-native-view-shot to capture the view.
 */

import React, { useRef, useImperativeHandle, forwardRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import ViewShot from 'react-native-view-shot';

interface MemberAssignment {
  name: string;
  instrument: string;
  instrumentEmoji: string;
  instrumentName: string;
  dates: Set<string>;
}

interface ShareTableImageProps {
  title: string;
  dates: string[];
  members: MemberAssignment[];
}

export interface ShareTableImageRef {
  capture: () => Promise<string>;
}

const ShareTableImage = forwardRef<ShareTableImageRef, ShareTableImageProps>(
  ({ title, dates, members }, ref) => {
    const viewShotRef = useRef<ViewShot>(null);

    useImperativeHandle(ref, () => ({
      capture: async () => {
        if (viewShotRef.current?.capture) {
          return await viewShotRef.current.capture();
        }
        throw new Error('ViewShot ref not available');
      },
    }));

    const days = ['일', '월', '화', '수', '목', '금', '토'];

    // Format date headers
    const dateHeaders = dates.map(date => {
      const d = new Date(date);
      return {
        short: `${d.getMonth() + 1}/${d.getDate()}`,
        day: days[d.getDay()],
      };
    });

    return (
      <ViewShot
        ref={viewShotRef}
        options={{ format: 'png', quality: 1 }}
        style={styles.container}
      >
        <View style={styles.card}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerIcon}>🎼</Text>
            <Text style={styles.headerTitle}>{title}</Text>
          </View>

          {/* Table */}
          <View style={styles.table}>
            {/* Table Header */}
            <View style={styles.tableRow}>
              <View style={[styles.tableCell, styles.nameCell, styles.headerCell]}>
                <Text style={styles.headerText}>이름</Text>
              </View>
              {dateHeaders.map((header, index) => (
                <View key={index} style={[styles.tableCell, styles.dateCell, styles.headerCell]}>
                  <Text style={styles.headerDateText}>{header.short}</Text>
                  <Text style={styles.headerDayText}>({header.day})</Text>
                </View>
              ))}
            </View>

            {/* Table Body */}
            {members.map((member, memberIndex) => (
              <View key={memberIndex} style={[styles.tableRow, memberIndex % 2 === 1 && styles.alternateRow]}>
                <View style={[styles.tableCell, styles.nameCell]}>
                  <Text style={styles.memberEmoji}>{member.instrumentEmoji}</Text>
                  <View style={styles.memberInfo}>
                    <Text style={styles.memberName}>{member.name}</Text>
                    <Text style={styles.memberInstrument}>{member.instrumentName}</Text>
                  </View>
                </View>
                {dates.map((date, dateIndex) => (
                  <View key={dateIndex} style={[styles.tableCell, styles.dateCell]}>
                    {member.dates.has(date) ? (
                      <Text style={styles.checkmark}>✓</Text>
                    ) : (
                      <Text style={styles.empty}>·</Text>
                    )}
                  </View>
                ))}
              </View>
            ))}
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.legend}>✓ = 배정됨</Text>
            <Text style={styles.branding}>✨ PraiseFlow</Text>
          </View>
        </View>
      </ViewShot>
    );
  }
);

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: -9999,
    top: -9999,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    minWidth: 320,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  headerIcon: {
    fontSize: 24,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  table: {
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e5e5e5',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
  },
  alternateRow: {
    backgroundColor: '#f9f9f9',
  },
  tableCell: {
    padding: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  nameCell: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 6,
    minWidth: 100,
  },
  dateCell: {
    width: 60,
    borderLeftWidth: 1,
    borderLeftColor: '#e5e5e5',
  },
  headerCell: {
    backgroundColor: '#D4A574',
    borderBottomWidth: 2,
    borderBottomColor: '#c49464',
  },
  headerText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  headerDateText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  headerDayText: {
    fontSize: 10,
    color: '#FFFFFF',
    opacity: 0.9,
  },
  memberEmoji: {
    fontSize: 16,
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1a1a1a',
  },
  memberInstrument: {
    fontSize: 10,
    color: '#6b7280',
    marginTop: 1,
  },
  checkmark: {
    fontSize: 18,
    color: '#22c55e',
    fontWeight: '700',
  },
  empty: {
    fontSize: 18,
    color: '#d1d5db',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e5e5',
  },
  legend: {
    fontSize: 12,
    color: '#6b7280',
  },
  branding: {
    fontSize: 12,
    color: '#D4A574',
    fontWeight: '600',
  },
});

export default ShareTableImage;
